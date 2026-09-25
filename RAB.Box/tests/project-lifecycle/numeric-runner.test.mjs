import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { createRabMemory } from '../../bridge/rab-memory.mjs';
import { createToolHouse } from '../../bridge/tool-house.mjs';
import { newExecution } from '../../bridge/tool-tracking.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const json = async file => JSON.parse(await readFile(file, 'utf8'));
const numeric = id => assert.ok(Number.isSafeInteger(id) && id > 0, `Expected numeric identity, got ${JSON.stringify(id)}`);
const completed = execution => {
  numeric(execution.execution_id);
  assert.equal(execution.version, 'tool-execution/v2');
  assert.equal(execution.status, 'completed');
  assert.ok(Number.isFinite(Date.parse(execution.start_date)));
  assert.ok(Number.isFinite(Date.parse(execution.end_date)));
  assert.ok(Number.isFinite(execution.duration_ms) && execution.duration_ms >= 0);
};

const fixture = async t => {
  const temp = await realpath(await mkdtemp(path.join(os.tmpdir(), 'rab-numeric-runner-')));
  t.after(async () => {
    assert.equal(path.dirname(path.resolve(temp)), await realpath(os.tmpdir()));
    assert.ok(path.basename(temp).startsWith('rab-numeric-runner-'));
    await rm(temp, { recursive: true, force: true });
  });
  const rabHome = path.join(temp, '.rab'), toolsRoot = path.join(temp, 'tools');
  const add = async (name, id, fields, source) => {
    const folder = path.join(toolsRoot, 'probe', name);
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, 'settings.json'), JSON.stringify({
      id, name, title: name, description: `Numeric runner ${name} fixture.`,
      settings: fields, meta: { authority: 'read' }
    }));
    await writeFile(path.join(folder, `${name}.mjs`), source);
  };
  await add('leaf', 9912001, [{ name: 'value', type: 'number', default: 7 }],
    `export const run = async ({options, helpers}) => { helpers.fillSeat('local', options.value); return {value: options.value, local: helpers.getSeat('local')}; };`);
  await add('provider', 9912002, [],
    `export const run = async () => ({provided: {value: 'resolved'}});`);
  await add('resolve', 9912003, [{ name: 'word', type: 'text', required: true, try: 'probe/provider' }],
    `export const run = async ({options}) => ({word: options.word});`);
  await add('composite', 9912004, [],
    `export const run = async ({helpers}) => {
      const children = await Promise.all([1, 2].map(value => helpers.runTool({key: 'probe/leaf', options: {value}})));
      const resolved = await helpers.runTool({key: 'probe/resolve'});
      return {children: children.map(child => child.result), resolved: resolved.result};
    };`);
  await add('fail', 9912005, [],
    `export const run = async () => { throw Object.assign(new Error('Deliberate numeric runner failure'), {code: 'NUMERIC_PROBE_FAILURE'}); };`);
  await add('partial', 9912006, [],
    `export const run = async ({helpers}) => { await helpers.runTool({key: 'probe/leaf'}); await helpers.runTool({key: 'probe/fail'}); };`);
  await add('missing', 9912007, [{ name: 'required_value', type: 'text', required: true }],
    `export const run = async () => { throw new Error('Missing-input tool should not execute.'); };`);
  const memory = createRabMemory({ rabHome });
  const house = createToolHouse({ root, toolsRoot });
  return { temp, rabHome, toolsRoot, memory, house, context: { rab_home: rabHome } };
};

const auditProject = async f => {
  const id = await f.memory.allocateId();
  const project = { id, name: 'Numeric runner audit', root: path.join(f.rabHome, 'projects', String(id)) };
  const folder = path.join(f.temp, 'source');
  await mkdir(folder);
  await writeFile(path.join(folder, 'untouched.txt'), 'original audit source');
  await mkdir(project.root, { recursive: true });
  await writeFile(path.join(project.root, 'settings.json'), JSON.stringify({
    id, name: project.name, title: project.name, description: 'Numeric runner fixture.',
    settings: [], meta: { kind: 'project' }, type: 'audit', paths: { folder, results: 'audit-results' }
  }));
  return { project, folder, context: { ...f.context, project } };
};

