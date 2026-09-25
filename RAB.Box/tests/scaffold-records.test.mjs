import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { renderTemplateTree } from '../tools/_artifact-plan.mjs';
import { stampScaffoldRecords } from '../tools/_scaffold-records.mjs';
import { createRabMemory } from '../bridge/rab-memory.mjs';

test('project template stamps unique signal identities and category indexes', async () => {
  const parent = path.join(os.homedir(), '.rab', 'tests');
  await mkdir(parent, { recursive: true });
  const home = await mkdtemp(path.join(parent, 'scaffold-records-'));
  try {
    const root = fileURLToPath(new URL('../../RAB.Toolkits/rab-react-kit/ui/scaffolds/new-react-project/template', import.meta.url));
    const files = await renderTemplateTree(root, { PROJECT_ID: Date.now(), PROJECT_NAME: 'test', NPM_NAME: 'test' });
    const memory = createRabMemory({ rabHome: home });
    const contractPath = 'src/atoms/actions/action-ghost/contract.json';
    await assert.rejects(stampScaffoldRecords({ files: files.filter(f => f.path !== contractPath), target: home, memory }), /missing/);
    await assert.rejects(stampScaffoldRecords({ files: files.map(f => f.path === contractPath ? { ...f, text: '{"version":"signal/v1"}' } : f), target: home, memory }), /tool-contract\/v1/);
    const first = await stampScaffoldRecords({ files, target: path.join(home, 'first'), memory, projectName: 'first' });
    const second = await stampScaffoldRecords({ files, target: path.join(home, 'second'), memory });
    const records = list => new Map(list.filter(f => f.text && /(?:settings|beacon|manifest)\.json$/.test(f.path) && f.path.startsWith('src/atoms/')).map(f => [f.path, JSON.parse(f.text)]));
    const a = records(first), b = records(second);
    assert.equal(new Set([...a.values(), ...b.values()].map(v => v.id)).size, a.size + b.size);
    for (const [file, value] of a) {
      assert.ok(Number.isSafeInteger(value.id) && value.id > 0);
      assert.equal(value._scaffold, undefined);
      if (!file.endsWith('settings.json')) {
        assert.equal(value.project_name, 'first');
        assert.ok(value.path.startsWith(path.join(home, 'first')));
      }
      if (file.endsWith('beacon.json')) assert.equal(value.beacon, 'on');
      if (file.endsWith('settings.json')) { assert.equal(value.signal, true); assert.equal(value.transmitting, true); assert.equal(value.meta, undefined); assert.ok(Number.isSafeInteger(value.date_created)); }
      if (file.endsWith('manifest.json')) {
        assert.ok(value.items.length);
        for (const item of value.items) assert.equal(item.id, a.get(path.posix.join(path.posix.dirname(file), item.path, 'settings.json')).id);
      }
    }
    assert.equal(files.filter(f => f.path.endsWith('beacon.json')).every(f => JSON.parse(f.text).beacon === 'off'), true);
  } finally { await rm(home, { recursive: true, force: true }); }
});
