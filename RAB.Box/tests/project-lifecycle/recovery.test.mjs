import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, stat, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createRabMemory } from '../../bridge/rab-memory.mjs';
import { createWorkbench } from '../../bridge/service.mjs';
import { createToolHouse } from '../../bridge/tool-house.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const fixture = async t => {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'rab-recovery-review-'));
  t.after(async () => {
    assert.equal(path.dirname(folder), path.resolve(os.tmpdir()));
    assert.ok(path.basename(folder).startsWith('rab-recovery-review-'));
    await rm(folder, { recursive: true, force: true });
  });
  const rabHome = path.join(folder, '.rab'), source = path.join(folder, 'source');
  await mkdir(source); await writeFile(path.join(source, 'sample.css'), '.sample { color: red; }\n');
  const memory = createRabMemory({ rabHome }), box = createWorkbench({ root, rabHome }), house = createToolHouse({ root });
  await box.initialize();
  const createProject = async name => (await house.runTool({ key: 'audit/stamp-new-project', options: { name, folder: source }, context: { rab_home: rabHome } })).result.project;
  return { folder, rabHome, source, memory, box, createProject };
};
const snapshot = async folder => {
  const files = {};
  const visit = async (directory, prefix = '') => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const relative = path.join(prefix, entry.name), full = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(full, relative);
      else files[relative] = { hash: createHash('sha256').update(await readFile(full)).digest('hex'), mtime: (await stat(full)).mtimeMs };
    }
  };
  await visit(folder); return files;
};

test('cold service session read preserves files and modification times', async t => {
  const f = await fixture(t), project = await f.createProject('Cold read');
  const session = await f.box.projectActivate({ project_id: project.id, mode:'new-session',name:'Test session' });
  const before = await snapshot(f.folder);
  const cold = createWorkbench({ root, rabHome: f.rabHome });
  const result = await cold.sessionRead(String(session.session_id));
  assert.equal(result.session_id, session.session_id);
  assert.equal(result.bag.project.id, project.id);
  assert.deepEqual(await snapshot(f.folder), before);
});

test('resume marks persisted running attempt uncertain and refuses replay', async t => {
  const f = await fixture(t), project = await f.createProject('Interrupted');
  const initial = await f.box.projectActivate({ project_id: project.id, mode:'new-session',name:'Test session' });
  const ready = await f.box.sessionTurn({ session_id: initial.session_id, expected_revision: initial.revision, text: 'count css classes' });
  assert.equal(ready.ready_to_confirm, true);
  const saved = await f.memory.loadSession(project, ready.session_id);
  const step = saved.steps.find(item => item.id === ready.current_steps[0].id);
  step.status = 'running'; step.execution_id = await f.memory.allocateId();
  await f.memory.saveSession(project, saved);
  const resumed = await f.box.projectActivate({ project_id: project.id, mode: 'resume', session_id: saved.id, expected_revision: saved.revision });
  const interrupted = resumed.current_steps.find(item => item.id === step.id);
  assert.equal(interrupted.status, 'execution-interrupted');
  assert.equal(interrupted.execution_id, step.execution_id);
  assert.equal(interrupted.executionError.code, 'EXECUTION_UNCERTAIN');
  assert.equal(resumed.ready_to_confirm, false);
  const before = await snapshot(f.folder);
  await assert.rejects(() => f.box.sessionExecute({ session_id: saved.id, expected_revision: resumed.revision, confirm: true }), { code: 'PLAN_GAPS' });
  assert.deepEqual(await snapshot(f.folder), before);
});

test('completed step persists the reserved attempt identity used by its receipt', async t => {
  const f = await fixture(t), project = await f.createProject('Attempt identity');
  const initial = await f.box.projectActivate({ project_id: project.id, mode:'new-session',name:'Test session' });
  const ready = await f.box.sessionTurn({ session_id: initial.session_id, expected_revision: initial.revision, text: 'count css classes' });
  const completed = await f.box.sessionExecute({ session_id: ready.session_id, expected_revision: ready.revision, confirm: true });
  const saved = await f.memory.loadSession(project, ready.session_id), step = saved.steps.find(item => item.id === completed.current_steps[0].id);
  assert.equal(step.status, 'completed');
  assert.equal(typeof step.execution_id, 'number');
  assert.equal(step.execution_id, step.receipt.id);
  assert.equal(step.execution_id, step.receipt.steps[0].execution_id);
  const before = await snapshot(f.folder);
  await assert.rejects(() => f.box.sessionExecute({ session_id: ready.session_id, expected_revision: ready.revision, confirm: true }), { code: 'SESSION_CONFLICT' });
  assert.deepEqual(await snapshot(f.folder), before);
});

test('Chat project load returns target history without appending to its session', async t => {
  const f = await fixture(t), origin = await f.createProject('Origin'), target = await f.createProject('Target');
  const a = await f.box.projectActivate({ project_id: origin.id, mode:'new-session',name:'Test session' });
  const b = await f.box.projectActivate({ project_id: target.id, mode:'new-session',name:'Test session' });
  const targetFile = path.join(target.root, 'sessions', String(b.session_id), 'state.json');
  const before = await readFile(targetFile, 'utf8');
  const result = await f.box.sessionTurn({ session_id: a.session_id, expected_revision: a.revision, text: 'load project Target' });
  assert.equal(result.session_id, b.session_id);
  assert.equal(result.bag.project.id, target.id);
  assert.equal(await readFile(targetFile, 'utf8'), before);
  assert.equal(result.revision, b.revision);
  assert.ok(result.switch_message.includes('Target'));
});
