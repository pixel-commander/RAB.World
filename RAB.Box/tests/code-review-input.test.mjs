import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, readdir, realpath, rm, symlink } from 'node:fs/promises';
import { createToolHouse } from '../bridge/tool-house.mjs';
import { createRabMemory } from '../bridge/rab-memory.mjs';
import { reviewGroup, normalizeInput } from '../tools/code-review/_review.mjs';
import { createScratchScope, validateScratchInput } from '../bridge/tool-scratch.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const hash=text=>createHash('sha256').update(text).digest('hex');
const good='const labels = items?.map(item => item?.label ?? "");\n';
const bad='const labels = items.map(item => item.label);\n';
async function fixture(t,{audit=false}={}){
  const temp=await realpath(await mkdtemp(path.join(os.tmpdir(),'rab-review-input-')));
  t.after(async()=>{assert.equal(path.dirname(temp),await realpath(os.tmpdir()));assert.ok(path.basename(temp).startsWith('rab-review-input-'));await rm(temp,{recursive:true,force:true});});
  const rab_home=path.join(temp,'home'), projectRoot=path.join(temp,'project');
  await mkdir(projectRoot);const memory=createRabMemory({rabHome:rab_home}),id=await memory.allocateId();
  const auditRoot=path.join(temp,'audit-input');await mkdir(auditRoot);
  await writeFile(path.join(projectRoot,'settings.json'),JSON.stringify({id,name:'test-review',type:audit?'audit':'react',...(audit?{paths:{folder:auditRoot}}:{})}));
  const context={rab_home,project:{id,name:'test-review',root:projectRoot}},house=createToolHouse({root});
  const run=(key,options)=>house.runTool({key,options,context});
  return {temp,context,house,run,projectRoot,auditRoot};
}

test('all six review tools are discoverable with declared Toolbox forms and output contracts',async t=>{
  const {house}=await fixture(t),listing=await house.listTools({fresh:true});
  for(const key of ['code-review','code-review/guards','code-review/grids','code-review/atoms','code-review/conventions','code-review/write']){
    const tool=await house.getTool(key);assert.ok(listing.items.some(x=>x.id===tool.id));
    assert.equal(tool.settings.find(field=>field.name==='code').type,'textarea');assert.ok(tool.contract.result);
    assert.equal(tool.meta.authority,key.endsWith('/write')?'write':'read');
  }
  assert.equal(listing.unavailable.filter(x=>x.key.startsWith('code-review')).length,0);
});

test('the actual guard tool distinguishes unguarded access, partial guards and complete fallback',async t=>{
  const {run,projectRoot}=await fixture(t);
  for(const [code,expected] of [[bad,3],['const x = data?.map(item => item.label);',2],['const x = data?.map(item => item?.label);',1],[good,0]]){
    const out=await run('code-review/guards',{file:'src/labels.ts',code});
    assert.equal(out.result.totals.findings,expected);assert.equal(out.result.passed,expected===0);
    assert.equal(out.result.code_sha256,hash(code));
    assert.equal(await readFile(out.result.evidence.source,'utf8'),code);
    assert.deepEqual(JSON.parse(await readFile(out.result.evidence.report,'utf8')),out.result);
    assert.ok(out.tasks.some(task=>task.tool?.key==='audit/code-review/bag-guards'&&task.parentTaskId===out.execution.execution_id));
    if(expected)assert.equal(out.tasks.find(task=>task.tool?.key==='audit/code-review/bag-guards').result.status,'ok');
  }
  assert.deepEqual(await readdir(projectRoot),['settings.json']);
});

test('guard grouping also reuses prop-renames and preserves its evidence',async t=>{
  const {run}=await fixture(t);const out=await run('code-review/guards',{file:'Card.tsx',code:'const heading = props.title;'});
  assert.equal(out.result.passed,false);assert.ok(out.result.findings.some(row=>row.rule==='prop-rename'&&row.prop==='title'&&row.line===1));
});

test('grid checks reuse supplied CSS and allow an ordinary flex leaf',async t=>{
  const {run}=await fixture(t);
  const css='.shell { display:grid; } .middle { display:flex; } .inner { display:grid; }';
  let out=await run('code-review/grids',{file:'Card.tsx',css,code:'const Card=()=> <div className="shell"><div className="middle"><div className="inner" /></div></div>;'});
  assert.equal(out.result.passed,false);assert.equal(out.result.findings[0].rule,'grid-flex-grid');
  out=await run('code-review/grids',{file:'Card.tsx',code:'const Card=()=> <div data-grid><div data-flex /></div>;'});
  assert.equal(out.result.passed,true);
});

