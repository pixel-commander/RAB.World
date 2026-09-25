import { createRabMemory } from '../bridge/rab-memory.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rename, rm, realpath, readdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createToolHouse } from '../bridge/tool-house.mjs';
import { createWorkbench } from '../bridge/service.mjs';
import { createAuditOutputGuide } from '../tools/audit/_output-shapes.mjs';
import { inspectStampSources } from '../scripts/audit-stamp-sources.mjs';

async function fixture(t) {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'rab-contract-discovery-')));
  const tools = path.join(root, 'tools'); await mkdir(tools);
  t.after(async () => {
    assert.equal(path.dirname(root), await realpath(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('rab-contract-discovery-'));
    await rm(root, {recursive:true,force:true});
  });
  const json = async (relative, value) => {
    const file=path.join(root, relative); await mkdir(path.dirname(file),{recursive:true});
    await writeFile(file,JSON.stringify(value,null,2)); return file;
  };
  const add = async (key, id, { ownExecutor=true, authority='read', meta={} }={}) => {
    const folder=path.join(tools,key),name=path.basename(folder);
    await json(`tools/${key}/settings.json`,{id,name,title:name,description:'Discovery contract fixture',settings:[{name:'folder',type:'folder',required:false}],meta:{authority,...meta}});
    if(ownExecutor)await writeFile(path.join(folder,`${name}.mjs`),'export const run=async()=>({status:"ok",rows:[{name:"example",count:0,enabled:false}]});\n');
    return folder;
  };
  return {root,tools,json,add};
}
const shape={status:'string',rows:[{name:'string',count:'number',enabled:'boolean'}]};

test('owner defaults, metadata variants, and explicit leaf overrides drive previews without executing tools',async t=>{
  const {root,json,add}=await fixture(t);
  const parent=await add('audit/find',1,{meta:{engine:'example'}});
  await writeFile(path.join(parent,'find.mjs'),'throw new Error("Catalog imported the executor");\n');
  await json('tools/audit/find/contract.json',{version:'tool-contract/v1',source:{kind:'internal',description:'Fixture internal scanner'},select:'meta.engine',variants:{example:{result:shape}}});
  await add('audit/find/one',2,{ownExecutor:false,meta:{engine:'example'}});
  await add('audit/find/new-leaf',3,{ownExecutor:false,meta:{engine:'example'}});
  await add('audit/find/unknown',4,{ownExecutor:false,meta:{engine:'unsupported'}});
  await json('tools/audit/find/one/contract.json',{version:'tool-contract/v1',result:null});
  const house=createToolHouse({root}),catalog=await house.listTools();
  assert.deepEqual(catalog.unavailable,[]);
  const guide=createAuditOutputGuide();
  const leaf=catalog.items.find(tool=>tool.key==='audit/find/new-leaf');
  assert.deepEqual(guide.describe(leaf).shape,shape);
  assert.equal(leaf.contract.source.kind,'internal');
  assert.equal(leaf.contract.owners.result,path.join(parent,'contract.json'));
  assert.equal(guide.describe(catalog.items.find(tool=>tool.key==='audit/find/one')),null);
  assert.equal(guide.describe(catalog.items.find(tool=>tool.key==='audit/find/unknown')),null);
  assert.equal(catalog.items.find(tool=>tool.key==='audit/find/one').contract.source.kind,'internal');
  const changed={...shape,changed:'boolean'};
  await json('tools/audit/find/contract.json',{version:'tool-contract/v1',result:changed,source:{kind:'internal'}});
  const refreshed=await house.listTools({fresh:true});
  assert.deepEqual(guide.describe(refreshed.items.find(tool=>tool.key===leaf.key)).shape,changed);
});

test('new tools get derived shortcuts, execute with saved references, and refresh after external moves/removals',async t=>{
  const {root,json,add}=await fixture(t),house=createToolHouse({root});
  await house.listTools();
  const folder=await add('audit/inspect/widget',101);
  await json('tools/audit/inspect/widget/contract.json',{version:'tool-contract/v1',result:shape});
  const input=path.join(root,'source');await mkdir(input);await writeFile(path.join(input,'keep.txt'),'untouched');
  const memory=createRabMemory({rabHome:path.join(root,'.rab')});
  const project={id:await memory.allocateId(),name:'Fixture',root:memory.newProjectPath('Fixture')};
  await json('.rab/projects/Fixture/settings.json',{...project,type:'audit',paths:{folder:input,results:'audit-results'}});
  const result=await house.runTool({key:'inspect-widget',context:{rab_home:path.join(root,'.rab'),project}});
  assert.equal(result.tool.id,101);assert.equal(result.result.rows[0].count,0);assert.equal(result.result.rows[0].enabled,false);
  assert.equal(result.options.folder,input);
  assert.ok(result.result_file.startsWith(createRabMemory({rabHome:path.join(root,'.rab')}).paths(project).project+path.sep));
  const saved=JSON.parse(await readFile(result.result_file,'utf8'));
  const tracking=JSON.parse(await readFile(result.tracking_file,'utf8'));
  assert.deepEqual(saved.result,result.result);
  assert.equal(tracking.result_ref.file,result.result_file);
  assert.ok(tracking.start_date&&tracking.end_date);assert.equal(typeof tracking.duration_ms,'number');
  assert.deepEqual(Object.keys(saved.tool.contract).sort(),['consumes','returns']);
  assert.equal(await readFile(path.join(input,'keep.txt'),'utf8'),'untouched');
  assert.deepEqual(await readdir(input),['keep.txt']);
  const moved=path.join(root,'tools/audit/inspect/nested/widget');await mkdir(path.dirname(moved),{recursive:true});
  await rename(folder,moved);await house.listTools({fresh:true});
  assert.equal((await house.getTool('inspect-nested-widget')).id,101);
  await assert.rejects(house.getTool('inspect-widget'),{code:'TOOL_NOT_FOUND'});
  assert.ok(moved.startsWith(root+path.sep));await rm(moved,{recursive:true});
  await house.listTools({fresh:true});await assert.rejects(house.getTool('101'),{code:'TOOL_NOT_FOUND'});
  assert.ok(!(await readdir(root)).includes('PATHS.json'),'Derived shortcuts must not create another registry');
});

