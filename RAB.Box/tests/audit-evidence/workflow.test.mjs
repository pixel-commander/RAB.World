import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { mkdtemp, mkdir, writeFile, readFile, rm, realpath, unlink } from 'node:fs/promises';
import { createRabMemory } from '../../bridge/rab-memory.mjs';
import { createAuditInvestigations } from '../../bridge/audit-investigations.mjs';
import { startServer } from '../../server.mjs';

const root=fileURLToPath(new URL('../..',import.meta.url));
const setup=async t=>{
  const temp=await realpath(await mkdtemp(path.join(os.tmpdir(),'rab-investigation-')));
  t.after(async()=>{assert.equal(path.dirname(temp),await realpath(os.tmpdir()));assert.ok(path.basename(temp).startsWith('rab-investigation-'));await rm(temp,{recursive:true,force:true});});
  const folder=path.join(temp,'source'),rabHome=path.join(temp,'.rab'),memory=createRabMemory({rabHome});
  const projectId=await memory.allocateId(),project={id:projectId,name:'Investigation fixture',root:memory.newProjectPath('Investigation fixture')};
  await mkdir(folder);await mkdir(project.root,{recursive:true});
  await writeFile(path.join(folder,'action.css'),':root { --ink: #eee; --ink-strong: #fff; }\n.ui-action { color:var(--action-ink,var(--ink)); }\n.ui-action:active,.ui-action.is-active { --action-ink:var(--ink); }\n.ui-action:focus-visible { outline:2px solid var(--ink); }\n');
  await writeFile(path.join(folder,'view.html'),'<button class="ui-action is-active">Action</button>');
  await writeFile(path.join(project.root,'settings.json'),JSON.stringify({id:project.id,name:project.name,type:'audit',paths:{folder,results:'audit-results'}}));
  const session=await memory.createSession(project),api=createAuditInvestigations({root,rabHome});
  assert.ok(Number.isSafeInteger(session.id));
  const call=body=>api.handle({session_id:session.id,...body});
  return {temp,folder,rabHome,project,memory,session,call};
};

test('saved investigation, declaration, prepared plan, approved writer, verification and handoff retain linked evidence',async t=>{
  const {folder,memory,project,call}=await setup(t);
  const initialCss=await readFile(path.join(folder,'action.css')),initialHtml=await readFile(path.join(folder,'view.html'));
  const first=await call({action:'run',class_name:'ui-action'}),firstBytes=await readFile(first.file);
  assert.equal(first.result.version,'audit-evidence/v1');assert.equal(first.result.conclusions[0].consumers[0],'view.html');
  assert.equal((await call({action:'read',file:first.file})).freshness.status,'current');
  assert.deepEqual(await readFile(path.join(folder,'action.css')),initialCss);
  const declaration=await call({action:'declare',file:first.file,decision:'intentional',reason:'Use the stronger ink for paired selected/pressed feedback in this fixture.'});
  const plan=await call({action:'plan',file:declaration.file,location:'action.css',styles:'--action-ink: var(--ink-strong);'});
  assert.equal(plan.result.plans[0].status,'prepared');
  assert.deepEqual(await readFile(path.join(folder,'action.css')),initialCss);
  await assert.rejects(call({action:'execute',file:plan.file,plan_id:plan.result.plans[0].id}),{code:'DENIED'});
  const verified=await call({action:'execute',file:plan.file,plan_id:plan.result.plans[0].id,confirm:true});
  assert.equal(verified.result.verification.status,'passed',JSON.stringify(verified.result.verification));
  assert.equal(verified.result.plans[0].status,'verified');
  assert.deepEqual(await readFile(path.join(folder,'view.html')),initialHtml);
  const css=await readFile(path.join(folder,'action.css'),'utf8');assert.ok(css.includes('.ui-action:active,\n.ui-action.is-active'));assert.ok(css.includes(':focus-visible'));
  assert.deepEqual(await readFile(first.file),firstBytes);
  await assert.rejects(call({action:'execute',file:plan.file,plan_id:plan.result.plans[0].id,confirm:true}),{code:'STALE_EVIDENCE'});
  const handoff=await call({action:'handoff',file:verified.file});assert.ok(handoff.result.handoff.disclosure.includes('Prepared locally'));
  assert.equal((await call({action:'list'})).items.length,5);
  const report=await memory.loadToolReport(project,first.file);
  assert.ok(Number.isSafeInteger(report.execution_id));assert.equal(report.project_id,project.id);
  assert.equal(report.tasks.length,4);
  assert.ok(report.tasks.every(x=>x.status==='completed'&&Number.isSafeInteger(x.execution_id)));
});