test('atoms reuse token and is-active state checks; structural CSS and token definitions pass',async t=>{
  const {run}=await fixture(t);
  let out=await run('code-review/atoms',{file:'src/atoms/action.css',code:'.action.is-active { color:#fff; } .action.is-active { color:var(--text); }'});
  assert.equal(out.result.passed,false);
  assert.deepEqual(new Set(out.result.findings.map(row=>row.rule)),new Set(['css-token-required','duplicate-css-state']));
  out=await run('code-review/atoms',{file:'src/atoms/action.css',code:'.action:active, .action.is-active { color:var(--text); } .shell { display:grid; }'});
  assert.equal(out.result.passed,true);
  out=await run('code-review/atoms',{file:'src/theme/tokens.css',code:':root { --text:#fff; }'});assert.equal(out.result.passed,true);
});

test('parent runs groups through the runner and distinguishes skipped groups from passes',async t=>{
  const {run}=await fixture(t);const out=await run('code-review',{file:'labels.ts',code:good});
  assert.equal(out.result.passed,true);assert.equal(out.result.children.length,4);
  assert.equal(out.result.totals.checks_run,3);assert.equal(out.result.totals.checks_skipped,3);
  assert.equal(out.tasks.length,8);assert.doesNotThrow(()=>JSON.stringify(out));
  assert.ok(out.result.checks.every(check=>check.execution_id===null||typeof check.duration_ms==='number'));
});

test('selected checks are exact, validated and never expand silently',async t=>{
  const {run}=await fixture(t);
  const out=await run('code-review',{file:'labels.ts',code:good,checks:['guards']});assert.equal(out.result.children.length,1);
  for(const checks of [[],['guards','guards'],['missing'],'guards'])await assert.rejects(()=>run('code-review',{file:'labels.ts',code:good,checks}),{code:'INVALID_INPUT'});
});

test('unsupported or unscanned input cannot produce a passing review',async t=>{
  const {run}=await fixture(t);
  const out=await run('code-review',{file:'notes.txt',code:good});assert.equal(out.result.passed,false);assert.equal(out.result.status,'skipped');
  await assert.rejects(()=>run('code-review/guards',{file:'node_modules/hidden.ts',code:good}),{code:'INCOMPLETE_REVIEW'});
});

test('input paths and size are constrained without changing the project',async t=>{
  const {run,projectRoot}=await fixture(t);
  for(const file of ['../outside.ts','C:/outside.ts','file.ts:stream','con.ts'])await assert.rejects(()=>run('code-review/guards',{file,code:good}),{code:'INVALID_PATH'});
  await assert.rejects(()=>run('code-review/guards',{file:'big.ts',code:'x'.repeat(256*1024+1)}),{code:'INPUT_TOO_LARGE'});
  assert.deepEqual(await readdir(projectRoot),['settings.json']);
});

test('source is inspected as text and never evaluated',async t=>{
  const {run,temp}=await fixture(t),canary=path.join(temp,'executed.txt');
  const code=`import {writeFileSync} from 'node:fs'; writeFileSync(${JSON.stringify(canary)},'executed');\n${good}`;
  const out=await run('code-review/guards',{file:'candidate.mjs',code});assert.equal(out.result.passed,true);
  await assert.rejects(()=>readFile(canary),{code:'ENOENT'});
});

test('write requires explicit confirmation and refuses findings and zero applicable checks',async t=>{
  const {run,projectRoot}=await fixture(t);
  await assert.rejects(()=>run('code-review/write',{file:'src/labels.ts',code:good}),{code:'CONFIRM_REQUIRED'});
  for(const [file,code] of [['src/labels.ts',bad],['notes.txt',good]]){
    const out=await run('code-review/write',{file,code,confirm:true});assert.equal(out.result.wrote,false);assert.equal(out.result.status,'blocked');
  }
  assert.deepEqual(await readdir(projectRoot),['settings.json']);
});

