import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, realpath, rm, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createToolHouse } from '../bridge/tool-house.mjs';
import { createWorkbench } from '../bridge/service.mjs';
import { updateToolkitLink } from '../bridge/toolkit-links.mjs';
import { createRabMemory } from '../bridge/rab-memory.mjs';
import { createToolWorkbench } from '../bridge/tool-workbench.mjs';
import { loadProject } from '../engine/src/project.mjs';

const json = async (file,value) => { await mkdir(path.dirname(file),{recursive:true}); await writeFile(file,JSON.stringify(value,null,2)); };
async function fixture(t) {
  const temp=await realpath(await mkdtemp(path.join(os.tmpdir(),'rab-external-toolkits-')));
  t.after(async()=>{assert.equal(path.dirname(temp),await realpath(os.tmpdir()));assert.ok(path.basename(temp).startsWith('rab-external-toolkits-'));await rm(temp,{recursive:true,force:true});});
  const root=path.join(temp,'box'), kit=path.join(temp,'kit'), rabHome=path.join(temp,'memory');
  await mkdir(path.join(root,'tools'),{recursive:true});
  const addKit=async(directory,id=1000)=>{
    await mkdir(path.join(directory,'tools'),{recursive:true});
    await json(path.join(directory,'settings.json'),{id,name:path.basename(directory),title:'Toolkit fixture',description:'External fixture',settings:[],meta:{kind:'toolkit'}});
  };
  await addKit(kit);
  const add=async(directory,key,id,{script,fields=[],stamp=false,own=true}={})=>{
    const folder=path.join(directory,'tools',key),name=path.basename(folder);
    await json(path.join(folder,'settings.json'),{id,name,title:name,description:'Fixture capability',settings:fields,meta:{authority:stamp?'write':'read'}});
    if(stamp)await mkdir(path.join(folder,'template'));
    if(own)await writeFile(path.join(folder,`${name}.mjs`),script??`export const run=async({options})=>({marker:${JSON.stringify(path.basename(directory))},options});`);
    return folder;
  };
  const link=()=>updateToolkitLink({root,directory:kit});
  return {temp,root,kit,rabHome,addKit,add,link,house:createToolHouse({root})};
}

test('linked tools use existing catalog, inherited executor, contracts, binding and runner without importing on discovery',async t=>{
  const f=await fixture(t);
  const parent=await f.add(f.kit,'react/inspect',1100,{script:'throw new Error("Discovery executed code");'});
  await json(path.join(parent,'contract.json'),{version:'tool-contract/v1',source:{kind:'internal'},result:{marker:'string',options:'object'}});
  const fields=[{name:'enabled',type:'boolean',default:true},{name:'count',type:'number',default:12},{name:'label',type:'text',default:'default'}];
  await f.add(f.kit,'react/inspect/example',1101,{own:false,fields});
  assert.deepEqual((await f.house.listTools()).items,[]);
  await f.link();
  const catalog=await f.house.listTools({fresh:true});
  assert.deepEqual(catalog.unavailable,[]);
  const tool=await f.house.getTool('inspect-example');
  assert.equal(tool.source,'toolkit');assert.equal(tool.toolkit.id,1000);assert.equal(tool.inheritedExecutor,true);
  assert.equal(tool.contract.source.kind,'internal');assert.equal(tool.contract.owners.result,path.join(parent,'contract.json'));
  await writeFile(path.join(parent,'inspect.mjs'),'export const run=async({options})=>({marker:"external",options});');
  const result=await f.house.runTool({key:'inspect-example',options:{enabled:false,count:0,label:''},context:{rab_home:f.rabHome}});
  assert.deepEqual(result.result,{marker:'external',options:{enabled:false,count:0,label:''}});
  assert.equal(result.execution.status,'completed');assert.equal(result.execution.tool.toolkit.id,1000);
  assert.ok(result.execution.duration_ms>=0);
  await assert.rejects(f.house.runTool({key:'inspect-example',options:{unexpected:true},context:{rab_home:f.rabHome}}),{code:'BAD_REQUEST'});
  assert.ok(!(await readdir(f.root)).includes('PATHS.json'));
});

