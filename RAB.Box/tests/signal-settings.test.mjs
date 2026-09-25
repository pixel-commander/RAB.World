import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSignalSettings, SIGNAL_KEYS } from '../bridge/rab-node.mjs';
test('signals use exact fields and preserve false', () => {
  const record = makeSignalSettings({ id: Date.now(), name: 'sample', type: 'action-atom', signal: false, transmitting: false });
  assert.deepEqual(Object.keys(record), SIGNAL_KEYS);
  assert.equal(record.signal, false);
  assert.equal(record.transmitting, false);
  assert.ok(Number.isSafeInteger(record.date_created));
  assert.throws(() => makeSignalSettings({ ...record, meta: {} }), /Unexpected/);
  assert.throws(() => makeSignalSettings({ ...record, signal: 'true' }), /flags/);
});
