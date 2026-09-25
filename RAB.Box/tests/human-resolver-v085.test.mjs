import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, cp, rm, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { questionForFailure, resolveHumanAnswer, createQuestionContract } from '../bridge/human-resolver.mjs';
import { loadProject } from '../engine/src/project.mjs';
import { createSessionPlanner } from '../bridge/session-planner.mjs';

const ROOT=path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('Human Resolver derives a define-token contract from the smallest typed unknown without guessing',()=>{
  const q=questionForFailure({
    failure:{blocker_type:'typed-unknown',seat:'operation',type:'operation-alias',value:'hack'},
    missingSeat:'operation',knownSeats:{target_type:'component',name:'TestKit'},legalFills:['add','find','update','remove']
  });
  assert.equal(q.kind,'define-token');
  assert.equal(q.seat,'operation');
  assert.equal(q.unknown.raw,'hack');
  assert.deepEqual(q.legal_fills,['add','find','update','remove']);
  assert.deepEqual(q.known_seats,{name:'TestKit',target_type:'component'});
  assert.ok(q.actions.includes('rephrase'));
  assert.ok(!q.prompt.includes('Did you mean'));
});

test('unknown/misspelled token stays exact and asks for correction or rephrase with no fuzzy candidate',()=>{
  const q=questionForFailure({failure:{blocker_type:'unknown-word',token:'componet'},knownSeats:{operation:'add'}});
  assert.equal(q.kind,'rephrase');
  assert.equal(q.unknown.raw,'componet');
  assert.match(q.prompt,/Unknown token: "componet"/);
  assert.equal(q.legal_fills.length,0);
});

test('fill-seat human return is typed, scoped, and reduces only the named seat',()=>{
  const q=createQuestionContract({kind:'fill-seat',seat:'components_path',prompt:'Where are components stored?',accepts:{type:'path'},scope:'project',onAnswer:{fill:'components_path',persist:'project',resume:'same-step'}});
  const r=resolveHumanAnswer({question:q,answer:'src\\components',currentShape:{operation:'add',name:'TestKit'}});
  assert.equal(r.event.kind,'fill-seat');
  assert.equal(r.returned.components_path,'src/components');
  assert.equal(r.after.name,'TestKit');
  assert.equal(r.after.components_path,'src/components');
  assert.equal(r.persist,'project');
  assert.equal(r.resume,true);
});

test('define-token is an explicit training event while rephrase mutates no vocabulary',()=>{
  const q=questionForFailure({failure:{blocker_type:'typed-unknown',seat:'operation',type:'operation-alias',value:'hack'},missingSeat:'operation',legalFills:['add','find']});
  const trained=resolveHumanAnswer({question:q,action:'define-token',answer:'add',currentShape:{target_type:'component'}});
  assert.equal(trained.training.token,'hack');
  assert.equal(trained.training.sense,'add');
  assert.deepEqual(trained.returned,{});
  const rephrased=resolveHumanAnswer({question:q,action:'rephrase',answer:'add component TestKit',currentShape:{target_type:'component'}});
  assert.equal(rephrased.event.kind,'rephrase');
  assert.equal(rephrased.training,undefined);
  assert.deepEqual(rephrased.after,{target_type:'component'});
});

test('session planner exposes machine-readable Question Contract and same-Step path answer still persists',async t=>{
  const temp=await mkdtemp(path.join(os.tmpdir(),'rab-human-resolver-'));
  const projectRoot=path.join(temp,'project');
  await cp(path.join(ROOT,'mock-project'),projectRoot,{recursive:true});
  const file=path.join(projectRoot,'settings.json');
  const settings=JSON.parse(await readFile(file,'utf8')); delete settings.paths.components; await writeFile(file,JSON.stringify(settings,null,2)+'\n');
  const project=await loadProject(projectRoot);
  const planner=await createSessionPlanner({root:ROOT,projectRoot,project,languageRoot:path.join(ROOT,'language'),rabHome:path.join(temp,'.rab')});
  t.after(()=>rm(temp,{recursive:true,force:true}));
  const session=await planner.newSession();
  let out=await planner.turn({sessionId:session.session_id,text:'add component TestOne'});
  const step=out.current_steps[0];
  const gap=step.gaps.configuration[0];
  assert.equal(gap.contract.version,'question-contract/v0.8.5');
  assert.equal(gap.contract.kind,'fill-seat');
  assert.equal(gap.contract.accepts.type,'path');
  assert.equal(gap.contract.on_answer.persist,'project');
  const stepId=step.id;
  out=await planner.turn({sessionId:session.session_id,text:'src/components'});
  assert.equal(out.steps.find(x=>x.id===stepId).status,'ready');
  const saved=JSON.parse(await readFile(file,'utf8'));
  assert.deepEqual(saved.paths.components,{path:'src/components',description:''});
});