test('project override selects linked implementation, composite inherits it, explicit IDs/paths retain meaning and receipts survive save',async t=>{
  const f=await fixture(t),projectRoot=path.join(f.temp,'project');
  await f.add(f.root,'react/stamp-original',2001,{stamp:true});
  await f.add(f.kit,'react/stamp-enhanced',2002,{stamp:true});
  await f.add(f.root,'react/compose',2003,{script:'export const run=async({helpers})=>{const child=await helpers.runTool({key:"new-widget"});return {marker:child.result.marker,selected:child.tool};};'});
  await json(path.join(f.root,'PATHS.json'),{stamps:{'new-widget':{id:2001,path:'react/stamp-original'}}});
  await json(path.join(projectRoot,'PATHS.json'),{stamps:{'new-widget':{id:2002,path:'react/stamp-enhanced',toolkit:1000}}});
  await json(path.join(projectRoot,'settings.json'),{name:'project',type:'react'});
  await f.link();
  const context={project:{id:'fixture',name:'Fixture',root:projectRoot},rab_home:f.rabHome};
  const direct=await f.house.runTool({key:'new-widget',context});
  assert.equal(direct.result.marker,'kit');assert.equal(direct.tool.source,'project');assert.equal(direct.tool.implementation_source,'toolkit');
  assert.deepEqual(direct.tool.shadowed,{id:2001,path:'react/stamp-original',source:'house'});
  assert.equal((await f.house.getTool('new-widget')).id,2001);
  assert.equal((await f.house.getTool('2001',{context})).id,2001);
  assert.equal((await f.house.getTool('react/stamp-original',{context})).id,2001);
  const composite=await f.house.runTool({key:'react/compose',context});
  assert.equal(composite.result.marker,'kit');assert.equal(composite.tasks.length,2);
  assert.equal(composite.tasks[1].execution.parent_execution_id,composite.execution.execution_id);
  const tracking=JSON.parse(await readFile(composite.tasks[1].tracking_file,'utf8'));
  assert.equal(tracking.tool.toolkit.id,1000);assert.equal(tracking.tool.source,'project');
  const saved=JSON.parse(await readFile(composite.tracking_file,'utf8'));
  assert.equal(saved.status,'completed');assert.equal(saved.tool.id,2003);
  assert.equal(composite.result.selected.id,2002);
  await updateToolkitLink({root:f.root,directory:f.kit,remove:true});
  await assert.rejects(f.house.runTool({key:'new-widget',context}),{code:'TOOL_NOT_FOUND'});
});

test('local project overrides stay contained and working beside linked toolkits',async t=>{
  const f=await fixture(t),projectRoot=path.join(f.temp,'project');
  await f.add(f.root,'react/stamp-original',2101,{stamp:true});
  await f.add(projectRoot,'react/stamp-local',2102,{stamp:true});
  await json(path.join(f.root,'PATHS.json'),{stamps:{'new-widget':{id:2101,path:'react/stamp-original'}}});
  await json(path.join(projectRoot,'PATHS.json'),{stamps:{'new-widget':{id:2102,path:'tools/react/stamp-local'}}});
  await f.link();
  const context={project:{root:projectRoot},rab_home:f.rabHome};
  assert.equal((await f.house.getTool('new-widget',{context})).id,2102);
  await json(path.join(projectRoot,'PATHS.json'),{stamps:{'new-widget':{id:2102,path:'../kit/tools/react/stamp-local'}}});
  await assert.rejects(f.house.getTool('new-widget',{context}),{code:'BAD_PATHS'});
});

test('duplicate IDs and full paths quarantine all contenders, including the house tool',async t=>{
  const f=await fixture(t);
  await f.add(f.root,'react/duplicate',3001);await f.add(f.kit,'react/duplicate',3002);
  await f.add(f.root,'react/first',3003);await f.add(f.kit,'react/second',3003);
  await f.link();const result=await f.house.listTools();assert.deepEqual(result.items,[]);
  assert.equal(result.unavailable.filter(item=>item.code==='DUPLICATE_TOOL_PATH').length,2);
  assert.equal(result.unavailable.filter(item=>item.code==='DUPLICATE_TOOL_ID').length,2);
  assert.ok(result.unavailable.some(item=>item.toolkit?.id===1000));
  await assert.rejects(f.house.getTool('react/duplicate'),{code:'TOOL_NOT_FOUND'});
  await assert.rejects(f.house.getTool('3003'),{code:'TOOL_NOT_FOUND'});
});

test('derived alias collision remains ambiguous across kits, with explicit identity available',async t=>{
  const f=await fixture(t),second=path.join(f.temp,'second');await f.addKit(second,1001);
  await f.add(f.kit,'react/inspect/item',3101);await f.add(second,'css/inspect/item',3102);
  await f.link();await updateToolkitLink({root:f.root,directory:second});
  await assert.rejects(f.house.getTool('inspect-item'),{code:'AMBIGUOUS_PATH'});
  assert.equal((await f.house.getTool('3102')).toolkit.id,1001);
});

