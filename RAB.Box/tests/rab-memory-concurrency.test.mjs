import test from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, realpath, open, lstat } from 'node:fs/promises';
import { createRabMemory } from '../bridge/rab-memory.mjs';
import { withMemoryLock } from '../bridge/rab-memory-lock.mjs';

const workerFile=fileURLToPath(new URL('./fixtures/rab-memory-concurrency/worker.mjs',import.meta.url));
const json=async file=>JSON.parse(await readFile(file,'utf8'));
const fixture=async t=>{
  const temp=await realpath(await mkdtemp(path.join(os.tmpdir(),'rab-memory-concurrency-')));
  t.after(async()=>{
    assert.equal(path.dirname(temp),await realpath(os.tmpdir()));
    assert.ok(path.basename(temp).startsWith('rab-memory-concurrency-'));
    await rm(temp,{recursive:true,force:true});
  });
  const rabHome=path.join(temp,'.rab'),source=path.join(temp,'source');
  await mkdir(source);await writeFile(path.join(source,'original.txt'),'original audit source\n');
  const memory=createRabMemory({rabHome}),id=await memory.allocateId();
  const project={id,name:'Concurrency',root:memory.newProjectPath('Concurrency')};
  await mkdir(project.root,{recursive:true});
  await writeFile(path.join(project.root,'settings.json'),JSON.stringify({id,name:project.name,type:'audit',paths:{folder:source}}));
  return {temp,rabHome,source,project,memory};
};
const launch=async(t)=>{
  const child=fork(workerFile,[],{stdio:['ignore','pipe','pipe','ipc']});
  t.after(()=>{if(child.exitCode===null&&!child.killed)child.kill();});
  let stderr='';child.stderr.on('data',data=>stderr+=data);
  const ready=await once(child,'message');assert.equal(ready[0].ready,true,stderr);
  return child;
};
const runWorkers=async(t,configs)=>{
  const children=await Promise.all(configs.map(()=>launch(t)));
  const pending=children.map((child,i)=>new Promise((resolve,reject)=>{
    let response;
    child.on('message',message=>{response=message;});
    child.on('error',reject);
    child.on('exit',code=>code===0&&response?.records?resolve(response.records):reject(new Error(JSON.stringify(response??{code}))));
    child.send(configs[i]);
  }));
  return (await Promise.all(pending)).flat();
};

test('cross-process cold project saves preserve every key, session, nested result reference and source',async t=>{
  const f=await fixture(t);
  const records=await runWorkers(t,Array.from({length:4},(_,worker)=>({rabHome:f.rabHome,project:f.project,worker,count:6})));
  assert.equal(records.length,24);
  const project=await json(path.join(f.project.root,'PROJECT.json'));
  const facts=await f.memory.loadFacts(f.project),resources=await f.memory.loadResources(f.project);
  assert.equal(Object.keys(project.paths).length,24);
  assert.equal(Object.keys(facts.facts).length,24);
  assert.equal(Object.keys(resources.components).length,24);
  assert.equal(new Set(records.map(x=>x.file)).size,24);
  const ids=records.flatMap(row=>[row.sessionId,row.execution.execution_id,row.childExecution.execution_id]);
  assert.ok(ids.every(id=>Number.isSafeInteger(id)&&id>0));
  assert.equal(new Set(ids).size,72);
  const originalReports=new Map();
  for(const row of records){
    assert.equal(project.paths[row.name].value,row.value);
    assert.equal(facts.facts[row.name].value,row.value);
    assert.equal(resources.components[row.name].value,row.value);
    const session=await f.memory.loadSession(f.project,row.sessionId);
    assert.equal((await json(path.join(f.project.root,'sessions',String(row.sessionId),'state.json'))).id,row.sessionId);
    assert.deepEqual(await f.memory.resolveToolValue(f.project,session.bag.seats.child),{name:row.name,value:row.value});
    for(const execution of [row.execution,row.childExecution]){
      const saved=await f.memory.loadToolExecution(f.project,row.sessionId,execution.execution_id);
      assert.deepEqual(saved,execution);
      assert.deepEqual(await f.memory.resolveToolValue(f.project,saved.result_ref),execution===row.execution?{nested:{child:{name:row.name,value:row.value}},name:row.name}:{name:row.name,value:row.value});
    }
    assert.equal(row.childExecution.result_ref.pointer,'#/result/nested/child');
    originalReports.set(row.file,await readFile(row.file,'utf8'));
    assert.deepEqual(await f.memory.loadToolReport(f.project,row.file),await json(row.file));
  }
  // Additional concurrent writes must not rewrite earlier reports.
  await runWorkers(t,[0,1].map(worker=>({rabHome:f.rabHome,project:f.project,worker:`later-${worker}`,count:2})));
  for(const [file,bytes] of originalReports)assert.equal(await readFile(file,'utf8'),bytes);
  assert.equal(await readFile(path.join(f.source,'original.txt'),'utf8'),'original audit source\n');
  assert.deepEqual(await readdir(f.source),['original.txt']);
  assert.deepEqual(await readdir(path.join(f.rabHome,'.memory-locks')),[]);
});

