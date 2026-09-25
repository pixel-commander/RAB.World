import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, rmdir, writeFile, symlink, stat, open } from 'node:fs/promises';
import { createRabMemory } from '../../bridge/rab-memory.mjs';
import { boundedFolderJson, FOLDER_LIMITS } from '../../bridge/rab-folder-records.mjs';
import { buildFolderIndex } from '../../tools/audit/_folder-index.mjs';
import { runFolderBatch } from '../../tools/audit/_folder-batch.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const fixture = async t => {
  const temp = await realpath(await mkdtemp(path.join(os.tmpdir(), 'rab-folder-pipeline-')));
  t.after(async () => {
    assert.equal(path.dirname(temp), await realpath(os.tmpdir()));
    assert.ok(path.basename(temp).startsWith('rab-folder-pipeline-'));
    await rm(temp, { recursive: true, force: true });
  });
  const source = path.join(temp, 'source'), rabHome = path.join(temp, '.rab'), toolsRoot = path.join(temp, 'tools');
  await mkdir(source);
  const owner = createRabMemory({ rabHome });
  const projectId = await owner.registerProject({ name: 'Folder pipeline', root: source });
  const memory = owner;
  assert.equal(typeof memory.createFolderIndex, 'function', 'Production memory owner must expose the folder-record adapter.');
  const addTool = async (name, id, scope, code) => {
    const directory = path.join(toolsRoot, 'probe', name); await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, 'settings.json'), JSON.stringify({ id, name, title: name, description: 'Folder pipeline fixture.',
      settings: [{ name: 'folder', type: 'folder', required: true }, { name: 'mode', type: 'text', default: 'normal' }],
      meta: { authority: 'read', ...(scope ? { input_scope: scope } : {}) } }));
    await writeFile(path.join(directory, `${name}.mjs`), code);
  };
  await addTool('entries', 9913001, 'direct-folder', `
    import {opendir} from 'node:fs/promises';
    export const run = async ({options}) => {
      if (options.mode === 'stall') { for (;;) {} }
      if (options.mode === 'large') return {value: 'x'.repeat(300000)};
      if (options.mode === 'crash') process.exit(9);
      if (options.mode === 'heap') { const values = []; for (;;) values.push(new Array(100000).fill(1)); }
      if (options.mode === 'timer') setInterval(() => {}, 1000);
      let files = 0, directories = 0;
      for await (const entry of await opendir(options.folder)) { if(entry.isFile()) files++; else if(entry.isDirectory()) directories++; }
      return {files, directories};
    };
  `);
  await addTool('recursive', 9913002, null, `export const run = async () => { throw new Error('Recursive tool must never dispatch.'); };`);
  return { temp, source, rabHome, toolsRoot, projectId, memory, owner };
};
const allRows = async (memory, reference) => {
  const rows = []; let cursor = null;
  do {
    const page = await memory.readFolderRecordPage({ projectId: reference.project_id, kind: reference.kind, id: reference.id, cursor, limit: 3 });
    assert.ok(Buffer.byteLength(JSON.stringify(page)) <= FOLDER_LIMITS.pageBytes);
    rows.push(...page.items); cursor = page.cursor;
  } while (cursor);
  return rows;
};
const indexSource = f => buildFolderIndex({ memory: f.memory, projectId: f.projectId, folder: f.source });
const batchArgs = (f, index) => ({ memory: f.memory, projectId: f.projectId, indexId: index.reference.id, root, toolsRoot: f.toolsRoot, toolKey: 'probe/entries' });

test('bounded encoding rejects giant values, accessors, depth and cycles before whole-value serialization', () => {
  assert.throws(() => boundedFolderJson({ huge: 'x'.repeat(70000) }), { code: 'RECORD_TOO_LARGE' });
  assert.throws(() => boundedFolderJson({ huge: Array(13000).fill(0) }), { code: 'RECORD_TOO_LARGE' });
  const accessor = {}; Object.defineProperty(accessor, 'value', { enumerable: true, get() { throw new Error('must not execute'); } });
  assert.throws(() => boundedFolderJson(accessor), { code: 'BAD_RECORD' });
  const cycle = {}; cycle.self = cycle;
  assert.throws(() => boundedFolderJson(cycle), { code: 'BAD_RECORD' });
  assert.deepEqual(JSON.parse(boundedFolderJson({ false: false, zero: 0, empty: '' })), { false: false, zero: 0, empty: '' });
});