test('execution records require an allocated numeric identity and preserve parent identity', () => {
  const id = 1789930000001, parentExecutionId = 1789930000000;
  const execution = newExecution({ id, key: 'probe/leaf', parentExecutionId });
  assert.equal(execution.execution_id, id);
  assert.equal(execution.parent_execution_id, parentExecutionId);
  assert.equal(execution.version, 'tool-execution/v2');
  assert.equal(execution.status, 'running');
  assert.equal(execution.end_date, null);
  assert.equal(execution.duration_ms, null);
  for (const invalid of [undefined, null, 0, -1, 1.5, '1789930000001', false, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => newExecution({ id: invalid, key: 'probe/leaf' }), { code: 'BAD_EXECUTION_ID' });
  }
  for (const invalid of [0, -1, '1789930000000', Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => newExecution({ id, key: 'probe/leaf', parentExecutionId: invalid }), { code: 'BAD_EXECUTION_ID' });
  }
});

test('projectless direct, concurrent child and input-resolver calls share numeric identity and seat scope', async t => {
  const f = await fixture(t);
  const out = await f.house.runTool({ key: 'probe/composite', context: f.context });
  assert.deepEqual(out.result, { children: [{ value: 1, local: 1 }, { value: 2, local: 2 }], resolved: { word: 'resolved' } });
  assert.equal(out.tasks.length, 5);
  assert.equal(new Set(out.tasks.map(task => task.id)).size, 5);
  const tasks = new Map(out.tasks.map(task => [task.id, task]));
  for (const task of out.tasks) {
    completed(task.execution);
    assert.equal(task.id, task.execution.execution_id);
    assert.equal(task.transition.task_id, task.id);
    assert.equal(task.parentTaskId, task.execution.parent_execution_id);
    if (task.parentTaskId !== null) assert.ok(tasks.has(task.parentTaskId));
    assert.equal(task.execution.session_id, null);
    assert.equal(task.execution.project_key, null);
    assert.equal(task.tracking_file, undefined);
  }
  const resolver = out.tasks.find(task => task.requested === 'probe/resolve');
  const provider = out.tasks.find(task => task.requested === 'probe/provider');
  assert.equal(provider.parentTaskId, resolver.id);
  assert.equal(out.execution.parent_execution_id, null);
  assert.equal(out.tracking_file, null);
  assert.equal(out.result_file, undefined);
  const projects = await readdir(path.join(f.rabHome, 'projects')).catch(error => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  assert.deepEqual(projects, []);
  assert.ok(await createRabMemory({ rabHome: f.rabHome }).allocateId() > Math.max(...tasks.keys()));
});

test('separate runner instances in one isolated home cannot reuse execution identities', async t => {
  const f = await fixture(t);
  const other = createToolHouse({ root, toolsRoot: f.toolsRoot });
  const runs = await Promise.all(Array.from({ length: 12 }, (_, index) =>
    (index % 2 ? f.house : other).runTool({ key: 'probe/leaf', options: { value: index }, context: f.context })));
  const ids = runs.map(run => run.execution.execution_id);
  assert.equal(new Set(ids).size, runs.length);
  for (const [index, run] of runs.entries()) {
    completed(run.execution);
    assert.equal(run.result.value, index);
    assert.equal(run.tasks[0].id, run.execution.execution_id);
  }
  const reopened = createToolHouse({ root, toolsRoot: f.toolsRoot });
  const next = await reopened.runTool({ key: 'probe/leaf', context: f.context });
  assert.ok(next.execution.execution_id > Math.max(...ids));
});

test('lookup, input and tool failures retain numeric attempt identity and terminal timing', async t => {
  const f = await fixture(t), ids = [];
  for (const [key, code, status] of [
    ['probe/not-found', 'TOOL_NOT_FOUND', 'failed'],
    ['probe/missing', 'INPUT_REQUIRED', 'blocked'],
    ['probe/fail', 'NUMERIC_PROBE_FAILURE', 'failed']
  ]) {
    await assert.rejects(f.house.runTool({ key, context: f.context }), error => {
      assert.equal(error.code, code);
      numeric(error.execution.execution_id);
      assert.equal(error.execution.status, status);
      assert.equal(error.execution.error.code, code);
      assert.equal(error.execution.parent_execution_id, null);
      assert.ok(Number.isFinite(Date.parse(error.execution.end_date)));
      assert.ok(error.execution.duration_ms >= 0);
      assert.equal(error.tracking_file, null);
      ids.push(error.execution.execution_id);
      return true;
    });
  }
  assert.equal(new Set(ids).size, 3);
});

test('project composite saves numeric tracking and one report without changing audit input', async t => {
  const f = await fixture(t), a = await auditProject(f);
  const before = await stat(path.join(a.folder, 'untouched.txt'));
  const out = await f.house.runTool({ key: 'probe/composite', context: a.context });
  numeric(out.session_id);
  const report = await json(out.result_file);
  assert.equal(report.execution_id, out.execution.execution_id);
  assert.equal(report.transition.task_id, out.execution.execution_id);
  assert.equal(report.tasks.length, out.tasks.length);
  assert.equal((await readdir(path.dirname(out.result_file))).filter(file => file.endsWith('.json')).length, 1);
  for (const task of out.tasks) {
    completed(task.execution);
    assert.deepEqual(await json(task.tracking_file), task.execution);
    assert.equal(task.execution.session_id, out.session_id);
    assert.equal(task.execution.parent_execution_id, task.parentTaskId);
    assert.ok(path.resolve(task.tracking_file).startsWith(path.resolve(a.project.root) + path.sep));
    assert.equal(task.execution.result_ref.file, out.result_file);
    assert.deepEqual(await f.memory.resolveToolValue(a.project, task.execution.result_ref), task.result);
    assert.equal(Object.hasOwn(task.execution, 'result'), false);
  }
  assert.deepEqual(await readdir(a.folder), ['untouched.txt']);
  assert.equal(await readFile(path.join(a.folder, 'untouched.txt'), 'utf8'), 'original audit source');
  assert.equal((await stat(path.join(a.folder, 'untouched.txt'))).mtimeMs, before.mtimeMs);
});

test('failed composite saves numeric parent/child references and retains completed child evidence', async t => {
  const f = await fixture(t), a = await auditProject(f);
  let failure;
  await assert.rejects(f.house.runTool({ key: 'probe/partial', context: a.context }), error => {
    failure = error;
    return error.code === 'NUMERIC_PROBE_FAILURE';
  });
  numeric(failure.execution.execution_id);
  const directory = path.dirname(failure.tracking_file);
  const records = await Promise.all((await readdir(directory)).filter(file => file.endsWith('.json')).map(file => json(path.join(directory, file))));
  assert.equal(records.length, 3);
  assert.equal(new Set(records.map(record => record.execution_id)).size, 3);
  for (const record of records) {
    numeric(record.execution_id);
    assert.equal(record.parent_execution_id, record.execution_id === failure.execution.execution_id ? null : failure.execution.execution_id);
    assert.ok(Number.isFinite(Date.parse(record.end_date)));
    assert.ok(record.duration_ms >= 0);
  }
  assert.equal(records.filter(record => record.status === 'failed').length, 2);
  const child = records.find(record => record.status === 'completed');
  assert.deepEqual(await f.memory.resolveToolValue(a.project, child.result_ref), { value: 7, local: 7 });
  assert.equal(failure.execution.error.code, 'NUMERIC_PROBE_FAILURE');
});