test('disabled/missing/malformed links are explicit, cache refresh works, and unrelated fixtures never inherit links',async t=>{
  const f=await fixture(t);await f.add(f.kit,'react/example',3201);
  await f.house.listTools();await f.link();assert.deepEqual((await f.house.listTools()).items,[]);
  assert.equal((await f.house.listTools({fresh:true})).items.length,1);
  const isolated=path.join(f.temp,'isolated');await mkdir(path.join(isolated,'tools'),{recursive:true});
  assert.deepEqual((await createToolHouse({root:isolated}).listTools()).items,[]);
  await json(path.join(f.root,'TOOLKITS.json'),{version:'toolkit-links/v1',toolkits:[{path:path.join(f.temp,'missing'),enabled:false}]});
  assert.deepEqual((await f.house.listTools({fresh:true})).unavailable,[]);
  await json(path.join(f.root,'TOOLKITS.json'),{version:'toolkit-links/v1',toolkits:[{path:path.join(f.temp,'missing')}]});
  assert.equal((await f.house.listTools({fresh:true})).unavailable.length,1);
  await writeFile(path.join(f.root,'TOOLKITS.json'),'not JSON');
  assert.equal((await f.house.listTools({fresh:true})).unavailable[0].key,'TOOLKITS.json');
  await json(path.join(f.root,'TOOLKITS.json'),{version:'unsupported',toolkits:[]});
  assert.equal((await f.house.listTools({fresh:true})).unavailable[0].code,'BAD_TOOLKITS');
});

test('link writes are idempotent and duplicate canonical roots are diagnosed without double scanning',async t=>{
  const f=await fixture(t);await f.add(f.kit,'react/example',3301);
  await f.link();await f.link();
  assert.equal(JSON.parse(await readFile(path.join(f.root,'TOOLKITS.json'),'utf8')).toolkits.length,1);
  await json(path.join(f.root,'TOOLKITS.json'),{version:'toolkit-links/v1',toolkits:[{path:f.kit},{path:f.kit}]});
  const result=await f.house.listTools();assert.equal(result.items.length,1);assert.equal(result.unavailable[0].code,'DUPLICATE_TOOLKIT_ROOT');
});

test('contract and template root escapes never become runnable',async t=>{
  const f=await fixture(t);
  const tool=await f.add(f.kit,'react/example',3401);
  await json(path.join(f.kit,'outside.json'),{version:'tool-contract/v1',result:{marker:'string'}});
  await json(path.join(tool,'contract.json'),{version:'tool-contract/v1',extends:'../../../outside.json'});
  const stamp=await f.add(f.kit,'react/stamp-linked',3402,{stamp:true});
  const target=path.join(f.temp,'kit-sibling');await mkdir(target);
  const template=path.join(stamp,'template');assert.ok(template.startsWith(f.temp+path.sep));await rm(template,{recursive:true});
  await symlink(target,template,process.platform==='win32'?'junction':'dir');
  await f.link();const result=await f.house.listTools();assert.deepEqual(result.items,[]);
  assert.ok(result.unavailable.some(item=>item.code==='BAD_TOOL_CONTRACT'));
  assert.ok(result.unavailable.some(item=>item.key==='react/stamp-linked'&&item.code==='INVALID_PATH'));
});

test('catalog service includes a fresh linked toolkit without initializing project memory',async t=>{
  const f=await fixture(t),workbench=createWorkbench({root:f.root,rabHome:f.rabHome});
  assert.deepEqual((await workbench.toolsList()).items,[]);
  await f.add(f.kit,'react/example',3501);await f.link();
  const result=await workbench.toolsList();assert.equal(result.items[0].id,3501);assert.equal(result.items[0].source,'toolkit');
  assert.ok(!(await readdir(f.temp)).includes('memory'));
});

