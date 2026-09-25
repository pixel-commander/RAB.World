export const family = {
  name: 'wrapping', entry: 'packBag',
  rules: ['payload-preservation', 'type-forwarding', 'callback-count'],
  contract: 'Wrap handleClick under its canonical key. Add doThat:2, preserve incoming payload fields and type, call original once. Missing callback/data allowed; supplied callback is callable.',
  renderAlternate: ([payload, dispatch, count]) => `export const packBag = (props = {}) => {
  /** @type {import('./HouseKeys.types').HandlerKey} */
  const handleClick = (data, type) => {
    if (!props?.handleClick) return;
    ${count ? 'props.handleClick(Object.assign({}, data || {}, { doThat: 2 }), type);' : ''}
    return props.handleClick(Object.assign({}, ${payload ? '' : 'data || {}, '}{ doThat: 2 }), ${dispatch ? 'undefined' : 'type'});
  };
  return Object.assign({}, props, { handleClick });
};`,
  render: ([payload, dispatch, count]) => `export const packBag = (props = {}) => {
  /** @type {import('./HouseKeys.types').HandlerKey} */
  const handleClick = (data, type) => {
    props?.handleClick?.({ ${payload ? '' : '...(data || {}), '}doThat: 2 }, ${dispatch ? 'undefined' : 'type'});
    ${count ? 'props?.handleClick?.({ ...(data || {}), doThat: 2 }, type);' : ''}
  };
  return { ...props, handleClick };
};`,
};
