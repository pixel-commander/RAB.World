import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { createUsageLedger, wordId } from '../bridge/usage-ledger.mjs';
import { createToolHouse } from '../bridge/tool-house.mjs';
import { startServer } from '../server.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
const temp=async t=>{const dir=await mkdtemp(path.join(os.tmpdir(),'rab-health-'));t.after(()=>rm(dir,{recursive:true,force:true}));return dir;};

test('usage ledger rolls up stable-id capability use, losses, questions and known words',async t=>{
  const rabHome=await temp(t),project=await temp(t),meta={id:'health-proj',name:'Health Project',root:project};
  const ledger=createUsageLedger({rabHome});
  const at=new Date().toISOString();
  await ledger.appendMany(meta,[
    {at,type:'capability-use',subject:{type:'tool',id:101,address:'find-folder',path:'base/find/folder'},auto:true,status:'completed',outcome:'success'},
    {at,type:'capability-use',subject:{type:'tool',id:101,address:'find-folder',path:'base/find/folder'},auto:true,status:'completed',outcome:'success'},
    {at,type:'loss',kind:'missing-seat',seat:'components_path',subject:{type:'stamp',id:202,address:'add-component'},status:'blocked'},
    {at,type:'question',kind:'fill-seat',seat:'components_path',subject:{type:'stamp',id:202,address:'add-component'},prompt:'Where are components stored?'},
    {at,type:'loss-resolved',kind:'missing-seat',seat:'components_path',resolved:true},
    {at,type:'word-use',subject:{type:'word',id:wordId('component'),form:'component'},seat:'target_type',outcome:'success'}
  ]);
  const health=await ledger.summarize(meta);
  assert.equal(health.events,6);
  const find=health.entities.find(x=>x.subject?.id===101);
  assert.equal(find.total,2);assert.equal(find.auto,2);assert.equal(find.last_used,at);
  assert.equal(health.losses.find(x=>x.kind==='missing-seat').resolved,1);
  assert.equal(health.questions.find(x=>x.kind==='fill-seat').total,1);
  assert.equal(health.words[0].form,'component');
});

test('tool runner emits stable-id usage without promoting unknown vocabulary',async t=>{
  const rabHome=await temp(t),project=await temp(t);await mkdir(path.join(project,'src'),{recursive:true});await writeFile(path.join(project,'src','x.ts'),'export const x = 1;\n');
  const ledger=createUsageLedger({rabHome});const house=createToolHouse({root,usageLedger:ledger});
  await house.runTool({key:'find-file',options:{folder:project,name:'x.ts'},context:{rab_home:rabHome,project:{id:'p1',name:'P1',root:project},__rab_telemetry:{session_id:'s1',turn_id:'turn-1',step_id:'step-1'}}});
  const health=await ledger.summarize({id:'p1',name:'P1',root:project});
  const tool=health.entities.find(x=>x.subject?.address==='find-file');
  assert.ok(tool);assert.equal(tool.total,1); // one invocation = one use; start is chronology only
  assert.equal(health.words.length,0);
});

test('server exposes read-only health rollup',async t=>{
  const rabHome=await temp(t);const app=await startServer({root,port:0,rabHome});t.after(()=>app.close());
  const session=await fetch(`${app.origin}/api/session`).then(r=>r.json());
  const response=await fetch(`${app.origin}/api/health`,{headers:{'X-Magic-Token':session.token}});
  assert.equal(response.status,200);const body=await response.json();assert.equal(body.version,'house-health/v0.8.5');assert.ok(Array.isArray(body.entities));
});


test('terminal states track non-completion and reconcile interrupted tasks',async t=>{
  const rabHome=await temp(t),project=await temp(t),meta={id:'terminal-proj',name:'Terminal Project',root:project};
  const ledger=createUsageLedger({rabHome});
  await ledger.appendMany(meta,[
    {type:'capability-start',task_id:'task-1',subject:{type:'tool',id:1,address:'add-component'},status:'started'},
    {type:'terminal',task_id:'task-2',subject:{type:'tool',id:2,address:'delete-file'},terminal_state:'user-opt-out',reason:{code:'USER_DECLINED_CONFIRMATION'}},
    {type:'terminal',task_id:'task-3',subject:{type:'tool',id:3,address:'find-file'},terminal_state:'blocked',reason:{code:'INPUT_REQUIRED'}}
  ]);
  const repaired=await ledger.reconcileOpenTasks(meta);assert.equal(repaired.length,1);assert.equal(repaired[0].terminal_state,'interrupted');
  const health=await ledger.summarize(meta);
  assert.equal(health.open_tasks.length,0);
  assert.equal(health.terminal_states.find(x=>x.state==='interrupted').total,1);
  assert.equal(health.terminal_states.find(x=>x.state==='user-opt-out').reasons.USER_DECLINED_CONFIRMATION,1);
  assert.equal(health.terminal_states.find(x=>x.state==='blocked').reasons.INPUT_REQUIRED,1);
  assert.equal(health.totals.non_completed,3);
});
