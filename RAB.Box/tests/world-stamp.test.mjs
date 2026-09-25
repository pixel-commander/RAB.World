import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdir, mkdtemp, readFile, access, unlink } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRabMemory } from '../bridge/rab-memory.mjs';
import { assertNode } from '../bridge/rab-node.mjs';
import { createToolHouse } from '../bridge/tool-house.mjs';
import { runWorldStamp } from '../tools/_stamp-engines.mjs';

test('world scaffold creates verified named storage through the shared owners', async () => {
  const toolRoot = path.resolve(process.env.RAB_WORLD_STAMP ?? fileURLToPath(new URL('../../RAB.Toolkits/rab-world/add/new/world', import.meta.url)));
  const tool = { ...JSON.parse(await readFile(path.join(toolRoot, 'settings.json'), 'utf8')), root: toolRoot };
  const { run } = await import(pathToFileURL(path.join(toolRoot, 'world.mjs')));
  const testRoot = path.join(os.homedir(), '.rab', 'tests');
  await mkdir(testRoot, { recursive: true });
  const rabHome = await mkdtemp(path.join(testRoot, 'world-stamp-'));
  const context = { rab_home: rabHome };
  const create = options => run({ helpers: { runWorldStamp: () => runWorldStamp({ options, context, tool }) } });
  const house = createToolHouse({ root: process.cwd() });
  assert.deepEqual(house.bindSettings(tool, {}).missing.map(field => field.name), ['name']);
  const result = await create({ name: 'PIXEL World' });
  const expectedRoot = path.join(rabHome, 'worlds', 'PIXEL World');
  assert.equal(result.world.root, expectedRoot);
  assert.equal(result.box_memory, expectedRoot);
  assert.equal(result.verification.status, 'verified');
  const file = path.join(expectedRoot, 'settings.json');
  const before = await readFile(file, 'utf8');
  const settings = JSON.parse(before);
  assertNode(settings);
  assert.equal(settings.meta.kind, 'world');
  assert.equal(settings.meta.source_root, expectedRoot);
  assert.equal(settings.title, 'PIXEL World');
  assert.equal(settings.description, '');
  assert.deepEqual(settings.paths, []);
  assert.ok(Number.isSafeInteger(settings.id) && settings.id > 0);
  assert.equal(new Date(settings.date_added).toISOString(), settings.date_added);
  assert.match(await readFile(path.join(expectedRoot, 'README.txt'), 'utf8'), /PIXEL World/);
  await assert.rejects(access(path.join(rabHome, 'project-roots.json')), { code: 'ENOENT' });
  await assert.rejects(create({ name: 'PIXEL World' }), { code: 'EEXIST' });
  assert.equal(await readFile(file, 'utf8'), before);
  for (const name of ['', '../outside', 'C:\\outside', 'CON', 'trailing.']) {
    await assert.rejects(create({ name }), { code: 'BAD_REQUEST' });
  }
  const second = await create({ name: 'Named', title: 'A titled world', description: 'Shared "docs"\nfor projects' });
  assert.equal(second.settings.title, 'A titled world');
  assert.equal(second.settings.description, 'Shared "docs"\nfor projects');
  assert.notEqual(second.world.id, result.world.id);
  const contenders = await Promise.allSettled([create({ name: 'Same' }), create({ name: 'Same' })]);
  assert.equal(contenders.filter(item => item.status === 'fulfilled').length, 1);
  assert.equal(contenders.find(item => item.status === 'rejected').reason.code, 'EEXIST');
  // A missing allocator state must not reset identity in a home with saved worlds.
  await unlink(path.join(rabHome, 'id-state.json'));
  await assert.rejects(createRabMemory({ rabHome }).allocateId(), { code: 'BAD_ID_STATE' });
  console.log(`Generated world inspected: ${expectedRoot}`);
});
