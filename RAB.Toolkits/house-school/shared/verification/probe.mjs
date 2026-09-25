import vm from 'node:vm';
import assert from 'node:assert/strict';

// ONLY our generated fixtures: vm is not a security sandbox for model output.
export const execute = (source, expression, bindings = {}) => {
  const context = vm.createContext({ ...bindings });
  return vm.runInContext(`${source.replace(/export const /g, 'const ')}\n${expression}`, context, { timeout: 300 });
};
export const equal = (actual, expected) => assert.deepStrictEqual(structuredClone(actual), structuredClone(expected));
export const check = (name, action) => {
  try { action(); return { rule: name, status: 'PASS' }; }
  catch (error) { return { rule: name, status: 'FAIL', reason: error.message }; }
};
export const callback = (source, data, type, props = {}) => {
  const calls = [];
  execute(source, 'const bag = packBag(input); const handler = bag.handleClick || bag.pickThing; handler(data, type);', {
    input: { ...props, handleClick: (...args) => calls.push(args) }, data, type,
  });
  return calls;
};
