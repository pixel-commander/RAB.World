import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { createToolHouse } from '../bridge/tool-house.mjs';
import { createRabMemory } from '../bridge/rab-memory.mjs';
import { createUsageLedger } from '../bridge/usage-ledger.mjs';
import { createWorkbench } from '../bridge/service.mjs';
import { compactReceipt, newExecution } from '../bridge/tool-tracking.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
const json=async file=>JSON.parse(await readFile(file,'utf8'));
const fixture=async t=>{
  const temp=await realpath(await mkdtemp(path.join(os.tmpdir(),'rab-audit-tracking-')));
  t.after(async()=>{
    assert.equal(path.dirname(path.resolve(temp)),await realpath(os.tmpdir()));
    assert.ok(path.basename(temp).startsWith('rab-audit-tracking-'));
    await rm(temp,{recursive:true,force:true});
  });
  const folder=path.join(temp,'source'),rabHome=path.join(temp,'.rab'),toolsRoot=path.join(temp,'tools');
  await mkdir(folder);await writeFile(path.join(folder,'source.txt'),'untouched');
  const memory=createRabMemory({rabHome});
  const id=await memory.allocateId();
  const project={id,name:'Tracking project',root:memory.newProjectPath('Tracking project')};
  await mkdir(project.root,{recursive:true});
  const settings={id:project.id,name:project.name,type:'audit',paths:{folder,results:'audit-results'}};
  const saveSettings=()=>writeFile(path.join(project.root,'settings.json'),JSON.stringify(settings));
  await saveSettings();await memory.openProject(project);await memory.setProjectPath(project,'folder','stale-folder');
  const add=async(name,id,settings,source)=>{
    const dir=path.join(toolsRoot,'probe',name);await mkdir(dir,{recursive:true});
    await writeFile(path.join(dir,'settings.json'),JSON.stringify({id,name,title:name,description:`Tracking test ${name}`,settings,meta:{authority:'read'}}));
    await writeFile(path.join(dir,`${name}.mjs`),source);
  };
  const fields=[{name:'folder',type:'folder',required:true,title:'Folder',description:'Input directory'}];
  await add('leaf',9911001,fields,`export const run=async({options})=>({folder:options.folder,payload:'large-audit-payload-'.repeat(60000)});`);
  await add('parent',9911002,fields,`export const run=async({helpers})=>{const a=await helpers.runTool({key:'probe/leaf'});const b=await helpers.runTool({key:'probe/leaf'});return {reports:[a.result,b.result],provided:{seats:{report:a.result}}};};`);
  await add('fail',9911003,fields,`export const run=async()=>{throw Object.assign(new Error('Deliberate test failure'),{code:'PROBE_FAILURE'});};`);
  await add('partial',9911004,fields,`export const run=async({helpers})=>{await helpers.runTool({key:'probe/leaf'});await helpers.runTool({key:'probe/fail'});};`);
  await add('consume',9911005,[...fields,{name:'report',type:'object',required:true,title:'Report',description:'Previous result'}],`export const run=async({options})=>({payload_length:options.report.payload.length});`);
  const ledger=createUsageLedger({rabHome}),house=createToolHouse({root,toolsRoot,usageLedger:ledger});
  const context={rab_home:rabHome,project};
  return {temp,folder,memory,project,settings,saveSettings,house,ledger,context};
};

test('one-off creates a session; composite children have unique compact records and one shared report',async t=>{
  const f=await fixture(t),before=await stat(path.join(f.folder,'source.txt'));
  const out=await f.house.runTool({key:'probe/parent',context:{...f.context,bag:{seats:{folder:'stale-session-folder'}}}});
  assert.equal(out.options.folder,f.folder);
  assert.equal(out.tasks.length,3);
  assert.equal(new Set(out.tasks.map(task=>task.execution.execution_id)).size,3);
  assert.equal((await f.memory.loadSession(f.project,out.session_id)).project_key,f.memory.projectKey(f.project));
  assert.ok(Number.isSafeInteger(out.session_id)&&out.session_id>0);
  const records=await readdir(path.join(f.project.root,'runs',String(out.session_id)));
  assert.equal(records.length,3);
  for(const task of out.tasks){
    const saved=await json(task.tracking_file);
    assert.deepEqual(saved,task.execution);
    assert.equal(saved.version,'tool-execution/v2');
    assert.ok(Number.isSafeInteger(saved.execution_id)&&saved.execution_id>0);
    assert.equal(saved.session_id,out.session_id);
    assert.equal(saved.parent_execution_id,task===out.tasks[0]?null:out.execution.execution_id);
    assert.equal(saved.status,'completed');
    assert.ok(saved.start_date.endsWith('Z')&&saved.end_date.endsWith('Z'));
    assert.ok(saved.duration_ms>=0);
    assert.ok((await stat(task.tracking_file)).size<4096);
    assert.equal(saved.result_ref.file,out.result_file);
    assert.deepEqual(await f.memory.resolveToolValue(f.project,saved.result_ref),task.result);
    assert.equal(saved.result_bytes,Buffer.byteLength(JSON.stringify(task.result)));
    assert.equal(Object.hasOwn(saved,'result'),false);
  }
  assert.equal((await readdir(path.dirname(out.result_file))).length,1);
  const report=await json(out.result_file);
  assert.deepEqual(report.result,out.result);
  assert.equal(Object.keys(report.child_results).length,0);
  assert.equal(report.tasks[1].result_ref.$ref,'#/result/reports/0');
  assert.ok((await stat(out.result_file)).size<Buffer.byteLength(JSON.stringify(out.result))+12000);
  assert.equal(await readFile(path.join(f.folder,'source.txt'),'utf8'),'untouched');
  assert.equal((await stat(path.join(f.folder,'source.txt'))).mtimeMs,before.mtimeMs);
  assert.deepEqual(await readdir(f.folder),['source.txt']);
  const health=await f.ledger.summarize(f.project);
  assert.equal(health.open_tasks.length,0);
  const leaf=health.entities.find(item=>item.subject.id===9911001);
  assert.equal(leaf.total,2);assert.equal(leaf.timing.count,2);assert.ok(leaf.timing.average_ms>0);
  const events=await f.ledger.read(f.project,{limit:0});
  assert.ok(events.every(event=>!JSON.stringify(event).includes('large-audit-payload-')));
});

