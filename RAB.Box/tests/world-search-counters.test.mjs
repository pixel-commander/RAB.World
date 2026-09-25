import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdir, mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { maintainIndexIds } from '../bridge/index-identities.mjs';
import { createSearchUsage } from '../bridge/world-search-usage.mjs';

test('missing identities persist once; concurrent counters retain all increments', async () => {
  const parent = path.join(os.homedir(), '.rab/tests');
  await mkdir(parent, { recursive: true });
  const root = await mkdtemp(path.join(parent, 'search-counter-'));
  try {
    const rabHome = path.join(root, 'memory');
    const folder = path.join(root, 'atoms');
    await mkdir(path.join(folder, 'one'), { recursive: true });
    const source = path.join(folder, 'one/settings.json');
    await writeFile(source, JSON.stringify({ name: 'one', description: 'preserve me' }));
    const file = path.join(folder, 'manifest.json');
    await writeFile(file, JSON.stringify({ version: 'manifest/v1', items: [{ name: 'one', id: null, path: 'one' }] }));
    const m = await maintainIndexIds(file, { rabHome });
    const id = m.items[0].id;
    assert.ok(Number.isSafeInteger(id));
    assert.equal((await maintainIndexIds(file, { rabHome })).items[0].id, id);
    assert.equal(JSON.parse(await readFile(source)).description, 'preserve me');
    const usage = createSearchUsage({ rabHome });
    await Promise.all(Array.from({ length: 4 }, () => usage.recordSearch({ items: [{ id }, { id }] })));
    await usage.feedback({ id });
    const stats = JSON.parse(await readFile(path.join(rabHome, 'usage/world-search.json')));
    assert.deepEqual(stats, { [id]: { used: 1, shown: 4 } });
    await assert.rejects(usage.feedback({ id: null }));
  } finally { await rm(root, { recursive: true, force: true }); }
});
