import test from 'node:test';
import assert from 'node:assert/strict';
import { classify, summarize } from '../shared/active-review.mjs';

test('excluded uncertainty is neither false pass nor false failure', () => {
  const record = classify({ id: 'masked', expected: 'FAIL', checks: [{ status: 'CANNOT_CHECK' }] });
  assert.equal(record.admitted, false);
  assert.equal('verdict' in record, false);
  assert.deepEqual(summarize([record]), { total: 1, admitted: 0, excluded: 1, falsePasses: 0, falseFailures: 0, disagreements: [] });
});
test('fourth correction excludes a rule even if its latest check passes', () => {
  const row = { id: 'unstable', expected: 'PASS', checks: [{ status: 'PASS' }] };
  assert.equal(classify({ ...row, corrections: 3 }).admitted, true);
  assert.equal(classify({ ...row, corrections: 4 }).admitted, false);
});
test('both directions of checker errors remain visible', () => {
  const records = [classify({ id: 'a', expected: 'FAIL', checks: [{ status: 'PASS' }] }),
    classify({ id: 'b', expected: 'PASS', checks: [{ status: 'FAIL' }] })];
  assert.equal(summarize(records).falsePasses, 1);
  assert.equal(summarize(records).falseFailures, 1);
});
