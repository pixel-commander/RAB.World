export const family = {
  name: 'collections', entry: 'readLabels',
  rules: ['collection-guard', 'item-guard', 'array-result'],
  contract: 'items may be null/undefined or an array of items, including missing items. Return an array of labels, using an empty string for a missing item/label. Missing collection must return []. Wrong-type collections are outside this fixture contract.',
  renderAlternate: ([collection, item, fallback]) => `export const readLabels = (props = {}) => {
  const items = props?.items;
  ${collection ? '' : `if (!items) return ${fallback ? 'undefined' : '[]'};`}
  const labels = items.map((item) => {
    ${item ? '' : "if (!item) return '';"}
    return item.label || '';
  });
  return labels${fallback ? '' : ' || []'};
};`,
  render: ([collection, item, fallback]) => `export const readLabels = (props = {}) => {
  const items = props?.items;
  return items${collection ? '.' : '?.'}map((item) => item${item ? '.' : '?.'}label || '')${fallback ? '' : ' || []'};
};`,
};