test('plans reject unknown intent, non-token skin, traversal and changed source revisions',async t=>{
  const {folder,call}=await setup(t);
  const first=await call({action:'run',class_name:'ui-action'});
  await assert.rejects(call({action:'plan',file:first.file,location:'action.css',styles:'--action-ink: var(--ink-strong);'}),{code:'INTENT_REQUIRED'});
  const declared=await call({action:'declare',file:first.file,decision:'intentional',reason:'Test explicit scope.'});
  await assert.rejects(call({action:'plan',file:declared.file,location:'../escape.css',styles:'--action-ink: var(--ink);'}),{code:'BAD_EVIDENCE'});
  await assert.rejects(call({action:'plan',file:declared.file,location:'action.css',styles:'color: red;'}),{code:'BAD_INPUT'});
  await writeFile(path.join(folder,'new.html'),'<div class="ui-action"/>');
  assert.equal((await call({action:'read',file:first.file})).freshness.status,'stale');
  await assert.rejects(call({action:'plan',file:declared.file,location:'action.css',styles:'--action-ink: var(--ink-strong);'}),{code:'STALE_EVIDENCE'});
});

test('HTTP endpoint requires existing token/session and rejects foreign reports',async t=>{
  const {rabHome,session}=await setup(t),app=await startServer({root,port:0,rabHome});t.after(()=>app.close());
  const token=(await (await fetch(`${app.origin}/api/session`)).json()).token;
  const endpoint=`${app.origin}/api/investigations`,body={action:'run',session_id:session.id,class_name:'ui-action'};
  assert.equal((await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})).status,403);
  const reply=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-Magic-Token':token},body:JSON.stringify(body)});
  assert.equal(reply.status,200);const out=await reply.json();assert.equal(out.result.subject,'ui-action');
  const bad=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-Magic-Token':token},body:JSON.stringify({action:'read',session_id:session.id,file:path.join(root,'HOST.json')})});
  assert.equal(bad.status,422);
});

test('saved revisions reject modified and deleted source reports on disk',async t=>{
  const {call}=await setup(t);
  const first=await call({action:'run',class_name:'ui-action'});
  const declared=await call({action:'declare',file:first.file,decision:'intentional',reason:'Preserve an inspectable provenance chain.'});
  const bytes=await readFile(first.file),changed=JSON.parse(bytes);changed.result.subject='tampered';
  await writeFile(first.file,JSON.stringify(changed));
  await assert.rejects(call({action:'read',file:declared.file}),{code:'STALE_EVIDENCE'});
  await writeFile(first.file,bytes);
  assert.equal((await call({action:'read',file:declared.file})).result.subject,'ui-action');
  const falseConclusion=JSON.parse(bytes);falseConclusion.result.conclusions[0].consumers=['invented.tsx'];
  await writeFile(first.file,JSON.stringify(falseConclusion));
  await assert.rejects(call({action:'read',file:first.file}),{code:'BAD_EVIDENCE'});
  await writeFile(first.file,bytes);
  await unlink(first.file);
  await assert.rejects(call({action:'read',file:declared.file}),{code:'ENOENT'});
});
