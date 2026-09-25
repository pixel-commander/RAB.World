import { check, equal, execute } from './probe.mjs';

export const collections = (source) => {
  const guarded = check('collection-guard', () => {
    execute(source, 'readLabels({})'); execute(source, 'readLabels({items:null})');
  });
  const result = guarded.status === 'PASS'
    ? check('array-result', () => equal(execute(source, 'readLabels({})'), []))
    : { rule: 'array-result', status: 'CANNOT_CHECK', reason: 'Missing-collection exception masks return value; inspect fallback independently.' };
  // Syntax witness is deliberately narrow, not a general JS equivalence claim.
  if (result.status === 'CANNOT_CHECK') {
    result.fallbackWitness = /\|\|\s*\[\]/.test(source);
  }
  return [guarded,
    check('item-guard', () => equal(execute(source, 'readLabels({ items: [undefined, null, {label:"A"}] })'), ['', '', 'A'])),
    result];
};
