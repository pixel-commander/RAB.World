export const family = {
  name: 'handlers', entry: 'packBag',
  rules: ['argument-order', 'handler-name', 'callback-guard'],
  contract: 'Forward handleClick under the same key. It accepts (data, type), not (type, data). Callback may be absent but, when supplied, is callable. Preserve other bag fields.',
  renderAlternate: ([order, rename, guard]) => `export const packBag = (props = {}) => {
  const bag = { ...props };
  /** @type {import('./HouseKeys.types').HandlerKey} */
  const handleClick = (${order ? 'type, data' : 'data, type'}) => {
    ${guard ? '' : 'if (!props?.handleClick) return;'}
    return props.handleClick(data, type);
  };
  ${rename ? 'delete bag.handleClick;\n  return { ...bag, pickThing: handleClick };' : 'return { ...bag, handleClick };'}
};`,
  render: ([order, rename, guard]) => `export const packBag = (props = {}) => {
  /** @type {import('./HouseKeys.types').HandlerKey} */
  const ${rename ? 'pickThing' : 'handleClick'} = (${order ? 'type, data' : 'data, type'}) => props?.handleClick${guard ? '' : '?.'}(data, type);
  return { ...props, ${rename ? 'handleClick: undefined, pickThing' : 'handleClick'} };
};`,
};