test('disk queue covers nested and empty folders once, excludes links/dependencies, and keeps numeric parent relations', async t => {
  const f = await fixture(t);
  await mkdir(path.join(f.source, 'nested', 'empty'), { recursive: true });
  for (const excluded of ['node_modules', '.git', '.rab']) {
    await mkdir(path.join(f.source, excluded, 'hidden'), { recursive: true });
    await writeFile(path.join(f.source, excluded, 'hidden', 'untouched'), 'skip');
  }
  await writeFile(path.join(f.source, 'root.txt'), 'root');
  await writeFile(path.join(f.source, 'nested', 'child.txt'), 'child');
  const outside = path.join(f.temp, 'outside'); await mkdir(outside);
  await writeFile(path.join(outside, 'marker'), 'untouched outside');
  await symlink(outside, path.join(f.source, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  const before = await stat(path.join(f.source, 'root.txt'));
  const index = await indexSource(f);
  assert.equal(index.state.status, 'completed');
  assert.equal(index.state.counts.scanned, 3);
  assert.equal(index.state.counts.empty, 1);
  assert.equal(index.state.counts.skipped, 4);
  const rows = await allRows(f.memory, index.reference), folders = rows.filter(row => row.kind === 'folder');
  assert.equal(new Set(folders.map(row => row.id)).size, folders.length);
  for (const row of folders) assert.ok(Number.isSafeInteger(row.id) && row.id > 0);
  const byPath = new Map(folders.map(row => [row.path, row]));
  assert.equal(byPath.get('.').parent_id, null);
  assert.equal(byPath.get('nested').parent_id, byPath.get('.').id);
  assert.equal(byPath.get('nested/empty').parent_id, byPath.get('nested').id);
  assert.equal(rows.some(row => row.path.includes('/hidden')), false);
  assert.ok(rows.some(row => row.reason === 'symbolic-link'));
  const result = await runFolderBatch(batchArgs(f, index));
  const results = await allRows(f.memory, result.reference);
  assert.equal(result.state.counts.completed, 3);
  assert.equal(result.state.counts.skipped, 3);
  const completed = results.filter(row => row.status === 'completed');
  assert.equal(completed.reduce((sum, row) => sum + row.result.files, 0), 2, 'Direct files must not be recounted under ancestors.');
  assert.equal(new Set(completed.map(row => row.folder_id)).size, 3);
  for (const row of completed) {
    assert.ok(Number.isSafeInteger(row.execution.execution_id));
    assert.ok(row.execution.duration_ms >= 0);
    assert.equal(row.execution.status, 'completed');
  }
  assert.equal(await readFile(path.join(outside, 'marker'), 'utf8'), 'untouched outside');
  assert.equal((await stat(path.join(f.source, 'root.txt'))).mtimeMs, before.mtimeMs);
});

test('unavailable queued directory is explicit partial coverage, never an empty successful folder', async t => {
  const f = await fixture(t), missing = path.join(f.source, 'vanishing'); await mkdir(missing);
  const memory = { ...f.memory, createFolderIndex: async args => {
    const sink = await f.memory.createFolderIndex(args);
    return { ...sink, nextFolder: async () => {
      const row = await sink.nextFolder();
      if (row?.path === 'vanishing') await rm(missing, { recursive: true });
      return row;
    } };
  } };
  const index = await buildFolderIndex({ memory, projectId: f.projectId, folder: f.source });
  assert.equal(index.state.status, 'partial');
  const row = (await allRows(f.memory, index.reference)).find(item => item.path === 'vanishing');
  assert.equal(row.status, 'unavailable'); assert.equal(row.error.code, 'ENOENT');
  assert.equal(index.state.counts.errors, 1);
});

test('batch rejects unscoped recursive tools and input overrides before dispatch', async t => {
  const f = await fixture(t), index = await indexSource(f);
  await assert.rejects(runFolderBatch({ ...batchArgs(f, index), toolKey: 'probe/recursive' }), { code: 'UNSUPPORTED_FOLDER_SCOPE' });
  await assert.rejects(runFolderBatch({ ...batchArgs(f, index), options: { folder: f.temp } }), { code: 'BAD_REQUEST' });
  await assert.rejects(readdir(path.join(f.memory.paths({id:f.projectId,root:f.source}).project, 'batches')), { code: 'ENOENT' });
});

test('oversized child output becomes a bounded failure with its numeric execution stats', async t => {
  const f = await fixture(t), index = await indexSource(f);
  const batch = await runFolderBatch({ ...batchArgs(f, index), options: { mode: 'large' } });
  assert.equal(batch.state.status, 'partial');
  const rows = await allRows(f.memory, batch.reference);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].error.code, 'RECORD_TOO_LARGE');
  assert.ok(Number.isSafeInteger(rows[0].execution.execution_id));
  assert.ok((await stat(batch.reference.file)).size < FOLDER_LIMITS.recordBytes);
  assert.equal(JSON.stringify(rows).includes('x'.repeat(10000)), false);
});

