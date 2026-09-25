import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, mkdir, writeFile, rm, cp, readFile, lstat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createToolHouse } from '../bridge/tool-house.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const fixture=async t=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'rab-audit-expansion-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const src=path.join(dir,'src');await mkdir(src,{recursive:true});
  await writeFile(path.join(src,'App.tsx'),`// TODO: clean\n// FIXME: later\nimport './theme.css';\nexport const Card = () => {\n  fetch('/api/items');\n  console.log('x');\n  const value: any = 42;\n  if (value == 42 && value || Math.random() > 0.5 ? true : false) debugger;\n  return <div className="card active"><Button /></div>;\n};\nexport const Button = () => <button className={'button'} style={{ color: 'red' }}>Go</button>;\n`);
  await writeFile(path.join(src,'theme.css'),`:root { --color-primary: #fff; --space-sm: 8px; }\n.card { color: var(--color-primary); z-index: 10 !important; }\n.button { margin: var(--space-sm); }\n`);
  await writeFile(path.join(src,'index.ts'),`export * from './App';\n`);
  return dir;
};

test('nested new-tool Stamp can author a semantic leaf with inherited executor and PATHS address',async t=>{
  const temp=await mkdtemp(path.join(os.tmpdir(),'rab-new-tool-nested-'));t.after(()=>rm(temp,{recursive:true,force:true}));
  await cp(path.join(root,'tools'),path.join(temp,'tools'),{recursive:true});
  await cp(path.join(root,'bridge'),path.join(temp,'bridge'),{recursive:true});
  await cp(path.join(root,'engine'),path.join(temp,'engine'),{recursive:true});
  await cp(path.join(root,'language'),path.join(temp,'language'),{recursive:true});
  await cp(path.join(root,'PATHS.json'),path.join(temp,'PATHS.json'));
  const house=createToolHouse({root:temp});
  const out=await house.runTool({key:'new-tool',context:{rab_home:path.join(temp,'.rab')},options:{path:'audit/find/sample-signal',address:'find-sample-signal',inherit_executor:true,title:'Find Sample Signal',description:'Finds a sample signal.',settings:[{type:'folder',name:'folder',title:'Folder',description:'Folder',required:false}],meta:{domain:'audit',operation:'find',target_type:'sample-signal',authority:'read',engine:'line',config:{pattern:'sample',kind:'sample'}}}});
  assert.equal(out.result.path,'audit/find/sample-signal');
  assert.equal(out.result.address,'find-sample-signal');
  assert.equal(out.result.inherited_executor,true);
  assert.equal((await lstat(path.join(temp,'tools/audit/find/sample-signal'))).isDirectory(),true);
  assert.equal((await house.getTool('find-sample-signal')).path,'audit/find/sample-signal');
});

test('audit expansion is discoverable and has no unavailable Tools',async()=>{
  const house=createToolHouse({root});const scan=await house.scan({fresh:true});
  assert.equal(scan.unavailable.length,0);
  assert.equal(new Set(scan.items.map(tool=>String(tool.id))).size,scan.items.length);
  for(const key of ['find-todos','find-loose-equality','find-theme-tokens','find-class-names','find-component-usage','count-class-usage','count-component-usage','count-theme-token-usage','inspect-theme']) assert.ok(await house.getTool(key),key);
});

test('theme audit cross-references tokens classes and components without treating theme.css filename as a token',async t=>{
  const folder=await fixture(t),house=createToolHouse({root});
  const context={rab_home:path.join(folder,'.rab')};
  const tokens=(await house.runTool({key:'find-theme-tokens',options:{folder},context})).result;
  assert.equal(tokens.totals.matches,4);
  assert.deepEqual(tokens.counts,[{name:'--color-primary',count:2},{name:'--space-sm',count:2}]);
  assert.ok(!tokens.counts.some(x=>x.name==='css'));
  const classes=(await house.runTool({key:'find-class-names',options:{folder},context})).result;
  assert.deepEqual(classes.counts.map(x=>x.name).sort(),['active','button','card']);
  const defs=(await house.runTool({key:'find-component-definitions',options:{folder},context})).result;
  assert.deepEqual(defs.counts.map(x=>x.name).sort(),['Button','Card']);
  const usage=(await house.runTool({key:'count-component-usage',options:{folder},context})).result;
  assert.equal(usage.unique,1);assert.equal(usage.counts[0].name,'Button');assert.equal(usage.counts[0].count,1);
});

test('representative structural audits return deterministic machine-readable evidence',async t=>{
  const folder=await fixture(t),house=createToolHouse({root});
  const expected=[['find-todos',1],['find-console-calls',1],['find-typescript-any',1],['find-loose-equality',1],['find-css-important',1],['find-z-index',1],['find-barrel-exports',1]];
  const context={rab_home:path.join(folder,'.rab')};
  for(const [key,count] of expected){const a=(await house.runTool({key,options:{folder},context})).result;const b=(await house.runTool({key,options:{folder},context})).result;assert.equal(a.totals.matches,count,key);assert.deepEqual(a,b,key);}
});

test('inspect-theme composes existing Tools through child Tasks and returns aggregate report',async t=>{
  const folder=await fixture(t),house=createToolHouse({root});
  const out=await house.runTool({key:'inspect-theme',options:{folder},context:{rab_home:path.join(folder,'.rab')}});
  assert.equal(out.result.status,'ok');
  assert.equal(out.result.summary.declared_components,2);
  assert.equal(out.result.summary.unique_classes,3);
  assert.equal(out.result.summary.unique_components_used,1);
  assert.equal(out.result.summary.unique_tokens,2);
  assert.ok(out.tasks.filter(x=>x.parentTaskId).length>=10);
  assert.deepEqual(out.result.provided.seats.theme_report.componentUses,[{name:'Button',count:1}]);
});
