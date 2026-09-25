import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,cp} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {pathValue,withPathValue} from '../bridge/project-paths.mjs';
import {readInventory,updateInventory} from '../tools/base/_inventory.mjs';
import {createSeatParser} from '../bridge/seat-parser.mjs';
import {createToolHouse} from '../bridge/tool-house.mjs';
import {createSessionPlanner} from '../bridge/session-planner.mjs';
import {createRabMemory} from '../bridge/rab-memory.mjs';
import {getProjectWatcher} from '../tools/base/watch/watch.mjs';
import {makeItemSettings} from '../bridge/rab-node.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const put=(file,value)=>writeFile(file,JSON.stringify(value,null,2)+'\n');
const fixture=async(t,paths={components:'src/components',pages:'src/pages'})=>{
  const parent=path.join(os.homedir(),'.rab','temp','test');await mkdir(parent,{recursive:true});
  const temp=await mkdtemp(path.join(parent,'inventory-flow-'));
  const source=path.join(temp,'source'),catalog=path.join(temp,'catalog');
  await mkdir(source,{recursive:true});
  for(const folder of ['src/components','src/pages','src/atoms'])await mkdir(path.join(source,folder),{recursive:true});
  const memory=createRabMemory({rabHome:path.join(temp,'memory')});
  const project={id:await memory.allocateId(),name:'Inventory fixture',root:source};
  await put(path.join(source,'settings.json'),{id:project.id,name:project.name,type:'base',paths});
  await put(path.join(source,'PATHS.json'),{project:{id:project.id,name:project.name},tools:{},stamps:{},catalogs:{}});
  await memory.registerProject(project);
  const context={project,rab_home:memory.rabHome};
  t.after(()=>getProjectWatcher({rabHome:memory.rabHome}).close());
  // Real definitions and executors, in a small isolated catalog. Full installed
  // catalog discovery is checked separately, not repeated for every chat turn.
  for(const key of ['base/find/inventory','project/add/paths','project/remove/paths']){
    const folder=path.join(catalog,'tools',key);await mkdir(folder,{recursive:true});
    await cp(path.join(root,'tools',key,'settings.json'),path.join(folder,'settings.json'));
    const owner=key==='base/find/inventory'?'base/find/inventory/inventory.mjs':key.startsWith('project/add/')?'project/add/add.mjs':'project/remove/remove.mjs';
    await writeFile(path.join(folder,path.basename(key)+'.mjs'),'export {run} from '+JSON.stringify(pathToFileURL(path.join(root,'tools',owner)).href)+';\n');
  }
  await cp(path.join(root,'language'),path.join(catalog,'language'),{recursive:true});
  const planner=await createSessionPlanner({root:catalog,projectRoot:source,project:{...project,manifest:{project:{name:project.name}}},languageRoot:path.join(catalog,'language'),rabHome:memory.rabHome});
  const item=async(relative,extras={})=>{
    const folder=path.join(source,relative);await mkdir(folder,{recursive:true});
    const value=makeItemSettings({id:await memory.allocateId(),name:path.basename(folder),title:path.basename(folder),description:'',settings:[],meta:{},...extras});
    await put(path.join(folder,'settings.json'),value);return value;
  };
  return {source,catalog,context,memory,planner,item};
};
const gap=state=>state.current_steps[0]?.gaps.configuration[0];

test('path metadata and inventory phrases use global project keys',async()=>{
  assert.equal(pathValue('src/components'),'src/components');
  assert.deepEqual(withPathValue({path:'old',description:'Shared',types:['action']},'new'),{path:'new',description:'Shared',types:['action']});
  const parser=await createSeatParser({languageRoot:path.join(root,'language')});
  for(const text of ['list components','find components','scan components','scan for components','list atoms','find page','list widgets']){
    const frame=parser.parse(text,{context:{paths:{widgets:'widgets'}}}).frames[0];
    assert.equal(frame.seats.target_type,'inventory',text);assert.equal(frame.seats.operation,'find',text);assert.equal(frame.completeLanguage,true,text);
  }
  for(const text of ['list projects','list tools','list sessions'])assert.notEqual(parser.parse(text).frames[0].seats.target_type,'inventory',text);
});