test('selected paths run once, preserve exact folder scope and save the selection', async t => {
  const f = await fixture(t);
  await mkdir(path.join(f.source, 'parent', 'child'), { recursive: true });
  await mkdir(path.join(f.source, 'other'));
  await writeFile(path.join(f.source, 'parent', 'one.txt'), 'one');
  await writeFile(path.join(f.source, 'parent', 'child', 'two.txt'), 'two');
  const index = await indexSource(f);
  const batch = await runFolderBatch({ ...batchArgs(f, index), folderPaths: ['parent', 'parent', 'parent\\child'] });
  const rows = await allRows(f.memory, batch.reference);
  assert.deepEqual(rows.map(row => row.path).sort(), ['parent', 'parent/child']);
  assert.equal(batch.state.counts.completed, 2);
  assert.equal(rows.reduce((sum, row) => sum + row.result.files, 0), 2);
  assert.ok(rows.every(row => Number.isSafeInteger(row.execution.execution_id)));
  const saved = JSON.parse(await readFile(batch.reference.settings_file, 'utf8'));
  assert.deepEqual(saved.meta.folder_paths, ['parent', 'parent/child']);
  const parentOnly = await runFolderBatch({ ...batchArgs(f, index), folderPaths: ['parent'] });
  assert.deepEqual((await allRows(f.memory, parentOnly.reference)).map(row => row.path), ['parent']);
});

test('invalid or unknown selections never create a batch or fall back to all folders', async t => {
  const f = await fixture(t), index = await indexSource(f);
  for (const folderPaths of [[], null, '.', [1], [''], ['/outside'], ['../outside'], ['C:\\outside'], ['a//b'], ['a/./b'], Array(1001).fill('.')]) {
    await assert.rejects(runFolderBatch({ ...batchArgs(f, index), folderPaths }), { code: 'BAD_FOLDER_SELECTION' });
  }
  await assert.rejects(runFolderBatch({ ...batchArgs(f, index), folderPaths: ['.', 'not-indexed'] }), { code: 'UNKNOWN_INDEX_FOLDER' });
  await assert.rejects(readdir(path.join(f.memory.paths({id:f.projectId,root:f.source}).project, 'batches')), { code: 'ENOENT' });
});

test('selected excluded and vanished folders retain explicit non-success outcomes', async t => {
  const f = await fixture(t);
  await mkdir(path.join(f.source, 'node_modules'));
  const child = path.join(f.source, 'child'); await mkdir(child);
  const index = await indexSource(f);
  await rmdir(child); // empty, exact fixture path
  const batch = await runFolderBatch({ ...batchArgs(f, index), folderPaths: ['node_modules', 'child'] });
  const rows = await allRows(f.memory, batch.reference);
  assert.equal(batch.state.status, 'partial');
  assert.equal(rows.find(row => row.path === 'node_modules').status, 'skipped');
  assert.equal(rows.find(row => row.path === 'child').status, 'failed');
  assert.equal(rows.length, 2);
});

test('CPU-stalled worker is terminated, timeout recorded, and status stays readable while work runs', async t => {
  const f = await fixture(t), index = await indexSource(f);
  let batchId;
  const memory = { ...f.memory, createFolderBatch: async args => { const sink = await f.memory.createFolderBatch(args); batchId = sink.id; return sink; } };
  const start = performance.now();
  const running = runFolderBatch({ ...batchArgs(f, index), memory, options: { mode: 'stall' }, timeoutMs: 700 });
  while (!batchId) await new Promise(resolve => setTimeout(resolve, 5));
  const status = await memory.getFolderRecordStatus({ projectId: f.projectId, kind: 'batch', id: batchId });
  assert.equal(status.state.status, 'running');
  const result = await running;
  assert.ok(performance.now() - start < 5000);
  assert.equal(result.state.counts.timed_out, 1);
  const row = (await allRows(memory, result.reference))[0];
  assert.equal(row.status, 'timed_out'); assert.equal(row.error.code, 'FOLDER_TIMEOUT');
  assert.ok(Number.isSafeInteger(row.execution.execution_id));
  assert.equal(row.execution.status, 'interrupted');
  assert.equal(row.execution.end_date, null, 'A killed worker cannot claim a known runner end time.');
});

