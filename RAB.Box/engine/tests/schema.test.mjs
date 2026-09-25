import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOptions, validateSeats, every } from '../index.mjs';
import { relativePath, bind } from '../src/core.mjs';

const options = { name: { required: true, type: 'text' }, add_database: { required: false, type: 'boolean', default: false } };

test('options object and keyed array normalize to identical contracts', () => {
  assert.deepEqual(normalizeOptions(options), normalizeOptions(Object.entries(options).map(([key, field]) => ({ key, ...field }))));
});
test('missing required field remains in the declared domain', () => {
  const result = validateSeats({ options }, {});
  assert.deepEqual(result.missing, ['name']);
  assert.equal(result.requiredPass, false);
  assert.equal(result.values.add_database, false);
  assert.equal(result.seats.length, 2);
});
test('explicit false is preserved rather than treated as missing', () => {
  const result = validateSeats({ options }, { name: 'x', add_database: false });
  assert.equal(result.requiredPass, true);
  assert.equal(result.values.add_database, false);
});
test('optional means absent is allowed, not malformed input is allowed', () => {
  assert.equal(validateSeats({ options }, { name: 'x', add_database: 'false' }).errors.length, 1);
});
test('extra supplied fields are rejected', () => {
  assert.equal(validateSeats({ options }, { name: 'x', permission: true }).errors.length, 1);
});
test('empty-domain universal is true; it is not a complete-schema proof', () => {
  assert.equal(every(x => x.required)(x => x.satisfied)([]), true);
});
test('unification retains matching evidence, rejects conflicting values', () => {
  const bag = {}, evidence = {};
  bind(bag, evidence, 'name', 'A', { source: 'one' });
  bind(bag, evidence, 'name', 'A', { source: 'two' });
  assert.equal(evidence.name.length, 2);
  assert.throws(() => bind(bag, evidence, 'name', 'B', {}), { code: 'CONFLICT' });
  assert.equal(bag.name, 'A');
});
for (const [label, schema] of [
  ['no options', undefined], ['missing type', { x: { required: true } }],
  ['type typo', { x: { required: false, type: 'bollean' } }],
  ['implicit required', { x: { type: 'text' } }],
  ['duplicate array key', [{ key: 'x', required: true, type: 'text' }, { key: 'x', required: false, type: 'text' }]],
  ['bad default', { x: { required: false, type: 'boolean', default: 'yes' } }],
  ['empty enum', { x: { required: true, type: 'text', enum: [] } }],
  ['unknown validator', { x: { required: true, type: 'text', validate: 'magic' } }],
  ['unknown prototype key', JSON.parse('{"__proto__":{"required":true,"type":"text"}}')],
]) test(`reject invalid schema: ${label}`, () => assert.throws(() => normalizeOptions(schema)));

for (const value of ['../out', 'a/../../b', '/tmp/x', 'C:\\temp', '\\\\server\\share', 'a\u0000b', 'file:stream', 'nul', 'A/CON.txt', 'x.', 'x ', 'x?y'])
  test(`reject unsafe path ${JSON.stringify(value)}`, () => assert.throws(() => relativePath(value), { code: 'INVALID_PATH' }));
for (const [value, normalized] of [['.', '.'], ['./apps', 'apps'], ['apps\\project', 'apps/project']])
  test(`normalize allowed relative path ${value}`, () => assert.equal(relativePath(value), normalized));
