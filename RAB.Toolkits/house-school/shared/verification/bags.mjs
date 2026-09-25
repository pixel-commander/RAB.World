import { check, equal, execute } from './probe.mjs';

export const bags = (source) => [
  check('props-fallback', () => { execute(source, 'packBag(undefined)'); execute(source, 'packBag(null)'); }),
  check('bag-preservation', () => equal(execute(source, 'packBag(input).extra', { input: Object.freeze({ extra: { id: 9 } }) }), { id: 9 })),
  check('prop-name', () => equal(execute(source, 'packBag({ title: "Original" }).title'), 'Original')),
];
