import assert from 'node:assert/strict';
import { callback, check, equal, execute } from './probe.mjs';

// Guard the receiving bag as well as the optional callback; default parameters
// cover undefined, but not null. Keep naming defects in handler-name.
const checkCallbackGuard = (source) => {
  for (const input of [undefined, null, {}, { handleClick: undefined }]) {
    execute(source, 'const bag = packBag(input); (bag.handleClick || bag.pickThing)();', { input });
  }
};

export const handlers = (source) => [
  check('argument-order', () => equal(callback(source, { id: 'a' }, 'choose')[0], [{ id: 'a' }, 'choose'])),
  check('handler-name', () => assert.equal(execute(source, 'typeof packBag({}).handleClick'), 'function')),
  check('callback-guard', () => checkCallbackGuard(source)),
];
export const wrapping = (source) => [
  check('payload-preservation', () => {
    const calls = callback(source, { id: 'a', count: 7, doThat: 99 }, 'choose');
    assert.ok(calls.length);
    calls.forEach(([data]) => equal(data, { id: 'a', count: 7, doThat: 2 }));
  }),
  check('type-forwarding', () => {
    const calls = callback(source, {}, 'choose');
    assert.ok(calls.length);
    calls.forEach(([, type]) => assert.equal(type, 'choose'));
  }),
  check('callback-count', () => assert.equal(callback(source, {}, 'choose').length, 1)),
];
