import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { run } from '../tools/audit/code-review/code-review.mjs';
import { SCRATCH_SCOPE, createScratchScope } from '../bridge/tool-scratch.mjs';
import { createToolHouse } from '../bridge/tool-house.mjs';

const rabHome=path.join(os.homedir(),'.rab');
const boxRoot=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const fixture=async t=>{
  const parent=path.join(rabHome,'temp','test');
  await mkdir(parent,{recursive:true});
  for(;;){
    const directory=path.join(parent,String(Date.now()));
    try{
      await mkdir(directory);
      t.after(async()=>{
        const relative=path.relative(parent,directory);
        assert.match(relative,/^[1-9]\d*$/);
        await rm(directory,{recursive:true,force:true});
      });
      const source=path.join(directory,'source');await mkdir(source);
      return source;
    }catch(error){if(error.code!=='EEXIST')throw error;}
  }
};
const review=async(source,rule,code,{file='src/helpers.ts',context={}}={})=>{
  const target=path.join(source,file);
  await mkdir(path.dirname(target),{recursive:true});
  await writeFile(target,code);
  return run({options:{folder:source},context,tool:{key:`audit/code-review/${rule}`,meta:{rule}}});
};

test('conventions accepts exact plural collection and singular map callback names',async t=>{
  const source=await fixture(t);
  const result=await review(source,'conventions',[
    'const a = items?.map(item => item?.label ?? "");',
    'const b = rows?.map((row, index) => row?.id ?? 0);',
    'const c = components.map(component => component?.name ?? "");'
  ].join('\n'));
  assert.equal(result.totals.files_scanned,1);
  assert.deepEqual(result.rows,[]);
});

test('conventions rejects name mismatches and non-plural collection names, ignoring comments and strings',async t=>{
  const source=await fixture(t);
  const result=await review(source,'conventions',[
    'const a = items?.map(row => row);',
    'const b = item?.map(item => item);',
    'const c = components.map(item => item);',
    'const text = "rows?.map(item => item)";',
    '// rows?.map(item => item)'
  ].join('\n'));
  assert.deepEqual(result.rows.map(row=>[row.rule,row.line,row.collection,row.item,row.expected]),[
    ['plural-loop-item-name',1,'items','row','item'],
    ['plural-loop-item-name',2,'item','item',null],
    ['plural-loop-item-name',3,'components','item','component']
  ]);
});

test('prop rename check catches direct aliases with fallbacks and renamed destructuring',async t=>{
  const source=await fixture(t);
  const result=await review(source,'prop-renames',[
    'const wrong_key = props?.right_key || 22;',
    'wrong_key = props?.right_key ?? 22;',
    'const right_key = props?.right_key || 22;',
    'const right_key = props?.right_kiey ?? 22;',
    'const {right_key: wrong_key = 22} = props;',
    'const fn = ({right_key: wrong_key = 22}) => wrong_key;',
    'const okay = ({right_key}) => { right_key = right_key || 22; };'
  ].join('\n'));
  assert.deepEqual(result.rows.map(row=>[row.rule,row.line,row.prop,row.alias]),[
    ['prop-rename',1,'right_key','wrong_key'],
    ['prop-rename',2,'right_key','wrong_key'],
    ['prop-rename',4,'right_kiey','right_key'],
    ['prop-rename',5,'right_key','wrong_key'],
    ['prop-rename',6,'right_key','wrong_key']
  ]);
});

test('raw-code scratch review runs naming without misleading component-folder findings',async t=>{
  const source=await fixture(t);
  const scope=await createScratchScope({folder:source,rabHome});
  const result=await review(source,'conventions','const Card = () => items?.map(row => row);',
    {file:'Card.tsx',context:{[SCRATCH_SCOPE]:scope}});
  assert.deepEqual(result.rows.map(row=>row.rule),['plural-loop-item-name']);
});

test('conventions leaf is discovered and tracks the existing audit as a child',async t=>{
  const source=await fixture(t),localHome=path.dirname(source);
  const house=createToolHouse({root:boxRoot});
  const out=await house.runTool({key:'code-review/conventions',
    options:{file:'src/helpers.ts',code:'const result = items?.map(row => row);'},
    context:{rab_home:localHome}});
  assert.equal(out.result.passed,false);
  assert.deepEqual(out.result.findings.map(row=>row.rule),['plural-loop-item-name']);
  assert.ok(out.tasks.some(task=>task.tool?.key==='audit/code-review/conventions'&&task.parentTaskId===out.execution.execution_id));
});