test('ambiguous derived shortcuts and stale explicit identities never silently choose a tool',async t=>{
  const {root,json,add}=await fixture(t),house=createToolHouse({root});
  await add('alpha/find/widget',1);await add('beta/find/widget',2);
  await assert.rejects(house.getTool('find-widget'),{code:'AMBIGUOUS_PATH'});
  assert.equal((await house.getTool('alpha/find/widget')).id,1);
  await json('PATHS.json',{tools:{chosen:{id:999,path:'alpha/find/widget'},moved:{id:1,path:'alpha/find/old-widget'}}});
  await assert.rejects(house.getTool('chosen'),{code:'TOOL_NOT_FOUND'});
  await assert.rejects(house.getTool('moved'),{code:'STALE_PATH'});
  const packed=await house.pathsRegistry.pack();
  assert.ok(packed.diagnostics.some(item=>item.address==='chosen'&&item.code==='STALE_PATH'));
  await json('PATHS.json',{tools:{'find-widget':{id:2,path:'beta/find/widget'}}});
  assert.equal((await house.getTool('find-widget')).id,2,'An explicit alias resolves a deliberate choice');
  await json('PATHS.json',{tools:{preferred:{id:1,path:'alpha/find/widget'}}});
  await add('alpha/find/unique',3);await house.listTools({fresh:true});
  await json('PATHS.json',{tools:{preferred:{id:3,path:'alpha/find/unique'}}});
  const ordered=await house.pathsRegistry.pack();
  assert.equal(Object.values(ordered.tools).find(entry=>entry.id===3).address,'preferred','Existing planner preference must precede new derived names');
});

test('contract references stay bounded, reject cycles, and expose invalid contract diagnostics',async t=>{
  const {root,json,add}=await fixture(t);
  await add('audit/one',1);await add('audit/two',2);await add('audit/three',3);
  await json('outside.json',{version:'tool-contract/v1',result:shape});
  await json('tools/audit/one/contract.json',{version:'tool-contract/v1',extends:'../../../outside.json'});
  await json('tools/audit/two/contract.json',{version:'tool-contract/v1',extends:'contract.json'});
  await json('tools/audit/three/contract.json',{version:'unrecognized'});
  const result=await createToolHouse({root}).listTools();
  for(const key of ['audit/one','audit/two','audit/three'])assert.ok(result.unavailable.some(tool=>tool.key===key&&tool.code==='BAD_TOOL_CONTRACT'),key);
  assert.deepEqual(result.items,[]);
});

test('service catalog refresh observes changed contracts without loading a project',async t=>{
  const {root,json,add}=await fixture(t),workbench=createWorkbench({root,rabHome:path.join(root,'.rab')});
  const before=await workbench.toolsList();assert.deepEqual(before.items,[]);
  await add('audit/sample',1);
  await json('tools/audit/sample/contract.json',{version:'tool-contract/v1',result:shape});
  const next=await workbench.toolsList();assert.deepEqual(next.items.map(tool=>tool.key),['audit/sample']);
  assert.deepEqual(next.items[0].contract.result,shape);
  assert.equal(next.persistence.tracking.start_date,'ISO date');
  assert.ok(!(await readdir(root)).includes('.rab'));
});

test('source report consumes declared classifications and fingerprints their owner',async t=>{
  const {root,json,add}=await fixture(t);
  await add('demo/writer',1,{authority:'write'});
  const contract=await json('tools/demo/writer/contract.json',{version:'tool-contract/v1',source:{kind:'internal',description:'Builds fixture source internally'}});
  const report=await inspectStampSources({root});
  assert.equal(report.writers[0].implementation_classification,'internal');
  assert.equal(report.writers[0].classification_owner,'tools/demo/writer/contract.json');
  assert.ok(report.source_files.some(file=>path.resolve(root,file.path)===contract));
  assert.equal(report.totals.unclassified,0);
});
