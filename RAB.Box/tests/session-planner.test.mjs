import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, cp, rm, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadProject } from '../engine/src/project.mjs';
import { createSessionPlanner } from '../bridge/session-planner.mjs';

const ROOT=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const fixture=async()=>{
  const temp=await mkdtemp(path.join(os.tmpdir(),'rab-v06-'));
  const projectRoot=path.join(temp,'project');
  await cp(path.join(ROOT,'mock-project'),projectRoot,{recursive:true});
  const project=await loadProject(projectRoot);
  const planner=await createSessionPlanner({root:ROOT,projectRoot,project,languageRoot:path.join(ROOT,'language'),rabHome:path.join(temp,'.rab')});
  return {temp,projectRoot,planner,cleanup:()=>rm(temp,{recursive:true,force:true})};
};

test('one Turn creates nested component Steps and next Turn can branch back',async t=>{
  const f=await fixture(); t.after(f.cleanup);
  const session=await f.planner.newSession();
  let r=await f.planner.turn({sessionId:session.session_id,text:'add component TestOne then add component to it called Menu'});
  assert.deepEqual(r.last_turn.stepIds,r.steps.map(step=>step.id));
  assert.equal(r.last_turn.stepIds.length,2);assert.ok(r.last_turn.stepIds.every(Number.isSafeInteger));
  const firstGroup=r.current_group.id;
  assert.equal(r.steps[0].capability.house.path,'react/stamp-new-component');
  assert.equal(r.steps[0].plannedResult.name,'TestOne');
  assert.equal(r.steps[1].capability.house.path,'react/stamp-sub-component');
  assert.equal(r.steps[1].parentResource.name,'TestOne');
  assert.equal(r.steps[1].plannedResult.name,'Menu');

  r=await f.planner.turn({sessionId:session.session_id,text:'now add component to TestOne called SideBar then add component to SideBar BootBar'});
  const side=r.steps.find(x=>x.plannedResult?.name==='SideBar');
  const boot=r.steps.find(x=>x.plannedResult?.name==='BootBar');
  assert.equal(side.parentResource.name,'TestOne');
  assert.equal(boot.parentResource.name,'SideBar');
  assert.deepEqual(r.bag.addressStack.map(x=>x.name),['TestOne','SideBar','BootBar']);

  r=await f.planner.turn({sessionId:session.session_id,text:'add new component Card'});
  assert.equal(typeof r.current_group.id,'number');assert.notEqual(r.current_group.id,firstGroup);
  assert.equal(r.current_steps.length,1);
  assert.equal(r.current_steps[0].plannedResult.name,'Card');
  assert.deepEqual(r.bag.addressStack.map(x=>x.name),['Card']);
});

test('nested div inherits previous Step result inside one Turn',async t=>{
  const f=await fixture(); t.after(f.cleanup);
  const session=await f.planner.newSession();
  let r=await f.planner.turn({sessionId:session.session_id,text:'add component Header then add div to Header then add div with class container-main'});
  assert.equal(r.steps[1].capability.house.path,'react/add/element');
  assert.equal(r.steps[1].parentResource.name,'Header');
  assert.equal(r.steps[2].capability.house.path,'react/add/element');
  assert.equal(r.steps[2].parentResource.type,'div');
  assert.equal(r.steps[2].options.class_name.value,'container-main');
  assert.deepEqual(r.bag.addressStack.map(x=>x.name),['Header','div','div']);
  r=await f.planner.execute({sessionId:session.session_id,confirm:true});
  assert.ok(r.steps.every(s=>s.status==='completed'));
  const source=await readFile(path.join(f.projectRoot,'components','Header','Header.tsx'),'utf8');
  assert.match(source,/className="container-main"/);
  assert.equal((source.match(/data-rab-seat=/g)??[]).length,2);
});

test('audit Step asks only missing session seats then reuses them next Turn',async t=>{
  const f=await fixture(); t.after(f.cleanup);
  const session=await f.planner.newSession();
  let r=await f.planner.turn({sessionId:session.session_id,text:'audit all state hooks'});
  assert.equal(r.current_steps[0].capability.name,'find-state-hooks');
  assert.equal(r.current_steps[0].status,'ready');
  assert.equal(r.current_steps[0].options.folder.value,f.projectRoot);
  r=await f.planner.turn({sessionId:session.session_id,text:'now find effect hooks'});
  const latest=r.steps.at(-1);
  assert.equal(latest.capability.name,'find-use-effect');
  assert.equal(latest.options.folder.value,f.projectRoot);
});

