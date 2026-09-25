export const family = {
  name: 'bags', entry: 'packBag',
  rules: ['props-fallback', 'bag-preservation', 'prop-name'],
  contract: 'Props may be absent or null. Preserve title under its canonical key and every other supplied bag field. Return a new bag without mutating input.',
  renderAlternate: ([guard, preserve, rename]) => `export const packBag = (props) => {
  ${guard ? '' : 'props = props || {};'}
  const { ${rename ? 'title: heading' : 'title'}, ...rest } = props;
  return Object.assign({}, ${preserve ? '' : 'rest, '}{ ${rename ? 'heading' : 'title'} });
};`,
  render: ([guard, preserve, rename]) => `export const packBag = (props) => {
  const { ${rename ? 'title: heading' : 'title'}, ...rest } = ${guard ? 'props' : 'props || {}'};
  return { ${preserve ? '' : '...rest, '}${rename ? 'heading' : 'title'} };
};`,
};
