import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, realpath } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createRabMemory } from '../../bridge/rab-memory.mjs';
import { createWorkbench } from '../../bridge/service.mjs';
import { createToolHouse } from '../../bridge/tool-house.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const fixture=async t=>{
  const folder=await mkdtemp(path.join(os.tmpdir(),'rab-workspace-'));
  t.after(()=>rm(folder,{recursive:true,force:true}));
  const rabHome=path.join(folder,'.rab'), source=path.join(folder,'source');
  await mkdir(source);await writeFile(path.join(source,'sample.css'),'.sample { color: red; }\n');
  const memory=createRabMemory({rabHome}),box=createWorkbench({root,rabHome}),house=createToolHouse({root});
  await box.initialize();
  const createProject=async name=>(await house.runTool({key:'audit/stamp-new-project',options:{name,folder:source},context:{rab_home:rabHome}})).result.project;
  return {folder,rabHome,source,memory,box,house,createProject};
};
const snapshot=async folder=>{
  const files={};
  const visit=async(dir,relative='')=>{for(const entry of await readdir(dir,{withFileTypes:true})){const rel=path.join(relative,entry.name),full=path.join(dir,entry.name);if(entry.isDirectory())await visit(full,rel);else files[rel]=createHash('sha256').update(await readFile(full)).digest('hex');}};
  await visit(folder);return files;
};

test('requests save without projects and retries preserve one accepted record',async t=>{
  const f=await fixture(t);
  assert.deepEqual((await f.box.projectsList()).items,[]);
  const input={name:'project-viewer',title:'Project Viewer',description:'',type:'ui',submission_key:'same-http-submission'};
  const first=await f.box.requestCreate(input),second=await f.box.requestCreate(input);
  assert.equal(first.id,second.id);assert.equal(typeof first.id,'number');assert.equal(first.description,'');
  assert.equal((await f.box.requestRead(String(first.id))).title,'Project Viewer');
  assert.equal((await f.box.requestsList()).items.length,1);
  await assert.rejects(()=>f.box.requestCreate({...input,title:'Changed'}),{code:'SUBMISSION_CONFLICT'});
  const another=await f.box.requestCreate({...input,submission_key:'intentional-second-request'});
  assert.notEqual(first.id,another.id);
  assert.deepEqual((await f.box.projectsList()).items,[]);
});

test('fresh projects use names and sessions use numeric folders; preview changes no files',async t=>{
  const f=await fixture(t),project=await f.createProject('Project one'),other=await f.createProject('Project two');
  assert.notEqual(project.id,other.id);assert.equal(path.basename(project.root),'Project one');
  const state=await f.box.projectActivate({project_id:project.id,mode:'new-session',name:'Test session'});
  assert.equal(typeof state.session_id,'number');
  const file=path.join(project.root,'sessions',String(state.session_id),'settings.json');
  const descriptor=JSON.parse(await readFile(file));assert.equal(descriptor.meta.parent.id,project.id);
  const before=await snapshot(f.rabHome);
  const preview=await f.box.projectInspect(String(project.id));assert.equal(preview.sessions[0].id,state.session_id);
  assert.deepEqual(await snapshot(f.rabHome),before);
  assert.equal((await f.box.projectsList()).items.length,2);
});

test('resume retains current pending work; new action and session reset only their scope',async t=>{
  const f=await fixture(t),project=await f.createProject('Flow');
  const start=await f.box.projectActivate({project_id:project.id,mode:'new-session',name:'Test session'});
  const pending=await f.box.sessionTurn({session_id:start.session_id,expected_revision:start.revision,text:'find class'});
  const resumed=await f.box.projectActivate({project_id:project.id,mode:'resume',session_id:pending.session_id,expected_revision:pending.revision});
  assert.equal(resumed.session_id,pending.session_id);assert.equal(resumed.turns.length,1);assert.equal(resumed.yolo,false);
  const next=await f.box.projectActivate({project_id:project.id,mode:'new-action',session_id:resumed.session_id,expected_revision:resumed.revision});
  assert.equal(next.session_id,resumed.session_id);assert.equal(next.turns.length,1);
  assert.equal(next.bag.currentTarget,null);assert.deepEqual(next.bag.addressStack,[]);assert.equal(next.bag.seats,undefined);
  assert.equal(next.bag.paths.folder,await realpath(f.source));assert.notEqual(next.current_group.id,resumed.current_group?.id);
  for(const item of [...next.groups,...next.steps,...next.turns])assert.equal(typeof item.id,'number');
  const fresh=await f.box.projectActivate({project_id:project.id,mode:'new-session',name:'Test session'});
  assert.notEqual(fresh.session_id,next.session_id);assert.equal(fresh.turns.length,0);assert.equal(fresh.groups.length,0);
  assert.equal((await f.box.sessionRead(next.session_id)).turns.length,1);
});

test('independent windows keep project selection and stale revisions cannot mutate a session',async t=>{
  const f=await fixture(t),a=await f.createProject('A'),b=await f.createProject('B');
  const windowA=f.box,windowB=createWorkbench({root,rabHome:f.rabHome});
  const sa=await windowA.projectActivate({project_id:a.id,mode:'new-session',name:'Test session'}),sb=await windowB.projectActivate({project_id:b.id,mode:'new-session',name:'Test session'});
  const work=await windowA.sessionTurn({session_id:sa.session_id,expected_revision:sa.revision,text:'count css classes'});
  assert.equal(work.bag.project.id,a.id);assert.equal((await windowB.sessionRead(sb.session_id)).bag.project.id,b.id);
  await assert.rejects(()=>windowB.sessionTurn({session_id:sa.session_id,expected_revision:sa.revision,text:'find files'}),{code:'SESSION_CONFLICT'});
  await assert.rejects(()=>windowB.projectActivate({project_id:b.id,mode:'resume',session_id:sa.session_id}),{code:'WRONG_PROJECT'});
  const completed=await windowA.sessionExecute({session_id:work.session_id,expected_revision:work.revision,confirm:true});
  assert.equal(completed.current_steps[0].status,'completed');
  const receipt=completed.current_steps[0].receipt;assert.equal(typeof receipt.id,'number');
  assert.ok(receipt.steps[0].result_file.startsWith(a.root+path.sep));
  assert.equal(await readFile(path.join(f.source,'sample.css'),'utf8'),'.sample { color: red; }\n');
  assert.equal((await windowB.sessionRead(sb.session_id)).turns.length,0);
});

test('obsolete saved folders are excluded rather than migrated',async t=>{
  const f=await fixture(t),old=path.join(f.rabHome,'projects','old-test');await mkdir(old);
  await writeFile(path.join(old,'PROJECT.json'),JSON.stringify({project_id:'old-test',project_root:f.source,project_name:'Old'}));
  const before=await snapshot(old);assert.equal((await f.box.projectsList()).items.length,0);assert.deepEqual(await snapshot(old),before);
  await assert.rejects(()=>f.box.sessionRead('1780000000000-abcdef'),{code:'BAD_ID'});
});

test('optimistic memory saves reject stale snapshots and corrupt allocation fails closed',async t=>{
  const f=await fixture(t),project=await f.createProject('Concurrency');
  const session=await f.memory.createSession(project),stale=structuredClone(session);
  session.bag.test=false;await f.memory.saveSession(project,session);
  stale.bag.test=true;await assert.rejects(()=>f.memory.saveSession(project,stale),{code:'SESSION_CONFLICT'});
  assert.equal((await f.memory.loadSession(project,session.id)).bag.test,false);
  await writeFile(path.join(f.rabHome,'id-state.json'),'{broken');
  await assert.rejects(()=>f.memory.allocateId());
});
