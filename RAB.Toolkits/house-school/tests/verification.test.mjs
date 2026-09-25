import test from 'node:test';
import assert from 'node:assert/strict';
import { families, switches } from '../shared/catalog.mjs';
import { verify } from '../shared/verification/index.mjs';
import { execute, equal } from '../shared/verification/probe.mjs';
import { renderSpecimen, bundle } from '../shared/stamping.mjs';

test('object property order is not a repair defect', () => {
  equal({ doThat: 2, id: 'a' }, { id: 'a', doThat: 2 });
});
test('undefined properties are not silently dropped from comparison', () => {
  assert.throws(() => equal({ selected: undefined }, {}));
});
test('valid wrapper with reversed object key insertion order is accepted', () => {
  const source = `export const packBag = (props = {}) => ({ ...props,
    handleClick: (data, type) => props?.handleClick?.({ doThat: 2, id: data?.id, count: data?.count }, type)
  });`;
  assert.equal(verify('wrapping', source).checks.find((c) => c.rule === 'payload-preservation').status, 'PASS');
});
test('dropping a real caller-owned selection must fail ownership', () => {
  const source = `export const packBag = (props = {}, internal = []) => ({
    selected: props.setSelected ? undefined : internal[0],
    setSelected: props.setSelected || internal[1]
  });`;
  assert.equal(verify('selection-ownership', source).checks.find((c) => c.rule === 'setter-ownership').status, 'FAIL');
});

for (const family of families) {
  test(`${family.name}: alternate implementations and all masks`, () => {
    for (let mask = 0; mask < 8; mask++) {
      const result = verify(family.name, family.renderAlternate(switches(mask)));
      assert.equal(result.status, mask ? 'FAIL' : 'PASS', `alternate mask ${mask}`);
      for (const [index, rule] of family.rules.entries()) {
        const observed = result.checks.find((item) => item.rule === rule);
        if (observed.status === 'CANNOT_CHECK') {
          assert.equal(family.name, 'collections');
          assert.equal(rule, 'array-result');
        } else assert.equal(observed.status, switches(mask)[index] ? 'FAIL' : 'PASS', rule);
      }
    }
  });
  test(`${family.name}: every mutation mask has the expected aggregate outcome`, () => {
    for (let mask = 0; mask < 8; mask++) {
      const result = verify(family.name, family.render(switches(mask)));
      assert.equal(result.status, mask ? 'FAIL' : 'PASS', `mask ${mask}`);
      if (!mask) assert.ok(result.checks.every((check) => check.status === 'PASS'));
    }
  });
  test(`${family.name}: replay is byte-identical`, async () => {
    for (const packaging of ['isolated', 'component']) {
      assert.equal(bundle(await renderSpecimen(family, switches(7), packaging)), bundle(await renderSpecimen(family, switches(7), packaging)));
    }
  });
}

test('alternate collection repair: fallback before map is accepted', () => {
  const source = `export const readLabels = (props) => (props?.items || []).map((item) => item?.label || '');`;
  assert.equal(verify('collections', source).status, 'PASS');
});
test('alternate collection repair: explicit early return is accepted', () => {
  const source = `export const readLabels = (props) => {
    if (!props?.items) return [];
    return props.items.map((item) => item?.label || '');
  };`;
  assert.equal(verify('collections', source).status, 'PASS');
});
test('alternate bag repair: spread directly preserves the contract', () => {
  assert.equal(verify('bags', 'export const packBag = (props) => ({ ...(props || {}) });').status, 'PASS');
});
test('supplied setter + undefined selection does not switch owners', () => {
  const family = families.find((item) => item.name === 'selection-ownership');
  const parent = () => {}, local = () => {};
  const input = Object.freeze({ selected: undefined, setSelected: parent, title: 'Untouched' });
  const result = execute(family.render(switches(0)), 'packBag(input, internal)', { input, internal: ['local', local] });
  assert.equal(result.setSelected, parent);
  assert.equal(result.selected, undefined);
  assert.equal(result.title, 'Untouched');
});
test('wrapper does not mutate payload or caller bag', () => {
  const source = families.find((item) => item.name === 'wrapping').render(switches(0));
  const data = Object.freeze({ id: 'keep' });
  const calls = [];
  const handleClick = (...args) => calls.push(args);
  const input = Object.freeze({ handleClick, title: 'Keep' });
  execute(source, 'packBag(input).handleClick(data, "save")', { input, data });
  equal(calls, [[{ id: 'keep', doThat: 2 }, 'save']]);
  equal(data, { id: 'keep' });
  assert.equal(input.handleClick, handleClick);
});
test('masked fallback is CANNOT_CHECK, never invented PASS', () => {
  const source = families.find((item) => item.name === 'collections').render(switches(7));
  const result = verify('collections', source);
  assert.equal(result.checks.find((check) => check.rule === 'array-result').status, 'CANNOT_CHECK');
});
test('unknown reviewer is CANNOT_CHECK', () => {
  assert.equal(verify('unknown', '').status, 'CANNOT_CHECK');
});
