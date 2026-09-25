import assert from 'node:assert/strict';
import { check, equal, execute } from './probe.mjs';

const select = (source, input, internal) => execute(source, 'packBag(input, internal)', { input, internal });
export const ownership = (source) => [
  check('setter-ownership', () => {
    const parent = () => {}, local = () => {};
    for (const selected of [undefined, '', 'parent']) {
      const output = select(source, { selected, setSelected: parent }, ['local', local]);
      assert.equal(output.setSelected, parent);
      assert.equal(Object.hasOwn(output, 'selected') ? output.selected : output.this_selected, selected);
    }
  }),
  check('local-pair', () => {
    const local = () => {};
    const output = select(source, {}, ['local', local]);
    assert.equal(output.setSelected, local);
    equal(output.selected ?? output.this_selected, 'local');
  }),
  check('selection-name', () => {
    const output = select(source, { selected: 'parent', setSelected: () => {} }, ['local', () => {}]);
    assert.ok(Object.hasOwn(output, 'selected'));
    assert.ok(!Object.hasOwn(output, 'this_selected'));
  }),
];