test('missing, malformed, deleted and non-directory saved paths block execution even with an explicit folder',async t=>{
  const f=await fixture(t),session=await f.memory.createSession(f.project);
  const context={...f.context,__rab_telemetry:{session_id:session.id}};
  for(const value of [undefined,'relative',path.join(f.temp,'missing'),path.join(f.folder,'source.txt')]){
    f.settings.paths.folder=value;await f.saveSettings();
    await assert.rejects(f.house.runTool({key:'probe/leaf',options:{folder:f.folder},context}),error=>{
      assert.equal(error.code,'AUDIT_PATH_REQUIRED');assert.equal(error.execution.status,'blocked');assert.ok(error.tracking_file);return true;
    });
  }
  await writeFile(path.join(f.project.root,'settings.json'),'{bad json');
  await assert.rejects(f.house.runTool({key:'probe/leaf',context}),{code:'AUDIT_PATH_REQUIRED'});
  await rm(path.join(f.project.root,'settings.json'));
  await assert.rejects(f.house.runTool({key:'probe/leaf',context}),{code:'AUDIT_PATH_REQUIRED'});
  const records=await readdir(path.join(f.project.root,'runs',String(session.id)));
  assert.equal(records.length,6);
  for(const file of records){const run=await json(path.join(f.project.root,'runs',String(session.id),file));assert.equal(run.status,'blocked');assert.equal(run.result_ref,null);assert.ok(run.end_date);}
  await assert.rejects(readdir(path.join(f.project.root,'audit-results')),{code:'ENOENT'});
});

test('changed settings bind on the next run; explicit valid inputs and selected session are preserved',async t=>{
  const f=await fixture(t),session=await f.memory.createSession(f.project);
  const other=path.join(f.temp,'other');await mkdir(other);
  f.settings.paths.folder=other;await f.saveSettings();
  const context={...f.context,bag:session.bag,__rab_telemetry:{session_id:session.id}};
  const out=await f.house.runTool({key:'probe/leaf',context});assert.equal(out.result.folder,other);
  const explicit=await f.house.runTool({key:'probe/leaf',options:{folder:f.folder},context});assert.equal(explicit.result.folder,f.folder);
  assert.equal(out.session_id,session.id);assert.equal(explicit.session_id,session.id);
  assert.notEqual(out.execution.execution_id,explicit.execution.execution_id);
  assert.equal((await f.memory.listSessions(f.project)).length,1);
  for(const folder of ['relative',path.join(f.temp,'missing'),f.memory.rabHome]){
    await assert.rejects(f.house.runTool({key:'probe/leaf',options:{folder},context}),{code:'AUDIT_PATH_REQUIRED'});
  }
});

test('failed composite tracks every child, retains partial results once and keeps the original error',async t=>{
  const f=await fixture(t);let failure;
  await assert.rejects(f.house.runTool({key:'probe/partial',context:f.context}),error=>{failure=error;return error.code==='PROBE_FAILURE';});
  assert.equal(failure.execution.status,'failed');assert.ok(failure.execution.end_date);
  const files=await readdir(path.dirname(failure.tracking_file));
  const records=await Promise.all(files.map(file=>json(path.join(path.dirname(failure.tracking_file),file))));
  assert.equal(records.length,3);assert.equal(records.filter(run=>run.status==='failed').length,2);
  const child=records.find(run=>run.status==='completed');
  assert.ok((await f.memory.resolveToolValue(f.project,child.result_ref)).payload.length>1000000);
  assert.equal((await readdir(path.dirname(child.result_ref.file))).length,1);
  assert.equal((await f.ledger.summarize(f.project)).open_tasks.length,0);
});