test('configured path asks to attach once, resumes lookup, and distinguishes empty manifests',async t=>{
  const f=await fixture(t);const card=await f.item('src/components/Card');
  let state=await f.planner.newSession();const sessionId=state.session_id;
  state=await f.planner.turn({sessionId,text:'list components'});
  assert.equal(state.current_steps[0].capability.house.key,'base/find/inventory');
  assert.equal(gap(state).kind,'project-listener-consent');assert.equal(state.ready_to_confirm,false);
  state=await f.planner.turn({sessionId,text:'yes'});assert.equal(state.ready_to_confirm,true,JSON.stringify(state.current_steps));
  state=await f.planner.execute({sessionId,confirm:true});
  assert.equal(state.current_steps[0].status,'completed');assert.match(state.last_turn.reply,/src\/components\/Card/);
  assert.equal((await readInventory(f.context,'components')).items[0].id,card.id);
  assert.equal((await getProjectWatcher({rabHome:f.memory.rabHome}).list(f.context)).count,1);
  for(const text of ['find components','scan components','scan for components']){
    state=await f.planner.turn({sessionId,text});assert.equal(state.ready_to_confirm,true,text);
    assert.equal(state.current_steps[0].capability.house.key,'base/find/inventory');
    state=await f.planner.execute({sessionId,confirm:true});assert.match(state.last_turn.reply,/Card/);
  }
  await updateInventory(f.context,'pages');
  state=await f.planner.turn({sessionId,text:'list pages'});assert.equal(state.ready_to_confirm,true);
  state=await f.planner.execute({sessionId,confirm:true});assert.match(state.last_turn.reply,/No pages found/);
  assert.match(state.last_turn.reply,/last saved manifest/);
  const resources=await f.memory.loadResources(f.context.project);
  assert.equal(Object.values(resources.components??{}).some(item=>item.source==='project-scan'),false);
});

test('missing path consent and folder answer use saved settings and the shared project tool',async t=>{
  const f=await fixture(t,{atoms:{description:'Shared atoms',types:['action','container']}});
  const atom=await f.item('src/atoms/Surface',{meta:{platform:'html'}});
  const original=await readFile(path.join(f.source,'settings.json'),'utf8');
  let state=await f.planner.newSession();const sessionId=state.session_id;
  state=await f.planner.turn({sessionId,text:'list atoms'});assert.equal(gap(state).kind,'project-path-consent');
  state=await f.planner.turn({sessionId,text:'yes'});assert.equal(gap(state).pathKey,'atoms');
  state=await f.planner.turn({sessionId,text:'src/atoms'});assert.equal(state.ready_to_confirm,true);
  const saved=await f.memory.readProjectSettings(f.context.project);
  assert.deepEqual({description:saved.paths.atoms.description,types:saved.paths.atoms.types,path:saved.paths.atoms.path},{description:'Shared atoms',types:['action','container'],path:'src/atoms'});
  assert.equal(saved.paths.atoms.source,'project/add/paths');assert.ok(saved.paths.atoms.updated_at);
  assert.equal(await readFile(path.join(f.source,'settings.json'),'utf8'),original);
  state=await f.planner.execute({sessionId,confirm:true});assert.match(state.last_turn.reply,/Surface/);
  assert.equal((await readInventory(f.context,'atoms')).items[0].id,atom.id);
  const edited=await f.planner.setProjectPath({key:'atoms',value:'src/atoms',description:'Shared skins',types:['container'],expected:saved.paths.atoms});
  assert.deepEqual({path:edited.paths.atoms.path,description:edited.paths.atoms.description,types:edited.paths.atoms.types},{path:'src/atoms',description:'Shared skins',types:['container']});
  await assert.rejects(f.planner.setProjectPath({key:'atoms',value:'other',expected:saved.paths.atoms}),{code:'STALE_REVISION'});
  await assert.rejects(f.planner.setProjectPath({key:'atoms',value:'../outside'}),{code:'BAD_REQUEST'});
});