test('cancellation kills current worker and leaves committed partial results readable', async t => {
  const f = await fixture(t), index = await indexSource(f), controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 250);
  try {
    const batch = await runFolderBatch({ ...batchArgs(f, index), options: { mode: 'stall' }, signal: controller.signal, timeoutMs: 10000 });
    assert.equal(batch.state.status, 'cancelled');
    const rows = await allRows(f.memory, batch.reference);
    assert.ok(rows.length <= 1);
    if (rows.length) assert.equal(rows[0].status, 'cancelled');
  } finally { clearTimeout(timer); }
  const cancelled = new AbortController(); cancelled.abort();
  const stoppedIndex = await buildFolderIndex({ memory: f.memory, projectId: f.projectId, folder: f.source, signal: cancelled.signal });
  assert.equal(stoppedIndex.state.status, 'cancelled');
  await assert.rejects(runFolderBatch(batchArgs(f, stoppedIndex)), { code: 'INDEX_NOT_SEALED' });
});

test('worker crash and lingering timers cannot hang the parent batch', async t => {
  const f = await fixture(t), index = await indexSource(f);
  const crashed = await runFolderBatch({ ...batchArgs(f, index), options: { mode: 'crash' } });
  const row = (await allRows(f.memory, crashed.reference))[0];
  assert.equal(row.error.code, 'WORKER_EXIT'); assert.ok(Number.isSafeInteger(row.execution.execution_id));
  const finished = await runFolderBatch({ ...batchArgs(f, index), options: { mode: 'timer' }, timeoutMs: 2000 });
  assert.equal(finished.state.status, 'completed');
});

test('child heap exhaustion is confined to its process and retains an interrupted numeric attempt', { timeout: 20000 }, async t => {
  const f = await fixture(t), index = await indexSource(f);
  const result = await runFolderBatch({ ...batchArgs(f, index), options: { mode: 'heap' }, timeoutMs: 10000 });
  const row = (await allRows(f.memory, result.reference))[0];
  assert.equal(row.error.code, 'WORKER_EXIT');
  assert.ok(Number.isSafeInteger(row.execution.execution_id));
  assert.equal(row.execution.status, 'interrupted');
  assert.ok((await stat(result.reference.file)).size < 4096);
  assert.equal((await f.memory.getFolderRecordStatus({ projectId: f.projectId, kind: 'index', id: index.reference.id })).state.status, 'completed');
});

test('whole-batch time limit is distinct from a recoverable per-folder timeout', async t => {
  const f = await fixture(t), index = await indexSource(f);
  const result = await runFolderBatch({ ...batchArgs(f, index), options: { mode: 'stall' }, timeoutMs: 5000, maxDurationMs: 100 });
  assert.equal(result.state.status, 'timed_out');
  assert.equal(result.state.error.code, 'SCAN_TIMEOUT');
  assert.equal(result.state.counts.timed_out, 1);
});

test('changed tool settings and a replaced source junction are rejected before that folder is read', async t => {
  const f = await fixture(t);
  const child = path.join(f.source, 'child'); await mkdir(child);
  const outside = path.join(f.temp, 'outside'); await mkdir(outside); await writeFile(path.join(outside, 'marker'), 'keep');
  const index = await indexSource(f);
  await rm(child, { recursive: true });
  await symlink(outside, child, process.platform === 'win32' ? 'junction' : 'dir');
  const changedSource = await runFolderBatch(batchArgs(f, index));
  const childRow = (await allRows(f.memory, changedSource.reference)).find(row => row.path === 'child');
  assert.equal(childRow.error.code, 'SOURCE_LINK');
  assert.equal(await readFile(path.join(outside, 'marker'), 'utf8'), 'keep');
  const settingsFile = path.join(f.toolsRoot, 'probe', 'entries', 'settings.json');
  const memory = { ...f.memory, createFolderBatch: async args => {
    const sink = await f.memory.createFolderBatch(args);
    const settings = JSON.parse(await readFile(settingsFile, 'utf8'));
    settings.description += ' changed'; await writeFile(settingsFile, JSON.stringify(settings));
    return sink;
  } };
  const changedTool = await runFolderBatch({ ...batchArgs(f, index), memory });
  for (const row of await allRows(memory, changedTool.reference)) assert.equal(row.error.code, 'TOOL_CHANGED');
});

test('storage failures are never relabeled source coverage and writes require backpressure', async t => {
  const f = await fixture(t);
  const memory = { ...f.memory, createFolderIndex: async args => {
    const sink = await f.memory.createFolderIndex(args);
    return { ...sink, append: async () => { throw Object.assign(new Error('Injected disk failure'), { code: 'EIO' }); } };
  } };
  const failed = await buildFolderIndex({ memory, projectId: f.projectId, folder: f.source });
  assert.equal(failed.state.status, 'failed'); assert.equal(failed.state.error.code, 'EIO');
  assert.equal(failed.state.counts.errors, 0, 'Sink failure is not a source read error.');
  const sink = await f.memory.createFolderIndex({ projectId: f.projectId, sourceRoot: f.source });
  try {
    const first = sink.append({ value: 1 });
    await assert.rejects(sink.append({ value: 2 }), { code: 'CONCURRENT_APPEND' });
    await first; await sink.finish();
    assert.equal((await allRows(f.memory, sink.reference)).length, 1);
  } finally { await sink.close(); }
});

