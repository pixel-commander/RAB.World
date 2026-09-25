import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {prepareRecovery,applyRecovery,transformRecord} from '../scripts/reconcile-rab-home.mjs';
import {createRabMemory} from '../bridge/rab-memory.mjs';

const write=async(file,data)=>{await mkdir(path.dirname(file),{recursive:true});await writeFile(file,JSON.stringify(data,null,2)+'\n');};
const read=async file=>JSON.parse(await readFile(file,'utf8'));
const node=(id,name,root)=>({version:'rab-node/v1',id,name,title:name,description:'',settings:[],meta:{kind:'project',source_root:root}});
const session=(id,project)=>({version:'rab-session/v1',id,revision:3,project_key:String(project),bag:{project:{id:project}},groups:[],steps:[],turns:[{text:'Original words',id:1001}],status:'open'});
const fixture=async()=>{
  const root=path.join(os.homedir(),'.rab','temp','test',String(Date.now()));
  await mkdir(root,{recursive:true});
  const source=path.join(root,'misplaced'),target=path.join(root,'canonical'),mock=path.join(root,'mock'),app=path.join(root,'app');
  await mkdir(mock);await mkdir(app);
  await write(path.join(source,'settings.json'),{app_id:22});
  await write(path.join(target,'settings.json'),{app_id:200});
  await write(path.join(source,'id-state.json'),{version:'rab-ids/v1',highWater:10000});
  await write(path.join(target,'id-state.json'),{version:'rab-ids/v1',highWater:20000});
  await write(path.join(source,'project-roots.json'),{version:'rab-project-roots/v1',roots:{[mock.toLowerCase()]:42,[app.toLowerCase()]:63}});
  await write(path.join(target,'project-roots.json'),{version:'rab-project-roots/v1',roots:{[mock.toLowerCase()]:785,[path.join(root,'test').toLowerCase()]:60}});
  for(const [home,id,name,folder] of [[source,42,'Mock',mock],[source,63,'User app',app],[target,785,'Mock',mock],[target,60,'Old test',path.join(root,'test')]])await write(path.join(home,'projects',String(id),'settings.json'),node(id,name,folder));
  await write(path.join(source,'projects','42','sessions','43','state.json'),session(43,42));
  await write(path.join(source,'projects','63','sessions','65','state.json'),{...session(65,63),origin:{source_session_id:43,source_project_key:'42'},steps:[{id:1002,receipt:{session_id:65,tracking_file:path.join(source,'projects','63','runs','65','753.json')}}]});
  await write(path.join(source,'projects','63','sessions','65','settings.json'),{version:'rab-node/v1',id:65,name:'Project start',title:'Project start',description:'',settings:[],meta:{kind:'session',parent:{kind:'project',id:63}}});
  await write(path.join(source,'projects','63','runs','65','753.json'),{session_id:65,project_key:'63',execution_id:753,count:65});
  await write(path.join(source,'projects','63','sessions','65','state.before-history-repair.json'),session(65,63));
  await write(path.join(target,'projects','60','sessions','65','state.json'),session(65,60));
  await write(path.join(source,'apps','22','requests','68','settings.json'),{version:'rab-node/v1',id:68,name:'Existing request',title:'Request',description:'Keep this',settings:[],type:'feature',meta:{kind:'request',parent:{kind:'app',id:22}}});
  return {root,source,target,config:{sourceHome:source,targetHome:target,recoveryId:Date.now(),sessionIds:{65:99},projectIds:{42:785}}};
};

test('recovery preserves both colliding sessions, resumes imported work and exposes its request',async()=>{
  const {source,target,config}=await fixture();
  const original=await readFile(path.join(source,'projects','63','sessions','65','state.json'));
  const conflict=await readFile(path.join(target,'projects','60','sessions','65','state.json'));
  const plan=await prepareRecovery(config);
  await applyRecovery(plan);
  const memory=createRabMemory({rabHome:target});
  const imported=await memory.findSession(99), prior=await memory.findSession(65), mock=await memory.findSession(43);
  assert.equal(imported.meta.id,63);assert.equal(prior.meta.id,60);assert.equal(mock.meta.id,785);
  assert.equal(imported.session.steps[0].receipt.tracking_file,path.join(target,'projects','User app','runs','99','753.json'));
  assert.deepEqual(imported.session.turns,JSON.parse(original).turns);
  assert.deepEqual(imported.session.origin,{source_session_id:43,source_project_key:'42'});
  assert.deepEqual(await readFile(path.join(source,'projects','63','sessions','65','state.json')),original);
  assert.deepEqual(await readFile(path.join(target,'projects','60','sessions','65','state.json')),conflict);
  assert.deepEqual(await readFile(path.join(plan.backup,'original','projects','63','sessions','65','state.json')),original);
  assert.equal((await read(path.join(target,'projects','User app','runs','99','753.json'))).count,65);
  assert.equal((await read(path.join(target,'projects','User app','sessions','99','state.before-history-repair.json'))).id,65);
  assert.equal((await memory.listRequests()).items[0].name,'Existing request');
  await assert.rejects(applyRecovery(plan),/already applied/);
});

test('recovery refuses changed source before touching the destination registry',async()=>{
  const {source,target,config}=await fixture();
  const before=await readFile(path.join(target,'project-roots.json'));
  const plan=await prepareRecovery(config);
  await write(path.join(source,'projects','63','sessions','65','state.json'),session(65,63));
  await assert.rejects(applyRecovery(plan),/Source changed/);
  assert.deepEqual(await readFile(path.join(target,'project-roots.json')),before);
});

test('reference transformation leaves user text, provenance and ordinary numbers unchanged',()=>{
  const old=path.resolve('old'),next=path.resolve('new');
  const before={session_id:65,count:65,text:path.join(old,'file'),origin:{session_id:65},result:{file:path.join(old,'file')},tasks:[{execution:{session_id:65}}]};
  const after=transformRecord(before,{ids:new Map([['65',99]]),paths:[[old,next]]});
  assert.equal(after.session_id,99);assert.equal(after.tasks[0].execution.session_id,99);
  assert.equal(after.count,65);assert.equal(after.text,before.text);assert.deepEqual(after.origin,before.origin);
  assert.equal(after.result.file,path.join(next,'file'));
});
