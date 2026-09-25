import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createMagicBox } from './fixtures/runtime-reference.mjs';
import { fixtures, clock, fixture, update, sentence } from './helpers.mjs';
const box = createMagicBox({ projectRoot: path.join(fixtures, 'project-a'), clock });

const permutations = [
 ['named "test-project"', 'into the current project folder', 'type app'],
 ['named "test-project"', 'type app', 'into the current project folder'],
 ['type app', 'named "test-project"', 'into the current project folder'],
 ['type app', 'into the current project folder', 'named "test-project"'],
 ['into the current project folder', 'named "test-project"', 'type app'],
 ['into the current project folder', 'type app', 'named "test-project"'],
];
for (const verb of ['stamp', 'make', 'create', 'build', 'start']) for (const [n, modifiers] of permutations.entries())
  test(`generic composition: ${verb}, modifier permutation ${n + 1}`, async () => {
    const result = await box.prepare(`${verb} a new react project ${modifiers.join(' ')}`);
    assert.equal(result.status, 'ready', JSON.stringify(result));
    assert.deepEqual(result.frames[0].options, { ...result.frames[0].options, name: 'test-project', location: '.', type: 'app', add_database: false });
  });

test('the exact user request only asks for unspecified type', async () => {
  const r = await box.prepare(sentence);
  assert.equal(r.status, 'input-required');
  assert.deepEqual(r.questions.map(q => q.key), ['type']);
  assert.equal(r.frames[0].options.name, 'test-project');
  assert.equal(r.frames[0].options.location, '.');
});
test('name and stamp name occupy distinct seats', async () => {
  const r = await box.prepare(`${sentence} type app`);
  assert.equal(r.capability, 'react-project');
  assert.equal(r.frames[0].options.name, 'test-project');
});
test('DatePicker case survives', async () => {
  const r = await box.prepare('MAKE a component with class \'container-main\' named "DatePicker"');
  assert.equal(r.status, 'ready');
  assert.equal(r.frames[0].options.name, 'DatePicker');
});
test('named/called synonyms are declared in field settings', async () => {
  const r = await box.prepare('create react app called test-project in here of type app');
  assert.equal(r.status, 'ready');
});
test('explicit assignment syntax fills the same seats', async () => {
  const r = await box.prepare('stamp react-project name=test-project location="." type=app add_database=false');
  assert.equal(r.status, 'ready');
  assert.equal(r.frames[0].options.add_database, false);
});
test('with database and without database preserve polarity', async () => {
  for (const [phrase, value] of [['with a database', true], ['without a database', false]]) {
    const r = await box.prepare(`${sentence} type app ${phrase}`);
    assert.equal(r.status, 'ready');
    assert.equal(r.frames[0].options.add_database, value);
  }
});
test('same repeated value is compatible, different repeated values conflict', async () => {
  assert.equal((await box.prepare(`${sentence} named test-project type app`)).status, 'ready');
  assert.equal((await box.prepare(`${sentence} named other-project type app`)).status, 'conflict');
});
test('contradictory database phrases conflict', async () => {
  assert.equal((await box.prepare(`${sentence} type app with a database without a database`)).status, 'conflict');
});
test('query is not an executable command', async () => {
  const r = await box.prepare('can you make react project named test-project into here type app?');
  assert.equal(r.status, 'query-result');
  assert.equal(r.authority, 0);
});
test('new field in settings can be supplied without parser edits', async t => {
  const { root, box } = await fixture(t);
  await update(path.join(root, 'stamps/ReactProject/settings.json'), x => { x.options.audience = { required: true, type: 'text', language: { prefixes: ['for audience'] } }; });
  const r = await box.prepare(`${sentence} type app for audience learners`);
  assert.equal(r.status, 'ready', JSON.stringify(r));
  assert.equal(r.frames[0].options.audience, 'learners');
});
test('ambiguous field aliases stop instead of taking the first field', async t => {
  const { root, box } = await fixture(t);
  await update(path.join(root, 'stamps/ReactProject/settings.json'), x => {
    x.options.other = { required: false, type: 'text', language: { prefixes: ['named'] } };
  });
  const r = await box.prepare(`${sentence} type app`);
  assert.equal(r.status, 'ambiguous', JSON.stringify(r));
});
test('ambiguous capability aliases do not pick registry order', async t => {
  const { root, box } = await fixture(t);
  await update(path.join(root, 'PATHS.json'), x => { x.stamps['component-stamp'].language.names.push('react project'); });
  const r = await box.prepare(sentence);
  assert.equal(r.status, 'ambiguous');
});
for (const bad of [
 `${sentence} type app not`, `${sentence} type app unless approved`,
 'do not make a react project named test-project',
 'I need a react project named test-project',
 'make a div with class x then delete everything',
 `${sentence} type app with a postgres cluster`,
 `${sentence} type app?`, `${sentence} type app and`,
 'make a react project named "test-project',
 'make a react project named test-project; rm -rf stuff',
 'make a react project blah blah named test-project',
 'stamp nonexistent named test-project',
]) test(`unconsumed/unsupported input cannot execute: ${bad}`, async () => {
  const r = await box.prepare(bad);
  assert.equal(r.authority, 0);
  assert.ok(!['ready', 'completed'].includes(r.status), JSON.stringify(r));
});