test('read pages use committed boundaries, enforce cursor scope, reject oversized rows and preserve prior records', async t => {
  const f = await fixture(t), sink = await f.memory.createFolderIndex({ projectId: f.projectId, sourceRoot: f.source });
  try {
    await sink.append({ kind: 'probe', value: 'first' }); await sink.checkpoint();
    await sink.append({ kind: 'probe', value: 'second' });
    const scope = { projectId: f.projectId, kind: 'index', id: sink.id };
    assert.equal((await f.memory.readFolderRecordPage(scope)).items.length, 1);
    await assert.rejects(sink.append({ value: 'x'.repeat(100000) }), { code: 'RECORD_TOO_LARGE' });
    await sink.finish();
    const first = await f.memory.readFolderRecordPage({ ...scope, limit: 1 });
    assert.equal(first.items[0].value, 'first');
    await assert.rejects(f.memory.readFolderRecordPage({ ...scope, cursor: { ...first.cursor, id: sink.id + 1 } }), { code: 'BAD_CURSOR' });
    await assert.rejects(f.memory.readFolderRecordPage({ ...scope, cursor: { ...first.cursor, offset: 1 } }), { code: 'BAD_CURSOR' });
    assert.equal((await f.memory.readFolderRecordPage({ ...scope, cursor: first.cursor })).items[0].value, 'second');
    // Uncommitted crash tail is ignored by readers of the committed boundary.
    const file = await open(sink.reference.file, 'a'); try { await file.write('incomplete crash tail'); } finally { await file.close(); }
    assert.equal((await f.memory.readFolderRecordPage(scope)).items.length, 2);
  } finally { await sink.close(); }
});

test('large sibling frontier and deep nesting are represented on disk with each folder visited once', async t => {
  const f = await fixture(t);
  for (let i = 0; i < 128; i++) await mkdir(path.join(f.source, `s${i}`));
  await mkdir(path.join(f.source, ...Array(12).fill('d')), { recursive: true });
  const index = await indexSource(f);
  assert.equal(index.state.counts.scanned, 141);
  assert.equal(index.state.queue_read, index.state.queue_bytes);
  assert.ok((await stat(path.join(path.dirname(index.reference.file), 'pending.jsonl'))).size > 0);
  let seen = 0;
  for await (const row of f.memory.iterateFolderIndex({ projectId: f.projectId, indexId: index.reference.id })) { assert.equal(row.status, 'scanned'); seen++; }
  assert.equal(seen, 141);
});

test('100000 streamed synthetic records keep resident growth bounded and pages small', { timeout: 120000 }, async t => {
  const f = await fixture(t), sink = await f.memory.createFolderIndex({ projectId: f.projectId, sourceRoot: f.source });
  let baseline = 0, peak = 0;
  try {
    for (let index = 0; index < 100000; index++) {
      await sink.append({ kind: 'synthetic', index, payload: 'x'.repeat(256) });
      if (index === 5000) baseline = process.memoryUsage().rss;
      if (index >= 5000 && index % 1000 === 0) peak = Math.max(peak, process.memoryUsage().rss);
    }
    const result = await sink.finish();
    assert.equal(result.state.records, 100000);
    assert.ok(result.state.committed_bytes > 30000000);
    assert.ok(peak - baseline < 64 * 1024 * 1024, `Resident growth ${peak - baseline} exceeded 64 MiB.`);
    let cursor = null, seen = 0, largestPage = 0;
    do {
      const page = await f.memory.readFolderRecordPage({ projectId: f.projectId, kind: 'index', id: sink.id, cursor });
      largestPage = Math.max(largestPage, Buffer.byteLength(JSON.stringify(page)));
      assert.ok(page.items.length <= FOLDER_LIMITS.pageRows);
      seen += page.items.length; cursor = page.cursor;
    } while (cursor);
    assert.equal(seen, 100000); assert.ok(largestPage <= FOLDER_LIMITS.pageBytes);
    t.diagnostic(JSON.stringify({ records: seen, committed_bytes: result.state.committed_bytes, rss_growth_bytes: peak - baseline, largest_page_bytes: largestPage }));
  } finally { await sink.close(); }
});