test('writer checks exact new bytes, verifies output and never overwrites',async t=>{
  const {run,projectRoot}=await fixture(t),file='src/labels.ts';
  const out=await run('code-review/write',{file,code:good,confirm:true});
  assert.equal(out.result.wrote,true);assert.equal(await readFile(path.join(projectRoot,file),'utf8'),good);
  assert.equal(out.result.verification.files[0].sha256,hash(good));assert.ok(out.result.review_execution_id);
  await assert.rejects(()=>run('code-review/write',{file,code:good,confirm:true}),{code:'EEXIST'});
  assert.equal(await readFile(path.join(projectRoot,file),'utf8'),good);
});

test('previous pass never authorizes changed input, and caller cannot submit a forged pass flag',async t=>{
  const {run,projectRoot}=await fixture(t),file='labels.ts';
  assert.equal((await run('code-review',{file,code:good})).result.passed,true);
  assert.equal((await run('code-review/write',{file,code:bad,confirm:true})).result.wrote,false);
  await assert.rejects(()=>run('code-review/write',{file,code:good,confirm:true,passed:true}),{code:'BAD_REQUEST'});
  await assert.rejects(()=>readFile(path.join(projectRoot,file)),{code:'ENOENT'});
});

test('writer refuses symlink/junction parents outside the selected project',async t=>{
  const {run,projectRoot,temp}=await fixture(t),outside=path.join(temp,'outside');await mkdir(outside);
  await symlink(outside,path.join(projectRoot,'linked'),'junction');
  await assert.rejects(()=>run('code-review/write',{file:'linked/labels.ts',code:good,confirm:true}),{code:'INVALID_PATH'});
  assert.deepEqual(await readdir(outside),[]);
});

test('audit project can review scratch code and keeps the audited folder untouched',async t=>{
  const {run,auditRoot}=await fixture(t,{audit:true});
  const out=await run('code-review',{file:'labels.ts',code:good});assert.equal(out.result.passed,true);assert.ok(out.result_file);
  assert.deepEqual(await readdir(auditRoot),[]);
});

test('checker errors, incomplete results and modified staged source never become passes',async t=>{
  const {context}=await fixture(t),input=normalizeInput({file:'labels.ts',code:good});
  await assert.rejects(()=>reviewGroup({input,group:'guards',context,helpers:{runScratchTool:async()=>{throw Object.assign(new Error('failure'),{code:'CHECK_FAILED'});}}}),{code:'CHECK_FAILED'});
  await assert.rejects(()=>reviewGroup({input,group:'guards',context,helpers:{runScratchTool:async()=>({result:{totals:{files_scanned:0,matches:0},rows:[]}})}}),{code:'INCOMPLETE_REVIEW'});
  await assert.rejects(()=>reviewGroup({input,group:'guards',context,helpers:{runScratchTool:async({options})=>{
    await writeFile(path.join(options.folder,input.file),bad);
    return {result:{totals:{files_scanned:1,matches:0},rows:[]},execution:{execution_id:123,duration_ms:1}};
  }}}),{code:'STALE_REVIEW'});
});

test('scratch scope cannot be forged and cannot authorize writers or other folders',async t=>{
  const {context,projectRoot}=await fixture(t),folder=path.join(context.rab_home,'temp','test','123','source');await mkdir(folder,{recursive:true});
  const scope=await createScratchScope({folder,rabHome:context.rab_home});
  await validateScratchInput({scope,tool:{meta:{authority:'read'}},options:{folder}});
  await assert.rejects(()=>validateScratchInput({scope:{folder},tool:{meta:{authority:'read'}},options:{folder}}),{code:'INVALID_SCRATCH'});
  await assert.rejects(()=>validateScratchInput({scope,tool:{meta:{authority:'write'}},options:{folder}}),{code:'INVALID_SCRATCH'});
  await assert.rejects(()=>validateScratchInput({scope,tool:{meta:{authority:'read'}},options:{folder:projectRoot}}),{code:'INVALID_SCRATCH'});
  await assert.rejects(()=>createScratchScope({folder:projectRoot,rabHome:context.rab_home}),{code:'INVALID_SCRATCH'});
});

test('ordinary audit calls still refuse .rab as audit input',async t=>{
  const {run,context}=await fixture(t,{audit:true});
  await assert.rejects(()=>run('audit/code-review/bag-guards',{folder:context.rab_home}),{code:'AUDIT_PATH_REQUIRED'});
});
