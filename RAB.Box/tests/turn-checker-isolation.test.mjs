import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { access, cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createWorkbench } from '../bridge/service.mjs';
import { startServer } from '../server.mjs';

const sourceRoot=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const temporary=async t=>{
  const temp=await mkdtemp(path.join(os.tmpdir(),'rab-checker-isolation-'));
  t.after(async()=>{
    assert.equal(path.dirname(path.resolve(temp)),path.resolve(os.tmpdir()));
    assert.ok(path.basename(temp).startsWith('rab-checker-isolation-'));
    await rm(temp,{recursive:true,force:true});
  });
  return temp;
};
const snapshot=async root=>{
  const files={};
  const walk=async dir=>{
    for(const item of await readdir(dir,{withFileTypes:true})){
      const file=path.join(dir,item.name);
      if(item.isDirectory())await walk(file);
      else files[path.relative(root,file)]=createHash('sha256').update(await readFile(file)).digest('hex');
    }
  };
  await walk(root);
  return files;
};

test('diagnostic HTTP endpoint needs no project and leaves initialized app memory unchanged',async t=>{
  const root=await temporary(t),rabHome=path.join(root,'.rab-unused');
  await Promise.all(['language','tools','magic-box','PATHS.json'].map(name=>cp(path.join(sourceRoot,name),path.join(root,name),{recursive:true})));
  await writeFile(path.join(root,'HOST.json'),JSON.stringify({project:'missing-project',runs:'missing-runs',interface:'magic-box/index.html',language:'language'}));
  const app=await startServer({root,rabHome,port:0});
  const memoryBefore=await snapshot(rabHome);
  t.after(()=>new Promise(resolve=>app.server.close(resolve)));
  const {token}=await fetch(`${app.origin}/api/session`).then(response=>response.json());
  const post=async(route,body)=>{
    const response=await fetch(`${app.origin}${route}`,{method:'POST',headers:{'Content-Type':'application/json','X-Magic-Token':token},body:JSON.stringify(body)});
    return {status:response.status,body:await response.json()};
  };
  let result=await post('/api/turn-check',{text:'audit files'});
  assert.equal(result.status,200);
  assert.equal(result.body.frames[0].shape3.seats.domain,'audit');
  const firstId=result.body.check_id;
  result=await post('/api/turn-check',{text:'list projects'});
  assert.equal(result.status,200);
  assert.equal(result.body.scope,'input-only');
  assert.equal(Object.hasOwn(result.body,'project'),false);
  assert.notEqual(result.body.check_id,firstId);
  assert.equal(result.body.frames[0].shape3.seats.domain,null);
  assert.ok(result.body.frames[0].shape3.evidence.every(item=>item.reason!=='Bag/context domain'));
  assert.ok(result.body.frames.flatMap(frame=>frame.shape4.candidates).every(item=>item.source==='house'));
  for(const extra of [{session_id:'stale-session'},{project:{id:'audit'}},{context:{domain:'audit'}},{bag:{domain:'audit'}}]){
    result=await post('/api/turn-check',{text:'list projects',...extra});
    assert.equal(result.status,400);
    assert.equal(result.body.code,'BAD_REQUEST');
  }
  assert.equal((await post('/api/turn-check/teach',{})).status,404);
  assert.equal((await post('/api/language/teach',{})).status,400);
  assert.deepEqual(await snapshot(rabHome),memoryBefore);

  const overrides=path.join(root,'language','user','type-overrides.json');
  const existing=JSON.parse(await readFile(overrides,'utf8'));
  existing.entries.push({lemma:'diagnosticword',forms:['diagnosticword'],types:['adjective'],senses:['state']});
  await writeFile(overrides,JSON.stringify(existing));
  result=await post('/api/turn-check',{text:'find diagnosticword hooks'});
  assert.equal(result.status,200);
  assert.equal(result.body.frames[0].shape3.seats.predicate,'state');
  assert.deepEqual(await snapshot(rabHome),memoryBefore);
});

test('active audit project and its saved vocabulary cannot change diagnostic results or memory',async t=>{
  const temp=await temporary(t),rabHome=path.join(temp,'.rab');
  const workbench=createWorkbench({root:sourceRoot,rabHome});
  const baseline=await workbench.turnCheck({text:'list projects'});
  const session=await workbench.sessionNew({name:'Test session'});
  const audit=await workbench.sessionTurn({session_id:session.session_id,text:'audit this project'});
  assert.equal(audit.bag.domain,'audit');
  const input='find projectdiagnosticword hooks';
  const check=await workbench.turnCheck({text:input});
  const taught=await workbench.teachLanguage({session_id:session.session_id,check_id:check.check_id,text:input,token:'projectdiagnosticword',sense:'state',scope:'project-only'});
  assert.equal(taught.receipt.applied,true);
  assert.equal(taught.check.frames[0].shape3.seats.predicate,'state');
  const before=await snapshot(rabHome);
  const after=await workbench.turnCheck({text:'list projects'});
  assert.deepEqual(after.frames,baseline.frames);
  const unknown=await workbench.turnCheck({text:input});
  assert.equal(unknown.frames[0].shape2.typed_unknowns[0].value,'projectdiagnosticword');
  assert.equal(unknown.frames[0].shape3.seats.domain,null);
  assert.deepEqual(await snapshot(rabHome),before);
});
