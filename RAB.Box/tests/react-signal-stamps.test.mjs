import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdir, mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { runProjectStamp } from '../tools/_stamp-engines.mjs';

test('project stamps allocate fresh live beacon identities and retain nested templates', async () => {
  const parent = path.join(os.homedir(), '.rab', 'tests');
  await mkdir(parent, { recursive: true });
  const root = await mkdtemp(path.join(parent, 'merge-beacon-stamp-'));
  const toolRoot = path.join(root, 'stamp');
  const template = path.join(toolRoot, 'template');
  await mkdir(path.join(template, 'src', 'components'), { recursive: true });
  await mkdir(path.join(template, 'toolkit', 'template'), { recursive: true });
  await writeFile(path.join(template, 'settings.json'), JSON.stringify({ name: '__PROJECT_NAME__', type: 'react', paths: {} }));
  const live = { name: 'components', title: 'Components', description: 'Components', beacon: 'on', id: null, path: 'src/components', types: ['components'], reach: ['project'] };
  await writeFile(path.join(template, 'src/components/beacon.json'), JSON.stringify(live));
  await writeFile(path.join(template, 'toolkit/template/beacon.json'), JSON.stringify({ ...live, _scaffold: true }));
  const result = await runProjectStamp({ options: { name: 'Example', folder: root, custom_toolkit_path: null }, context: { rab_home: path.join(root, 'memory') }, tool: { root: toolRoot } });
  const beacon = JSON.parse(await readFile(path.join(result.project.root, 'src/components/beacon.json'), 'utf8'));
  assert.ok(Number.isSafeInteger(beacon.id));
  assert.notEqual(beacon.id, result.project.id);
  assert.equal(beacon.path, path.join(result.project.root, 'src/components'));
  assert.equal(new Date(beacon.date_added).toISOString(), beacon.date_added);
  const nested = JSON.parse(await readFile(path.join(result.project.root, 'toolkit/template/beacon.json'), 'utf8'));
  assert.equal(nested.id, null);
});