test('project-only custom_toolkit_path never leaks across A, B, no project, and A again',async t=>{
  const f=await fixture(t),second=path.join(f.temp,'second'),a=path.join(f.temp,'a'),b=path.join(f.temp,'b');
  await f.addKit(second,1100);await f.add(f.kit,'react/only-a',4101);await f.add(second,'react/only-b',4102);
  await json(path.join(a,'settings.json'),{name:'a',custom_toolkit_path:f.kit});
  await json(path.join(b,'settings.json'),{name:'b',custom_toolkit_path:second});
  for(const [projectRoot,expected] of [[a,4101],[b,4102],[null,null],[a,4101]]){
    const context=projectRoot?{project:{root:projectRoot}}:{};
    const catalog=await f.house.listTools({context});
    assert.deepEqual(catalog.items.map(item=>item.id),expected?[expected]:[]);
    const other=expected===4101?4102:4101;
    await assert.rejects(f.house.getTool(String(other),{context}),{code:'TOOL_NOT_FOUND'});
  }
  await f.link();
  const deduped=await f.house.listTools({fresh:true,context:{project:{root:a}}});
  assert.equal(deduped.items.length,1);assert.deepEqual(deduped.unavailable,[]);
  await updateToolkitLink({root:f.root,directory:f.kit,remove:true});
  await json(path.join(a,'settings.json'),{custom_toolkit_path:null});
  assert.deepEqual((await f.house.listTools({fresh:true,context:{project:{root:a}}})).items,[]);
});

test('duplicate toolkit identities quarantine every root regardless of link order',async t=>{
  const f=await fixture(t),second=path.join(f.temp,'second');await f.addKit(second,1000);
  await f.add(f.kit,'react/one',4201);await f.add(second,'react/two',4202);
  for(const roots of [[f.kit,second],[second,f.kit]]){
    await json(path.join(f.root,'TOOLKITS.json'),{version:'toolkit-links/v1',toolkits:roots.map(directory=>({path:directory}))});
    const result=await f.house.listTools({fresh:true});assert.deepEqual(result.items,[]);
    assert.equal(result.unavailable.filter(item=>item.code==='DUPLICATE_TOOLKIT_ID').length,2);
  }
});

test('unlink follows the same canonical root as link, and disconnected roots can be disabled',async t=>{
  const f=await fixture(t),alias=path.join(f.temp,'kit-alias');
  await symlink(f.kit,alias,process.platform==='win32'?'junction':'dir');
  await updateToolkitLink({root:f.root,directory:alias});
  await updateToolkitLink({root:f.root,directory:alias,remove:true});
  assert.equal(JSON.parse(await readFile(path.join(f.root,'TOOLKITS.json'),'utf8')).toolkits.length,0);
  const gone=path.join(f.temp,'gone');
  await json(path.join(f.root,'TOOLKITS.json'),{version:'toolkit-links/v1',toolkits:[{path:gone}]});
  await updateToolkitLink({root:f.root,directory:gone,enabled:false});
  assert.deepEqual((await f.house.listTools({fresh:true})).unavailable,[]);
});

test('rejecting the 65th link preserves the original config bytes',async t=>{
  const f=await fixture(t),file=path.join(f.root,'TOOLKITS.json');
  await json(file,{version:'toolkit-links/v1',toolkits:Array.from({length:64},(_,i)=>({path:path.join(f.temp,'disabled-'+i),enabled:false}))});
  const before=await readFile(file,'utf8');
  await assert.rejects(f.link(),{code:'BAD_TOOLKITS'});assert.equal(await readFile(file,'utf8'),before);
});

