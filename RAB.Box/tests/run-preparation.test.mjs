import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm,cp} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createWorkbench} from '../bridge/service.mjs';
import {createToolHouse} from '../bridge/tool-house.mjs';
import {createRabMemory} from '../bridge/rab-memory.mjs';
import {prepareSessionInputs} from '../bridge/run-preparation.mjs';
import {startServer} from '../server.mjs';
import {createSessionPlanner} from '../bridge/session-planner.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const fixture=async (t,{components=true}={})=>{
  const folder=await mkdtemp(path.join(os.tmpdir(),'rab-preparation-'));
  t.after(()=>rm(folder,{recursive:true,force:true,maxRetries:3}));
  const rabHome=path.join(folder,'.rab'),source=path.join(folder,'source');
  await mkdir(source);await writeFile(path.join(source,'sample.css'),'.sample { color: red; }\n');
  const house=createToolHouse({root}),memory=createRabMemory({rabHome}),box=createWorkbench({root,rabHome});
  await box.initialize();
  const project=(await house.runTool({key:'audit/stamp-new-project',options:{name:'Input panel fixture',folder:source},context:{rab_home:rabHome}})).result.project;
  const settingsFile=path.join(project.root,'settings.json');
  const settings=JSON.parse(await readFile(settingsFile,'utf8'));if(components)settings.paths.components='components';
  await writeFile(settingsFile,JSON.stringify(settings));
  const session=await box.projectActivate({project_id:project.id,mode:'new-session',name:'Test session'});
  const turn=(state,text)=>box.sessionTurn({session_id:state.session_id,expected_revision:state.revision,text});
  const answer=(state,answers)=>box.sessionAnswer({session_id:state.session_id,expected_revision:state.revision,answers});
  return {folder,rabHome,source,house,memory,box,project,session,turn,answer};
};
const files=async folder=>{
  const out=[];
  const walk=async dir=>{for(const entry of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())await walk(file);else out.push(path.relative(folder,file));}};
  await walk(folder);return out.sort();
};

test('preparation retains typed values, provenance, enum declarations and dependency states',()=>{
  const step={id:3,status:'input-required',settings:[
    {name:'enabled',type:'boolean',required:true},
    {name:'count',type:'number',required:true},
    {name:'note',type:'text'},
    {name:'parent',type:'folder',required:true},
    {name:'mode',type:'text',enum:['small','large'],required:true}
  ],options:{enabled:{value:false,status:'resolved',source:'answer'},count:{value:0,status:'resolved'},note:{value:'',status:'resolved'},parent:{value:'future',status:'pending-dependency'}},gaps:{requiredInputs:[{field:'mode',question:'Choose mode'}]}};
  const view=prepareSessionInputs({id:1,revision:2},{id:2,status:'open'},[step],false);
  assert.equal(view.steps[0].settings[0].value,false);
  assert.equal(view.steps[0].settings[1].value,0);
  assert.equal(view.steps[0].settings[2].value,'');
  assert.equal(view.steps[0].settings[3].status,'pending-dependency');
  assert.equal(view.steps[0].settings[3].editable,false);
  assert.deepEqual(view.steps[0].settings[4].enum,['small','large']);
  assert.equal(view.steps[0].settings[4].editable,true);
  const cancelled=prepareSessionInputs({id:1,revision:3},{id:2,status:'cancelled'},[{...step,status:'cancelled',gaps:{}}],false);
  assert.equal(cancelled.status,'cancelled');assert.ok(cancelled.steps[0].settings.every(field=>!field.editable));
  const failed=prepareSessionInputs({id:1,revision:3},{id:2,status:'open'},[{...step,status:'execution-failed'}],false);
  assert.equal(failed.status,'failed');
  const completed=prepareSessionInputs({id:1,revision:4},{id:2,status:'completed'},[{...step,status:'completed',receipt:{id:99,duration_ms:0,steps:[{result:{huge:'payload'},result_file:'saved.json'}]}}],false);
  assert.equal(completed.steps[0].receipt.duration_ms,0);
  assert.equal(completed.steps[0].receipt.steps[0].result_file,'saved.json');
  assert.equal(Object.hasOwn(completed.steps[0].receipt.steps[0],'result'),false);
});

