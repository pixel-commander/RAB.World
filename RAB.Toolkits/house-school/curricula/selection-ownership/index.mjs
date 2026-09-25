export const family = {
  name: 'selection-ownership', entry: 'packBag',
  rules: ['setter-ownership', 'local-pair', 'selection-name'],
  contract: 'A supplied callable setSelected means caller ownership, even when selected is undefined. Otherwise use the supplied internal state pair. Forward selected and setSelected unchanged in name, preserve other props. Hook invocation belongs to the component and is unconditional.',
  renderAlternate: ([ownership, pair, rename]) => `export const packBag = (props = {}, internal_selected = [undefined, () => {}]) => {
  const callerOwned = ${ownership ? 'props?.selected !== undefined' : 'typeof props?.setSelected === "function"'};
  const selected = callerOwned ? props?.selected : internal_selected[0];
  const setSelected = callerOwned ? props?.setSelected : ${pair ? 'undefined' : 'internal_selected[1]'};
  const bag = { ...props };
  ${rename ? 'delete bag.selected;' : ''}
  return { ...bag, ${rename ? 'this_selected: selected' : 'selected'}, setSelected };
};`,
  render: ([ownership, pair, rename]) => `export const packBag = (props = {}, internal_selected = [undefined, () => {}]) => {
  let { selected, setSelected, ...rest } = props || {};
  if (${ownership ? 'selected === undefined' : 'typeof setSelected !== "function"'}) {
    selected = internal_selected[0];
    ${pair ? '' : 'setSelected = internal_selected[1];'}
  }
  return { ...rest, ${rename ? 'this_selected: selected' : 'selected'}, setSelected };
};`,
};
