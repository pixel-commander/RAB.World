import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { run as search } from '../../RAB.Toolkits/rab-world/tools/world/world-search/world-search.mjs';
import { createRabMemory } from '../bridge/rab-memory.mjs';

test('World Search preserves priority, excludes off records, reports missing indexes', async () => {
  const parent = path.join(os.homedir(), '.rab', 'tests');
  await mkdir(parent, { recursive: true });
  const root = await mkdtemp(path.join(parent, 'world-search-'));
  const memory = createRabMemory({ rabHome: path.join(root, 'memory') });
  const run = args => search({ ...args, context: { rab_home: path.join(root, 'memory') } });
  const save = (file, items) => writeFile(file, JSON.stringify({ version: 'manifest/v1', items }));
  try {
    const beacons = [];
    for (let n = 0; n < 4; n++) {
      const folder = path.join(root, String(n));
      await mkdir(folder);
      const ids = await memory.allocateIds(3);
      await save(path.join(folder, 'manifest.json'), [
        { id: ids[0], name: 'React Scaffold', path: 'new-component', indexed: true },
        { id: ids[1], name: 'React hidden', path: 'hidden', indexed: false },
        { id: ids[2], name: 'React escape', path: '../escape' }
      ]);
      beacons.push({ id: n + 1, path: folder, beacon: n === 1 ? 'off' : 'on' });
    }
    beacons.push({ id: 5, path: path.join(root, 'missing'), beacon: 'on' });
    const manifest_path = path.join(root, 'manifest.json');
    await save(manifest_path, beacons);
    const result = await run({ options: { query: 'REACT scaffold', manifest_path } });
    assert.deepEqual(result.items.map(item => item.source_beacon_id), [1, 3, 4]);
    assert.deepEqual(result.items.map(item => item.beacon_priority), [1, 3, 4]);
    assert.equal(result.status, 'partial');
    assert.equal(result.errors.length, 1);
    const all = await run({ options: { query: 'react', manifest_path } });
    assert.equal(all.items.length, 3);
    assert.equal(all.errors.length, 4);
    await assert.rejects(run({ options: { query: '', manifest_path } }), /nonempty/);
    await save(manifest_path, []);
    assert.deepEqual((await run({ options: { query: 'react', manifest_path } })).items, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