test('one panel resolves multiple queued tools, preserves session history and never executes on submit',async t=>{
  const f=await fixture(t);
  let state=await f.turn(f.session,'create component then create component');
  assert.equal(state.current_steps.length,2);
  assert.ok(state.preparation.steps.every(step=>step.settings.some(field=>field.name==='name'&&field.editable)));
  const before=await files(f.project.root);
  state=await f.box.sessionYolo({session_id:state.session_id,expected_revision:state.revision,enabled:true});
  state=await f.answer(state,state.current_steps.map(step=>({step_id:step.id,values:{name:'Sample'}})));
  assert.equal(state.ready_to_confirm,true);
  assert.equal(state.preparation.status,'ready');
  assert.ok(state.current_steps.every(step=>step.status==='ready'&&!step.receipt));
  assert.equal(state.last_turn.mode,'answer');assert.equal(state.last_turn.answers.length,2);
  const after=await files(f.project.root);
  assert.deepEqual(after.filter(file=>/^(runs|audit-results)[\\/]/.test(file)),before.filter(file=>/^(runs|audit-results)[\\/]/.test(file)));
  assert.equal(await readFile(path.join(f.source,'sample.css'),'utf8'),'.sample { color: red; }\n');
  const resumed=await f.box.sessionRead(state.session_id);
  assert.equal(resumed.preparation.steps[0].settings.find(field=>field.name==='name').value,'Sample');
  // The existing executor, with explicit confirmation, remains the sole owner.
  const done=await f.box.sessionExecute({session_id:state.session_id,expected_revision:state.revision,confirm:true});
  assert.ok(done.current_steps.every(step=>step.status==='completed'&&step.receipt));
});

test('invalid multi-step submissions are atomic and stale/foreign fields cannot be applied',async t=>{
  const f=await fixture(t),state=await f.turn(f.session,'create component then create component');
  const [a,b]=state.current_steps;
  await assert.rejects(()=>f.answer(state,[{step_id:a.id,values:{name:'Sample'}},{step_id:b.id,values:{name:23}}]),{code:'INVALID_INPUT'});
  let saved=await f.box.sessionRead(state.session_id);
  assert.equal(saved.revision,state.revision);assert.equal(saved.current_steps[0].options.name.value,null);
  await assert.rejects(()=>f.answer(state,[{step_id:a.id,values:{made_up:'x'}}]),{code:'BAD_REQUEST'});
  await assert.rejects(()=>f.answer(state,[{step_id:1,values:{name:'x'}}]),{code:'PLAN_GAPS'});
  saved=await f.answer(state,[{step_id:a.id,values:{name:'Sample'}}]);
  assert.equal(saved.ready_to_confirm,false);
  await assert.rejects(()=>f.answer(state,[{step_id:b.id,values:{name:'Sample'}}]),{code:'SESSION_CONFLICT'});
  await assert.rejects(()=>f.box.sessionAnswer({session_id:saved.session_id,answers:[]}),{code:'BAD_REQUEST'});
});