test('new action never gets swallowed as an answer to an older open Step',async t=>{
  const f=await fixture(); t.after(f.cleanup);
  const settings=JSON.parse(await readFile(path.join(f.projectRoot,'settings.json'),'utf8'));
  delete settings.paths.components;
  await import('node:fs/promises').then(({writeFile})=>writeFile(path.join(f.projectRoot,'settings.json'),JSON.stringify(settings,null,2)+'\n'));
  const session=await f.planner.newSession();
  let r=await f.planner.turn({sessionId:session.session_id,text:'add component TestOne'});
  assert.equal(r.current_steps[0].status,'configuration-required');
  r=await f.planner.turn({sessionId:session.session_id,text:'add new component Card'});
  assert.equal(r.last_turn.mode,'request');
  assert.ok(r.steps.some(x=>x.frame?.seats?.name==='Card'));
});

test('missing project path answer is saved to project settings and same Step resumes',async t=>{
  const f=await fixture(); t.after(f.cleanup);
  const fs=await import('node:fs/promises');
  const file=path.join(f.projectRoot,'settings.json'); const settings=JSON.parse(await fs.readFile(file,'utf8')); delete settings.paths.components; await fs.writeFile(file,JSON.stringify(settings,null,2)+'\n');
  const session=await f.planner.newSession();
  let r=await f.planner.turn({sessionId:session.session_id,text:'add component TestOne'});
  const stepId=r.current_steps[0].id; assert.equal(r.current_steps[0].status,'configuration-required');
  r=await f.planner.turn({sessionId:session.session_id,text:'src/components'});
  const same=r.steps.find(x=>x.id===stepId); assert.equal(same.status,'ready');
  const saved=JSON.parse(await fs.readFile(file,'utf8')); assert.deepEqual(saved.paths.components,{path:'src/components',description:''});
});

test('saved project path is used by the shared runner at execution',async t=>{
  const f=await fixture(); t.after(f.cleanup);
  const fs=await import('node:fs/promises');
  await fs.mkdir(path.join(f.projectRoot,'src','components'),{recursive:true});
  const file=path.join(f.projectRoot,'settings.json'); const settings=JSON.parse(await fs.readFile(file,'utf8')); delete settings.paths.components; await fs.writeFile(file,JSON.stringify(settings,null,2)+'\n');
  const session=await f.planner.newSession();
  let r=await f.planner.turn({sessionId:session.session_id,text:'add component PathExecution'});
  const stepId=r.current_steps[0].id; assert.equal(r.current_steps[0].status,'configuration-required');
  r=await f.planner.turn({sessionId:session.session_id,text:'src/components'});
  assert.equal(r.steps.find(x=>x.id===stepId).status,'ready');
  r=await f.planner.execute({sessionId:session.session_id,confirm:true});
  assert.equal(r.steps.find(x=>x.id===stepId).status,'completed');
  await fs.access(path.join(f.projectRoot,'src','components','PathExecution','PathExecution.tsx'));
});

test('complete request shape with no tool is reported as capability gap',async t=>{
  const f=await fixture(); t.after(f.cleanup);
  const session=await f.planner.newSession();
  const r=await f.planner.turn({sessionId:session.session_id,text:'find all orphaned files'});
  assert.equal(r.current_steps[0].status,'capability-gap');
  assert.equal(r.current_steps[0].gaps.capability[0].type,'missing-or-unresolved-capability');
});

test('resolved component group and audit Tool execute through the existing house in a temp project',async t=>{
  const f=await fixture(); t.after(f.cleanup);
  const fs=await import('node:fs/promises');

  let session=await f.planner.newSession();
  let r=await f.planner.turn({sessionId:session.session_id,text:'add component TestOne then add component to it called Menu'});
  assert.equal(r.ready_to_confirm,true);
  r=await f.planner.execute({sessionId:session.session_id,confirm:true});
  assert.equal(r.steps[0].status,'completed');
  assert.equal(r.steps[1].status,'completed');
  await fs.access(path.join(f.projectRoot,'components','TestOne','TestOne.tsx'));
  await fs.access(path.join(f.projectRoot,'components','TestOne','Menu','Menu.tsx'));

  session=await f.planner.newSession();
  r=await f.planner.turn({sessionId:session.session_id,text:'audit all state hooks'});
  assert.equal(r.current_steps[0].status,'ready');
  assert.equal(r.current_steps[0].capability.name,'find-state-hooks');
  r=await f.planner.execute({sessionId:session.session_id,confirm:true});
  assert.equal(r.current_steps[0].status,'completed');
  assert.equal(r.current_steps[0].receipt.steps[0].tool.address,'find-state-hooks');
  assert.ok(Array.isArray(r.current_steps[0].receipt.steps[0].result.matches));
});