test('session and receipt saves contain references; restored seats resolve for later tool inputs',async t=>{
  const f=await fixture(t),session=await f.memory.createSession(f.project);
  const context={...f.context,__rab_telemetry:{session_id:session.id}};
  const out=await f.house.runTool({key:'probe/parent',context});
  const receipt={steps:[{result_file:out.result_file,result_ref:out.execution.result_ref,result:out.result,seats:out.seats,tasks:out.tasks,execution_id:out.execution.execution_id}]};
  assert.equal(Object.hasOwn(compactReceipt(receipt).steps[0],'result'),false);
  session.steps.push({id:await f.memory.allocateId(),receipt});session.bag.seats=out.stored_seats;
  await f.memory.saveSession(f.project,session);
  const sessionFile=path.join(f.project.root,'sessions',String(session.id),'state.json');
  assert.equal((await json(path.join(path.dirname(sessionFile),'settings.json'))).id,session.id);
  assert.ok((await stat(sessionFile)).size<10000);
  const restored=await f.memory.loadSession(f.project,session.id);
  assert.equal(restored.bag.seats.report.version,'tool-result-ref/v1');
  const next=await f.house.runTool({key:'probe/consume',options:{report:restored.bag.seats.report},context:{...context,bag:restored.bag}});
  assert.equal(next.result.payload_length,out.result.reports[0].payload.length);
  assert.equal(next.execution.options.omitted,true);
});

test('reconciliation distinguishes repeated task-1 IDs and preserves unknown end times',async t=>{
  const f=await fixture(t),session=await f.memory.createSession(f.project);
  const first=await f.house.runTool({key:'probe/leaf',context:{...f.context,__rab_telemetry:{session_id:session.id}}});
  const execution=newExecution({id:await f.memory.allocateId(),key:'probe/leaf'});
  Object.assign(execution,{session_id:session.id,project_key:f.memory.projectKey(f.project),tool:first.execution.tool});
  await f.memory.saveToolExecution(f.project,execution);
  await f.ledger.append(f.project,{type:'capability-start',task_id:'task-1',execution_id:execution.execution_id,session_id:session.id,start_date:execution.start_date,subject:{type:'tool',id:9911001,address:'probe/leaf'}});
  assert.equal((await f.ledger.summarize(f.project)).open_tasks.length,1);
  const repaired=await f.ledger.reconcileOpenTasks(f.project);
  assert.equal(repaired.length,1);assert.equal(repaired[0].execution_id,execution.execution_id);
  const saved=await f.memory.loadToolExecution(f.project,session.id,execution.execution_id);
  assert.equal(saved.status,'interrupted');assert.equal(saved.end_date,null);assert.equal(saved.duration_ms,null);
  assert.equal((await f.ledger.summarize(f.project)).open_tasks.length,0);
  assert.equal((await f.ledger.reconcileOpenTasks(f.project)).length,0);
});

test('Chat rebinds a derived folder at execution, persists compact receipts, and preserves explicit paths',async t=>{
  const f=await fixture(t),house=createToolHouse({root});
  const created=await house.runTool({key:'audit/stamp-new-project',options:{name:'chat-tracking',folder:f.folder},context:{rab_home:f.memory.rabHome}});
  const project=created.result.project,session=await f.memory.createSession(project);
  const workbench=createWorkbench({root,rabHome:f.memory.rabHome});
  const plan=await workbench.sessionTurn({session_id:session.id,text:'audit all state hooks'});
  assert.equal(plan.current_steps[0].status,'ready');
  const other=path.join(f.temp,'new input');await mkdir(other);
  await writeFile(path.join(other,'Sample.tsx'),"import {useState} from 'react'; export const Sample=()=>{const [n]=useState(0);return <div>{n}</div>;};");
  const file=path.join(project.root,'settings.json'),settings=await json(file);
  settings.paths.folder=other;await writeFile(file,JSON.stringify(settings));
  const done=await workbench.sessionExecute({session_id:session.id,confirm:true});
  const step=done.current_steps[0],receipt=step.receipt.steps[0];
  assert.equal((await json(receipt.result_file)).options.folder,other);
  assert.ok(receipt.result.matches.length>0);
  const stored=await f.memory.loadSession(project,session.id);
  assert.equal(Object.hasOwn(stored.steps.at(-1).receipt.steps[0],'result'),false);
  assert.ok(Number.isSafeInteger(step.id)&&step.id>0);
  const receiptFile=path.join(project.root,'receipts',String(session.id),`${step.id}.json`);
  assert.equal(Object.hasOwn((await json(receiptFile)).steps[0],'result'),false);
  assert.equal((await json(receipt.tracking_file)).session_id,session.id);
  await workbench.sessionTurn({session_id:session.id,text:`audit all state hooks in "${f.folder}"`});
  const overridden=await workbench.sessionExecute({session_id:session.id,confirm:true});
  assert.equal((await json(overridden.current_steps.at(-1).receipt.steps[0].result_file)).options.folder,f.folder);
});