test('input panel answers and declines resume or cancel the same inventory action',async t=>{
  const f=await fixture(t);
  let state=await f.planner.newSession();const sessionId=state.session_id;
  state=await f.planner.turn({sessionId,text:'list components'});
  state=await f.planner.answer({sessionId,answers:[{step_id:state.current_steps[0].id,values:{add_listener:false}}]});
  assert.equal(state.current_steps[0].status,'cancelled');assert.equal((await getProjectWatcher({rabHome:f.memory.rabHome}).list(f.context)).count,0);
  state=await f.planner.turn({sessionId,text:'list pages'});
  state=await f.planner.answer({sessionId,answers:[{step_id:state.current_steps[0].id,values:{add_listener:true}}]});assert.equal(state.ready_to_confirm,true);
  await f.planner.execute({sessionId,confirm:true});
  state=await f.planner.turn({sessionId,text:'list atoms'});
  state=await f.planner.answer({sessionId,answers:[{step_id:state.current_steps[0].id,values:{add_path:true}}]});assert.equal(gap(state).pathKey,'atoms');
  state=await f.planner.answer({sessionId,answers:[{step_id:state.current_steps[0].id,values:{'path:atoms':'src/atoms'}}]});assert.equal(state.ready_to_confirm,true);
  await f.planner.execute({sessionId,confirm:true});
  state=await f.planner.turn({sessionId,text:'list widgets'});assert.equal(gap(state).kind,'project-path-consent');
  state=await f.planner.turn({sessionId,text:'no'});assert.equal(state.current_steps[0].status,'cancelled');
  assert.equal(Object.hasOwn((await f.memory.readProjectSettings(f.context.project)).paths,'widgets'),false);
});

test('lookup preserves manifest output and reports unhealthy or stopped listeners',async t=>{
  const f=await fixture(t);const card=await f.item('src/components/Card');
  const house=createToolHouse({root:f.catalog});
  await assert.rejects(house.runTool({key:'project/add/paths',options:{name:'outside',path:'../outside'},context:f.context}),{code:'INVALID_PATH'});
  assert.equal(Object.hasOwn((await f.memory.readProjectSettings(f.context.project)).paths,'outside'),false);
  let output=await house.runTool({key:'base/find/inventory',options:{type:'components'},context:f.context});
  assert.equal(output.result.status,'not-indexed');
  await updateInventory(f.context,'components');
  await writeFile(path.join(f.source,'src/components/Card/settings.json'),'{');
  output=await house.runTool({key:'base/find/inventory',options:{type:'components'},context:f.context});
  assert.equal(output.result.items[0].id,card.id);assert.equal(output.result.index_status,'last-saved');
  const listener=getProjectWatcher({rabHome:f.memory.rabHome});await listener.add(f.context,{type:'components'});
  output=await house.runTool({key:'base/find/inventory',options:{type:'components'},context:f.context});
  assert.equal(output.result.listener_status,'unavailable');assert.ok(output.result.listener_error);
  await listener.close();
  output=await house.runTool({key:'base/find/inventory',options:{type:'components'},context:f.context});
  assert.equal(output.result.listener_status,'stopped');assert.equal(output.result.index_status,'last-saved');
  assert.equal(output.result.items[0].id,card.id);
  const manifest=output.result.manifest;
  await house.runTool({key:'project/remove/paths',options:{name:'components'},context:f.context});
  assert.equal((await getProjectWatcher({rabHome:f.memory.rabHome}).list(f.context)).count,0);
  assert.equal((await readInventory(f.context,'components')).status,'path-required');
  assert.equal(JSON.parse(await readFile(manifest,'utf8')).items[card.id].id,card.id);
});