test('same-process concurrent updates serialize; full snapshot saves remain replacements',async t=>{
  const f=await fixture(t);
  await Promise.all(Array.from({length:20},(_,i)=>f.memory.setFact(f.project,`fact-${i}`,i)));
  assert.equal(Object.keys((await f.memory.loadFacts(f.project)).facts).length,20);
  const replacement={version:'0.8.3-facts',facts:{only:{value:false}}};
  await f.memory.saveFacts(f.project,replacement);
  assert.deepEqual(await f.memory.loadFacts(f.project),replacement);
  await f.memory.addResource(f.project,{type:'component',name:'Old'});
  const resources={version:'0.8',components:{},atoms:{},pages:{},projects:{},other:{only:{value:0}}};
  await f.memory.saveResources(f.project,resources);
  assert.deepEqual(await f.memory.loadResources(f.project),resources);
  await f.memory.setProjectPath(f.project,'remove',false);
  await Promise.all([f.memory.removeProjectPath(f.project,'remove'),f.memory.setProjectPath(f.project,'keep','')]);
  assert.equal(await f.memory.getProjectPath(f.project,'remove'),null);
  assert.equal((await f.memory.getProjectPath(f.project,'keep')).value,'');
});

test('corrupt project metadata is not silently replaced; lock releases after failure',async t=>{
  const f=await fixture(t);await f.memory.openProject(f.project);
  const file=path.join(f.project.root,'PROJECT.json'),bad='{broken original metadata';
  await writeFile(file,bad);
  await assert.rejects(f.memory.openProject(f.project),SyntaxError);
  assert.equal(await readFile(file,'utf8'),bad);
  assert.deepEqual(await readdir(path.join(f.rabHome,'.memory-locks')),[]);
});

test('distinct projects stay isolated and result references cannot cross project boundaries',async t=>{
  const f=await fixture(t);
  const id=await f.memory.allocateId();
  const other={...f.project,id,name:'Other',root:f.memory.newProjectPath('Other')};
  await mkdir(other.root,{recursive:true});
  await writeFile(path.join(other.root,'settings.json'),JSON.stringify({id,name:other.name,type:'audit',paths:{folder:f.source}}));
  const records=await runWorkers(t,[
    {rabHome:f.rabHome,project:f.project,worker:'first',count:2},
    {rabHome:f.rabHome,project:other,worker:'second',count:2}
  ]);
  const first=await f.memory.loadFacts(f.project),second=await f.memory.loadFacts(other);
  assert.deepEqual(Object.keys(first.facts).sort(),['worker-first-0','worker-first-1']);
  assert.deepEqual(Object.keys(second.facts).sort(),['worker-second-0','worker-second-1']);
  await assert.rejects(f.memory.resolveToolValue(other,records[0].execution.result_ref));
  assert.equal(await f.memory.saveToolResult(f.project,{authority:'write'}),null);
  await writeFile(path.join(other.root,'settings.json'),JSON.stringify({type:'react'}));
  assert.equal(await f.memory.saveToolResult(other,{authority:'read'}),null);
});

test('interrupted lock owners time out visibly without stealing locks',async t=>{
  const f=await fixture(t),lock=path.join(f.rabHome,'.memory-locks','interruption-probe');
  const child=await launch(t);
  const locked=once(child,'message');child.send({holdLock:lock});assert.equal((await locked)[0].locked,true);
  const exited=once(child,'exit');child.kill();await exited;
  let ran=false;
  await assert.rejects(withMemoryLock(lock,async()=>{ran=true;},{timeoutMs:60}),error=>{
    assert.equal(error.code,'MEMORY_LOCK_TIMEOUT');assert.equal(error.details.owner.pid,child.pid);return true;
  });
  assert.equal(ran,false);
  assert.equal((await json(path.join(lock,'owner.json'))).pid,child.pid);
});

test('report reader validates containment, size and envelope without initializing project memory',async t=>{
  const f=await fixture(t);
  const file=path.join(f.project.root,'report.json');
  const envelope={version:'audit-result/v1',project_id:f.project.id,result:{nested:{value:0}},error:{code:'PARTIAL'},tasks:[{status:'failed',error:{code:'PARTIAL'}}]};
  await writeFile(file,JSON.stringify(envelope));
  const homeBefore=await readdir(f.rabHome),projectBefore=await readdir(f.project.root);
  const idsBefore=await readFile(path.join(f.rabHome,'id-state.json'),'utf8');
  assert.deepEqual(await f.memory.loadToolReport(f.project,'report.json'),envelope);
  await assert.rejects(lstat(path.join(f.project.root,'PROJECT.json')),{code:'ENOENT'});
  assert.deepEqual(await readdir(f.rabHome),homeBefore);
  assert.deepEqual(await readdir(f.project.root),projectBefore);
  assert.equal(await readFile(path.join(f.rabHome,'id-state.json'),'utf8'),idsBefore);
  assert.deepEqual(await readdir(path.join(f.rabHome,'.memory-locks')),[]);
  const foreign=path.join(f.temp,'foreign.json');await writeFile(foreign,JSON.stringify(envelope));
  await assert.rejects(f.memory.loadToolReport(f.project,foreign),{code:'INVALID_PATH'});
  await assert.rejects(f.memory.loadToolReport(f.project,'../foreign.json'),{code:'INVALID_PATH'});
  for(const value of ['{bad',JSON.stringify([]),JSON.stringify({...envelope,version:'unknown'})]){
    await writeFile(file,value);await assert.rejects(f.memory.loadToolReport(f.project,file),{code:'BAD_REPORT'});
  }
  await writeFile(file,JSON.stringify({...envelope,project_id:'other'}));
  await assert.rejects(f.memory.loadToolReport(f.project,file),{code:'WRONG_PROJECT'});
  const oversized=await open(file,'w');await oversized.truncate(32*1024*1024+1);await oversized.close();
  await assert.rejects(f.memory.loadToolReport(f.project,file),{code:'REPORT_TOO_LARGE'});
  const missing={...f.project,id:1003,root:path.join(f.rabHome,'projects','1003')};
  await assert.rejects(f.memory.loadToolReport(missing,'report.json'),{code:'ENOENT'});
  await assert.rejects(lstat(missing.root),{code:'ENOENT'});
});
