import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { cp, mkdtemp, rm, readFile, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createWorkbench } from '../bridge/service.mjs';
import { createSessionPlanner } from '../bridge/session-planner.mjs';
import { loadProject } from '../engine/src/project.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const fixture = async t => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'rab-flow-'));
  t.after(async () => {
    assert.equal(path.dirname(path.resolve(temp)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(temp).startsWith('rab-flow-'));
    await rm(temp, { recursive: true, force: true });
  });
  const projectRoot = path.join(temp, 'project'), rabHome = path.join(temp, '.rab');
  await cp(path.join(root, 'mock-project'), projectRoot, { recursive: true });
  const planner = await createSessionPlanner({ root, projectRoot, project: await loadProject(projectRoot), languageRoot: path.join(root, 'language'), rabHome });
  const session = await planner.newSession(), session_id = session.session_id;
  const workbench = createWorkbench({ root, rabHome });
  return { temp, projectRoot, rabHome, planner, session_id, workbench,
    turn: text => workbench.sessionTurn({ session_id, text }) };
};

test('nevermind cancels audit setup at every question without creating a project', async t => {
  const f = await fixture(t), projects = path.join(f.rabHome, 'projects');
  const before = await readdir(projects);
  for (const answers of [[], ['abandoned'], ['abandoned', f.projectRoot]]) {
    let result = await f.turn('Start a new audit project');
    for (const answer of answers) result = await f.turn(answer);
    const step = result.current_steps[0], options = structuredClone(step.options);
    result = await f.turn('nevermind');
    assert.equal(result.session_id, f.session_id);
    assert.equal(result.current_steps[0].id, step.id);
    assert.equal(result.current_steps[0].status, 'cancelled');
    assert.equal(result.current_group.status, 'cancelled');
    assert.deepEqual(result.current_steps[0].options, options);
    assert.deepEqual(result.current_steps[0].gaps, {});
    assert.deepEqual(result.last_turn.stepIds, [step.id]);
    assert.equal(result.last_turn.mode, 'cancel');
    assert.equal(result.last_turn.reply, 'Cancelled the current flow.');
    assert.equal(result.ready_to_confirm, false);
  }
  assert.deepEqual(await readdir(projects), before);
  const fresh = await f.turn('Start a new audit project');
  assert.match(fresh.last_turn.reply, /project name/i);
  assert.equal(fresh.current_steps[0].options.name.value, null);
});

test('nevermind stops a restored load retry and saves the cancellation in that session', async t => {
  const f = await fixture(t);
  const pending = await f.turn('load project absent');
  const workbench = createWorkbench({ root, rabHome: f.rabHome });
  const cancelled = await workbench.sessionTurn({ session_id: f.session_id, text: '  NEVER MIND!  ' });
  assert.equal(cancelled.steps.length, pending.steps.length);
  assert.equal(cancelled.current_steps[0].status, 'cancelled');
  assert.doesNotMatch(cancelled.last_turn.reply, /No project found|Try again/);
  const saved = JSON.parse(await readFile(path.join(cancelled.rab.project, 'sessions', String(f.session_id), 'state.json'), 'utf8'));
  assert.equal(saved.steps.at(-1).status, 'cancelled');
  assert.equal(saved.turns.at(-1).text, 'NEVER MIND!');
  assert.ok(saved.steps.at(-1).turnIds.includes(saved.turns.at(-1).id));
  const restored = await createWorkbench({ root, rabHome: f.rabHome }).sessionRead(f.session_id);
  assert.equal(restored.current_steps[0].status, 'cancelled');
  const loaded = await f.turn('load project Mock project');
  assert.match(loaded.last_turn.reply, /Loaded/);
  assert.notEqual(loaded.current_group.id, pending.current_group.id);
});

test('nevermind is a standalone command and does not create a step when nothing is pending', async t => {
  const f = await fixture(t);
  let result = await f.turn('nevermind');
  assert.equal(result.last_turn.reply, 'There is no active flow to cancel.');
  assert.equal(result.steps.length, 0);
  result = await f.turn('load project nevermind');
  assert.match(result.last_turn.reply, /No project found for “nevermind”/);
  assert.equal(result.current_steps[0].status, 'input-required');
  await f.turn('nevermind');
  result = await f.turn('nevermind');
  assert.equal(result.steps.length, 1);
  assert.equal(result.last_turn.reply, 'There is no active flow to cancel.');
  result = await f.turn('load project Mock project');
  const completed = structuredClone(result.current_steps[0]);
  result = await f.turn('nevermind');
  assert.deepEqual(result.current_steps[0], completed);
});

test('Chat cancels a ready audit and the next audit executes in a fresh flow', async t => {
  const f = await fixture(t);
  const ready = await f.turn('audit all state hooks');
  assert.equal(ready.ready_to_confirm, true);
  let result = await f.turn('nevermind');
  assert.equal(result.current_steps[0].status, 'cancelled');
  await assert.rejects(f.workbench.sessionExecute({ session_id: f.session_id, confirm: true }), { code: 'PLAN_GAPS' });
  result = await f.turn('find effect hooks');
  assert.notEqual(result.current_group.id, ready.current_group.id);
  assert.equal(result.current_steps.length, 1);
  assert.equal(result.ready_to_confirm, true);
  result = await f.workbench.sessionExecute({ session_id: f.session_id, confirm: true });
  assert.equal(result.current_steps[0].status, 'completed');
  assert.equal(result.steps[0].status, 'cancelled');
  assert.equal(result.steps[0].receipt, undefined);
});

test('direct planner cancellation is not consumed as a missing project path answer', async t => {
  const f = await fixture(t), file = path.join(f.projectRoot, 'settings.json');
  const settings = JSON.parse(await readFile(file, 'utf8'));
  delete settings.paths.components;
  const before = JSON.stringify(settings);
  await writeFile(file, before);
  const session = await f.planner.newSession();
  const turn = text => f.planner.turn({ sessionId: session.session_id, text });
  let result = await turn('add component Abandoned');
  assert.equal(result.current_steps[0].status, 'configuration-required');
  result = await turn('never mind.');
  assert.equal(result.current_steps[0].status, 'cancelled');
  assert.equal(await readFile(file, 'utf8'), before);
  result = await turn('add component Fresh');
  assert.equal(result.current_steps[0].status, 'configuration-required');
  result = await turn('src/components');
  assert.equal(result.current_steps[0].status, 'ready');
  assert.equal(result.steps[0].status, 'cancelled');
  assert.equal(result.steps[0].options.location.status, 'unknown');
});

test('nevermind cancels queued children and removes their unbuilt resource references', async t => {
  const f = await fixture(t), turn = text => f.planner.turn({ sessionId: f.session_id, text });
  const pending = await turn('add component Abandoned then add component to it called Menu');
  assert.equal(pending.current_steps.length, 2);
  assert.equal(pending.bag.currentTarget.name, 'Menu');
  const cancelled = await turn('nevermind');
  assert.deepEqual(cancelled.current_steps.map(step => step.status), ['cancelled', 'cancelled']);
  assert.equal(cancelled.bag.currentTarget, null);
  assert.deepEqual(cancelled.bag.addressStack, []);
  assert.equal(cancelled.bag.sessionResources.Abandoned, undefined);
  assert.equal(cancelled.bag.sessionResources.Menu, undefined);
  await assert.rejects(f.planner.execute({ sessionId: f.session_id, confirm: true }), { code: 'PLAN_GAPS' });
  assert.equal((await readdir(path.join(f.projectRoot, 'components'))).includes('Abandoned'), false);
});