test('ready component fields can be revised through the same plan before explicit execution',async t=>{
  const f=await fixture(t);
  let state=await f.turn(f.session,'create component InitialPanel');
  assert.equal(state.ready_to_confirm,true);
  const step_id=state.current_steps[0].id;
  for(const name of ['name','location','class_name','save_as_text'])assert.equal(state.preparation.steps[0].settings.find(field=>field.name===name).editable,true,name);
  state=await f.answer(state,[{step_id,values:{name:'RevisedPanel',class_name:'',save_as_text:false}}]);
  assert.equal(state.current_steps[0].id,step_id);assert.equal(state.ready_to_confirm,true);
  assert.equal(state.current_steps[0].options.name.value,'RevisedPanel');assert.equal(state.current_steps[0].options.class_name.value,'');assert.equal(state.current_steps[0].options.save_as_text.value,false);
  assert.equal(state.bag.sessionResources.InitialPanel,undefined);
  assert.equal(state.bag.currentTarget.name,'RevisedPanel');
  assert.equal((await files(f.project.root)).some(file=>file.includes('RevisedPanel.tsx')),false);
  const before=state.revision;
  await assert.rejects(()=>f.answer(state,[{step_id,values:{name:''}}]),{code:'INVALID_INPUT'});
  assert.equal((await f.box.sessionRead(state.session_id)).revision,before);
  const done=await f.box.sessionExecute({session_id:state.session_id,expected_revision:state.revision,confirm:true});
  assert.equal(done.current_steps[0].status,'completed');
  const generated=await files(f.project.root);
  assert.ok(generated.some(file=>file.endsWith('RevisedPanel.tsx')));
  assert.equal(generated.some(file=>file.includes('InitialPanel')),false);
  await assert.rejects(()=>f.answer(done,[{step_id,values:{name:'TooLate'}}]),{code:'PLAN_GAPS'});
});

test('revising a planned parent updates its child without keeping the obsolete resource',async t=>{
  const f=await fixture(t);
  let state=await f.turn(f.session,'create component FirstPanel then create component ChildPanel');
  const [parent,child]=state.current_steps;
  assert.equal(state.ready_to_confirm,true);
  state=await f.answer(state,[{step_id:parent.id,values:{name:'RenamedPanel'}}]);
  assert.equal(state.bag.sessionResources.FirstPanel,undefined);
  assert.match(state.current_steps[1].plannedResult.path,/RenamedPanel/);
  assert.doesNotMatch(state.current_steps[1].plannedResult.path,/FirstPanel/);
  assert.equal(state.current_steps[1].id,child.id);
});

test('nevermind cancels all pending panel steps and rejects a late answer',async t=>{
  const f=await fixture(t),pending=await f.turn(f.session,'create component then create component');
  const cancelled=await f.turn(pending,'nevermind');
  assert.equal(cancelled.preparation.status,'cancelled');
  assert.ok(cancelled.current_steps.every(step=>step.status==='cancelled'));
  await assert.rejects(()=>f.answer(cancelled,[{step_id:pending.current_steps[0].id,values:{name:'Sample'}}]),{code:'PLAN_GAPS'});
  assert.equal((await f.box.sessionRead(cancelled.session_id)).last_turn.mode,'cancel');
});

test('Chat and panel answers resolve the same queued Steps',async t=>{
  const f=await fixture(t),pending=await f.turn(f.session,'create component then create component');
  const partial=await f.answer(pending,[{step_id:pending.current_steps[0].id,values:{name:'PanelParent'}}]);
  assert.equal(partial.ready_to_confirm,false);
  const complete=await f.turn(partial,'ChatChild');
  assert.equal(complete.ready_to_confirm,true);
  assert.equal(complete.preparation.steps[0].settings.find(field=>field.name==='name').value,'PanelParent');
  assert.equal(complete.preparation.steps[1].settings.find(field=>field.name==='name').value,'ChatChild');
});

test('project path answers validate before saving and re-resolve all affected steps',async t=>{
  const f=await fixture(t,{components:false}),file=path.join(f.project.root,'settings.json');
  const pending=await f.turn(f.session,'create component');
  const step_id=pending.current_steps[0].id;
  assert.ok(pending.preparation.steps[0].settings.some(field=>field.name==='path:components'&&field.editable));
  const before=await readFile(file,'utf8');
  for(const value of ['C:\\outside','\\outside','/outside','C:outside','../outside',' /outside',' \\outside']){
    await assert.rejects(()=>f.answer(pending,[{step_id,values:{name:'Safe','path:components':value}}]),{code:'INVALID_INPUT'});
    assert.equal(await readFile(file,'utf8'),before);
  }
  const ready=await f.answer(pending,[{step_id,values:{name:'Safe','path:components':'components'}}]);
  assert.equal(ready.ready_to_confirm,true);
  assert.deepEqual(JSON.parse(await readFile(file,'utf8')).paths.components,{path:'components',description:''});
  assert.equal(ready.current_steps[0].options.location.value,path.join(f.project.root,'components'));
});

