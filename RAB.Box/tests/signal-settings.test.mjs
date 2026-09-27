import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSignalSettings, assertSignalSettings, SIGNAL_KEYS } from '../bridge/rab-node.mjs';
test('signals use exact fields and preserve false', () => {
  const record = makeSignalSettings({ id: Date.now(), name: 'sample', type: 'action-atom', signal: false, transmitting: false });
  assert.deepEqual(Object.keys(record), SIGNAL_KEYS);
  assert.equal(record.signal, false);
  assert.equal(record.transmitting, false);
  assert.ok(Number.isSafeInteger(record.date_created));
  assert.throws(() => makeSignalSettings({ ...record, meta: {} }), /Unexpected/);
  assert.throws(() => makeSignalSettings({ ...record, signal: 'true' }), /flags/);
});

test('optional signal paths preserve supplied values and are cloned', () => {
  const input = { id: Date.now(), name: 'editor', path: '', paths: { source: makeSignalSettings({ id: Date.now(), name: 'source', path: './CodeEditor.tsx' }) } };
  const record = makeSignalSettings(input);
  assert.equal(record.path, '');
  assert.deepEqual(record.paths, input.paths);
  assert.notEqual(record.paths, input.paths);
  assert.equal(assertSignalSettings(record), record);
  const absent = makeSignalSettings({ id: Date.now(), name: 'editor' });
  assert.equal(Object.hasOwn(absent, 'path'), false);
  assert.equal(Object.hasOwn(absent, 'paths'), false);
  assert.deepEqual(makeSignalSettings({ ...input, paths: {} }).paths, {});
});
test('optional signal paths reject malformed values and unknown fields', () => {
  const base = makeSignalSettings({ id: Date.now(), name: 'editor' });
  for (const value of [null, false, 0, [], {}, undefined]) {
    assert.throws(() => makeSignalSettings({ ...base, path: value }));
    assert.throws(() => assertSignalSettings({ ...base, path: value }));
  }
  for (const value of [null, false, 0, '', [], undefined]) {
    assert.throws(() => makeSignalSettings({ ...base, paths: value }));
    assert.throws(() => assertSignalSettings({ ...base, paths: value }));
  }
  assert.throws(() => assertSignalSettings({ ...base, extra: true }), /canonical/);
});

test('paths recursively contain the same signal shape; path remains a string', () => {
  const leaf = makeSignalSettings({ id: Date.now(), name: 'css', path: '', signal: false, transmitting: false });
  const child = makeSignalSettings({ id: Date.now(), name: 'CodeEditor', path: './CodeEditor', paths: { css: leaf } });
  const record = makeSignalSettings({ id: Date.now(), name: 'components', path: './src/components', paths: { CodeEditor: child } });
  assert.deepEqual(record.paths.CodeEditor, child);
  assert.equal(record.paths.CodeEditor.paths.css.signal, false);
  child.paths.css.path = './changed';
  assert.equal(record.paths.CodeEditor.paths.css.path, '');
  for (const invalid of ['./file.tsx', { path: './file.tsx' }, { ...leaf, extra: true }, { ...leaf, path: {} }, { ...leaf, paths: { deeper: 'bad' } }]) {
    assert.throws(() => makeSignalSettings({ id: Date.now(), name: 'root', paths: { child: invalid } }));
    assert.throws(() => assertSignalSettings({ ...record, paths: { child: invalid } }));
  }
  const cycle = { ...leaf }; cycle.paths = { self: cycle };
  assert.throws(() => makeSignalSettings({ id: Date.now(), name: 'root', paths: { cycle } }), /cycles/);
});
