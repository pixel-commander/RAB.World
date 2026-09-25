import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rename, rm, realpath } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { inspectStampSources, renderStampSourceReport, saveStampSourceReport } from '../audit-stamp-sources.mjs';

async function fixture(t) {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'rab-source-inventory-')));
  await mkdir(path.join(root, 'tools'));
  t.after(async () => {
    assert.equal(path.dirname(root), await realpath(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('rab-source-inventory-'));
    await rm(root, { recursive: true, force: true });
  });
  const add = async (key, { id = 1, template = false, executor = true, authority = 'write' } = {}) => {
    const folder = path.join(root, 'tools', key), name = path.basename(folder);
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, 'settings.json'), JSON.stringify({ id, name, title: name, description: 'Fixture writer', settings: [], meta: { authority } }));
    if (executor) await writeFile(path.join(folder, `${name}.mjs`), 'throw new Error("The inventory must never import or execute this module");\n');
    if (template) { await mkdir(path.join(folder, 'template')); await writeFile(path.join(folder, 'template', 'item.txt'), '__NAME__\n'); }
    return folder;
  };
  return { root, add };
}

test('new and removed writers change the derived inventory without classification-table edits', async t => {
  const { root, add } = await fixture(t);
  const firstFolder = await add('demo/first');
  const first = await inspectStampSources({ root });
  assert.deepEqual(first.writers.map(tool => tool.key), ['demo/first']);
  assert.equal(first.totals.writers, first.writers.length);
  assert.equal(first.writers[0].implementation_classification, 'unclassified');
  await add('demo/stamp-box', { id: 2, template: true });
  const added = await inspectStampSources({ root });
  assert.deepEqual(added.writers.map(tool => tool.key), ['demo/first', 'demo/stamp-box']);
  assert.equal(added.totals.writers, first.totals.writers + 1);
  assert.deepEqual(added.writers.find(tool => tool.template).template.files[0].placeholders, ['__NAME__']);
  assert.ok(renderStampSourceReport(added).includes(`Writers: ${added.writers.length}.`));
  const moved = path.join(root, 'tools', 'demo', 'nested', 'first');
  await mkdir(path.dirname(moved), { recursive: true });
  await rename(firstFolder, moved);
  const relocated = await inspectStampSources({ root });
  assert.ok(relocated.writers.some(tool => tool.key === 'demo/nested/first'));
  assert.ok(!relocated.writers.some(tool => tool.key === 'demo/first'));
  assert.equal(relocated.writers.find(tool => tool.key.endsWith('/first')).id, first.writers[0].id);
  assert.ok(moved.startsWith(root + path.sep));
  await rm(moved, { recursive: true });
  const removed = await inspectStampSources({ root });
  assert.deepEqual(removed.writers.map(tool => tool.key), ['demo/stamp-box']);
});

test('duplicate identities, missing executors, and an empty inventory are visible', async t => {
  const { root, add } = await fixture(t);
  const empty = await inspectStampSources({ root });
  assert.deepEqual(empty.writers, []);
  assert.ok(empty.notices.some(note => note.startsWith('No available tools')));
  await add('demo/one'); await add('demo/two');
  await add('demo/missing', { id: 3, executor: false });
  const report = await inspectStampSources({ root });
  assert.deepEqual(report.writers, []);
  assert.ok(report.unavailable.some(item => item.key === 'demo/one' && item.code === 'DUPLICATE_TOOL_ID'));
  assert.ok(report.unavailable.some(item => item.key === 'demo/two' && item.code === 'DUPLICATE_TOOL_ID'));
  assert.ok(report.unavailable.some(item => item.key === 'demo/missing' && item.code === 'BAD_TOOL'));
});

test('inherits executor evidence, excludes kitchen and read tools, and preserves source bytes', async t => {
  const { root, add } = await fixture(t);
  const parent = path.join(root, 'tools', 'demo');
  await mkdir(parent);
  const executor = path.join(parent, 'demo.mjs');
  const code = 'throw new Error("Must not execute");\n';
  await writeFile(executor, code);
  await add('demo/child', { executor: false });
  await add('demo/reader', { id: 2, authority: 'read' });
  await add('kitchen/private', { id: 3 });
  const report = await inspectStampSources({ root });
  assert.deepEqual(report.writers.map(tool => tool.key), ['demo/child']);
  assert.equal(report.writers[0].executor, 'tools/demo/demo.mjs');
  assert.equal(report.writers[0].inherited_executor, true);
  assert.equal(await readFile(executor, 'utf8'), code);
  assert.ok(!report.source_files.some(file => file.path.startsWith('tools/kitchen/')));
  assert.deepEqual((await readdir(root)).sort(), ['tools']);
});

test('saved snapshots default to project docs, preserve existing reports, and match returned data', async t => {
  const { root, add } = await fixture(t);
  await add('demo/one');
  const report = await inspectStampSources({ root });
  const first = await saveStampSourceReport(report);
  const firstBytes = await readFile(first.json);
  const second = await saveStampSourceReport(report);
  assert.equal(path.dirname(first.json), path.join(root, 'docs', 'session-audits'));
  assert.notEqual(first.json, second.json);
  assert.deepEqual(await readFile(first.json), firstBytes);
  assert.deepEqual(JSON.parse(firstBytes), report);
  assert.equal(await readFile(first.markdown, 'utf8'), renderStampSourceReport(report));
  assert.ok(!(await readdir(root)).includes('.rab'));
});