test('declared numeric, boolean and JSON fields retain their types across partial answers',async t=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'rab-typed-preparation-'));
  t.after(()=>rm(dir,{recursive:true,force:true,maxRetries:3}));
  const toolRoot=path.join(dir,'tools','audit','find','files'),projectRoot=path.join(dir,'project');
  await mkdir(toolRoot,{recursive:true});await mkdir(projectRoot);
  await cp(path.join(root,'language'),path.join(dir,'language'),{recursive:true});
  const settings=[{name:'limit',type:'number',required:true},{name:'enabled',type:'boolean',required:true},{name:'config',type:'json',required:true},{name:'label',type:'text',default:''}];
  await writeFile(path.join(toolRoot,'settings.json'),JSON.stringify({id:9001,name:'files',title:'Find Files',description:'Find files.',settings,meta:{domain:'audit',operation:'find',target_type:'file',authority:'read'}}));
  await writeFile(path.join(toolRoot,'files.mjs'),"export const run = () => { throw new Error('Preparation must not execute this tool'); };\n");
  const project={id:'typed-fixture',manifest:{project:{name:'Typed fixture'}}};
  const planner=await createSessionPlanner({root:dir,projectRoot,project,languageRoot:path.join(dir,'language'),rabHome:path.join(dir,'.rab')});
  const fresh=await planner.newSession();
  let state=await planner.turn({sessionId:fresh.session_id,text:'find files'});
  assert.equal(state.current_steps[0].status,'input-required');
  const step_id=state.current_steps[0].id;
  await assert.rejects(()=>planner.answer({sessionId:state.session_id,answers:[{step_id,values:{enabled:'false',limit:0}}]}),{code:'INVALID_INPUT'});
  state=await planner.answer({sessionId:state.session_id,answers:[{step_id,values:{enabled:false}}]});
  assert.equal(state.ready_to_confirm,false);assert.equal(state.current_steps[0].options.enabled.value,false);
  state=await planner.answer({sessionId:state.session_id,answers:[{step_id,values:{limit:0,config:{enabled:false,list:[]}}}]});
  assert.equal(state.ready_to_confirm,true);
  assert.equal(state.current_steps[0].options.limit.value,0);
  assert.equal(state.current_steps[0].options.label.value,'');
  assert.deepEqual(state.current_steps[0].options.config.value,{enabled:false,list:[]});
});

test('HTTP answer route requires token and current revision, and returns updated requirements',async t=>{
  const f=await fixture(t),pending=await f.turn(f.session,'create component');
  const app=await startServer({root,port:0,rabHome:f.rabHome});
  t.after(()=>app.close());
  const token=(await (await fetch(`${app.origin}/api/session`)).json()).token;
  const body={session_id:pending.session_id,expected_revision:pending.revision,answers:[{step_id:pending.current_steps[0].id,values:{name:'Sample'}}]};
  const post=token=>fetch(`${app.origin}/api/session/answer`,{method:'POST',headers:{'content-type':'application/json',...(token?{'x-magic-token':token}:{})},body:JSON.stringify(body)});
  assert.equal((await post()).status,403);
  const response=await post(token);assert.equal(response.status,200);
  assert.equal((await response.json()).preparation.ready_to_confirm,true);
  assert.equal((await post(token)).status,409);
  const html=await fetch(app.origin).then(response=>response.text());
  assert.match(html,/\/magic-box\/run-preparation\.mjs/);
  const module=await fetch(`${app.origin}/magic-box/run-preparation.mjs`);
  assert.equal(module.status,200);assert.match(module.headers.get('content-type'),/javascript/);
  assert.match(await module.text(),/createRunPreparation/);
});