test('Box chat, search and preview honor project override; generated project stores an external toolkit path',async t=>{
  const f=await fixture(t),actualRoot=path.dirname(path.dirname(fileURLToPath(import.meta.url))),projectRoot=path.join(f.temp,'controller');
  const tool=await f.add(f.kit,'react/projects/stamp-custom',5101,{stamp:true,fields:[{name:'name',type:'text',required:true},{name:'folder',type:'folder',required:true}],script:'export const run=async({helpers})=>helpers.runProjectStamp();'});
  const settingsFile=path.join(tool,'settings.json'),settings=JSON.parse(await readFile(settingsFile,'utf8'));
  settings.description='Creates a React project.';settings.meta={domain:'react',operation:'create',target_type:'project',authority:'write'};await json(settingsFile,settings);
  await json(path.join(tool,'template/settings.json'),{id:'__PROJECT_ID__',name:'__PROJECT_NAME__',type:'react'});
  await json(path.join(tool,'template/PATHS.json'),{project:{id:'__PROJECT_ID__',name:'__PROJECT_NAME__'},stamps:{},tools:{},catalogs:{}});
  await writeFile(path.join(tool,'template/marker.txt'),'external project template');
  const memory=createRabMemory({rabHome:f.rabHome}),id=await memory.allocateId(),meta={id,name:'controller',root:projectRoot};
  await json(path.join(projectRoot,'settings.json'),{name:'controller',type:'react',custom_toolkit_path:f.kit});
  await json(path.join(projectRoot,'PATHS.json'),{project:{id,name:'controller'},stamps:{'new-react-project':{id:5101,path:'react/projects/stamp-custom',toolkit:1000}},tools:{},catalogs:{}});
  const house=createToolHouse({root:actualRoot}),context={project:meta,rab_home:f.rabHome};
  const found=await house.findTools({query:'create react project',context,domain:'react'});
  assert.equal(found.items[0].id,5101);assert.ok(!found.items.some(item=>item.id===1790000000300));
  const workbench=createToolWorkbench({toolHouse:house,project:await loadProject(projectRoot),context});
  const preview=await workbench.prepare({mode:'command',capability:'new-react-project',options:{name:'preview-app',folder:f.temp}});
  assert.equal(preview.status,'ready');assert.equal(preview.ticket.capability,'new-react-project');
  assert.equal(preview.frames[0].script,path.join(tool,'stamp-custom.mjs'));
  const app=createWorkbench({root:actualRoot,rabHome:f.rabHome});
  let session=await memory.createSession(meta),sessionId=session.id,result;
  for(const text of ['new project','react','chat-app',f.temp,'no','yes']){
    result=await app.sessionTurn({session_id:sessionId,text});sessionId=result.session_id;
  }
  assert.equal(result.bag.project.name,'chat-app');
  const generated=path.join(f.temp,'chat-app');
  assert.equal(await readFile(path.join(generated,'marker.txt'),'utf8'),'external project template');
  assert.equal(JSON.parse(await readFile(path.join(generated,'settings.json'),'utf8')).custom_toolkit_path,f.kit);
  const catalog=await app.toolsList({session_id:sessionId});assert.ok(catalog.items.some(item=>item.id===5101));
});

test('a child refreshing the catalog sees a newly added seed during the same runner turn',async t=>{
  const f=await fixture(t);
  await f.add(f.kit,'react/refresh-parent',6101,{script:`import {mkdir,writeFile} from 'node:fs/promises';import path from 'node:path';
    export const run=async({tool,helpers})=>{
      await helpers.listTools();
      const directory=path.join(tool.toolkit.toolsRoot,'react/components/seed/stamp-late');await mkdir(path.join(directory,'template'),{recursive:true});
      await writeFile(path.join(directory,'settings.json'),JSON.stringify({id:6102,name:'stamp-late',title:'Late',description:'Added during a turn',settings:[],meta:{authority:'read',seed:true}}));
      await writeFile(path.join(directory,'stamp-late.mjs'),'export const run=async()=>({marker:"late-seed"});');
      const refreshed=await helpers.listTools({fresh:true});
      const child=await helpers.runTool({key:'6102'});
      return {visible:refreshed.items.some(item=>item.id===6102),marker:child.result.marker};
    };`});
  await f.link();const result=await f.house.runTool({key:'react/refresh-parent',context:{rab_home:f.rabHome}});
  assert.deepEqual(result.result,{visible:true,marker:'late-seed'});assert.equal(result.tasks.length,2);
});

test('malformed external input declarations cannot become executable catalog entries',async t=>{
  const f=await fixture(t);
  await f.add(f.kit,'react/duplicates',6201,{fields:[{name:'folder',type:'folder'},{name:'folder',type:'text'}]});
  await f.add(f.kit,'react/unknown-type',6202,{fields:[{name:'folder',type:'guess'}]});
  await f.add(f.kit,'react/unsafe-key',6203,{fields:[{name:'constructor',type:'text'}]});
  await f.link();const result=await f.house.listTools();assert.equal(result.items.length,0);
  assert.equal(result.unavailable.length,3);assert.ok(result.unavailable.every(item=>item.code==='BAD_TOOL'));
});

test('project aliases also retain the shadowed identity of an automatically derived house address',async t=>{
  const f=await fixture(t),projectRoot=path.join(f.temp,'project');
  await f.add(f.root,'react/find/widget',6301);await f.add(f.kit,'react/find/custom-widget',6302);await f.link();
  await json(path.join(projectRoot,'PATHS.json'),{tools:{'find-widget':{id:6302,path:'react/find/custom-widget',toolkit:1000}}});
  const packed=await f.house.pathsRegistry.pack({projectRoot});
  assert.deepEqual(packed.tools['find-widget'].shadowed,{id:6301,path:'react/find/widget',source:'house'});
  assert.equal((await f.house.getTool('find-widget',{context:{project:{root:projectRoot}}})).id,6302);
});
