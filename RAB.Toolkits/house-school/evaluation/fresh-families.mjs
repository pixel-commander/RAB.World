// Authored holdout structures, not mutations of the training templates.
// bad=0 is clean; 1..3 each inject one explicit contract violation.
export const renderFresh = (family, variant, bad) => {
  const finish = variant ? 'return Object.assign({}, result);' : 'return { ...result };';
  if (family === 'handlers') return `export const packBag = (props) => {
    const forward = (data, type) => {
      const caller = ${bad === 3 ? 'props.handleClick' : 'props?.handleClick'};
      if (caller === undefined) return;
      return caller(${bad === 1 ? 'type, data' : 'data, type'});
    };
    const result = { ...props, ${bad === 2 ? 'pickThing' : 'handleClick'}: forward };
    ${finish}
  };`;
  if (family === 'wrapping') return `export const packBag = (props) => {
    const extend = (data) => Object.assign({}, ${bad === 1 ? '' : 'data, '}{ doThat: 2 });
    const handleClick = (data, type) => {
      if (!props?.handleClick) return;
      const payload = extend(data);
      ${bad === 3 ? 'props.handleClick(payload, type);' : ''}
      props.handleClick(payload, ${bad === 2 ? 'undefined' : 'type'});
    };
    const result = Object.assign({}, props, { handleClick });
    ${finish}
  };`;
  if (family === 'bags') return `export const packBag = (props) => {
    const copy = (input) => {
      const { title, ...rest } = ${bad === 1 ? 'input' : 'input ?? {}'};
      return { ${bad === 2 ? '' : '...rest, '}${bad === 3 ? 'heading: title' : 'title'} };
    };
    const result = copy(props);
    ${finish}
  };`;
  if (family === 'collections') return `export const readLabels = (props) => {
    const items = props?.items;
    ${bad === 1 ? '' : `if (items == null) return ${bad === 3 ? 'undefined' : '[]'};`}
    const result = [];
    ${variant ? `for (let index = 0; index < items.length; index += 1) {
      const item = items[index];` : 'for (const item of items) {'}
      result.push(item${bad === 2 ? '.' : '?.'}label || '');
    }
    return result;
  };`;
  if (family === 'selection-ownership') return `export const packBag = (props, internal_selected) => {
    const result = { ...props };
    const supplied = props?.setSelected;
    if (${bad === 1 ? 'supplied !== undefined' : 'typeof supplied === "function"'}) {
      Object.assign(result, { selected: props?.selected, setSelected: supplied });
    } else {
      const [value, setter] = internal_selected;
      Object.assign(result, { selected: ${bad === 2 ? 'undefined' : 'value'}, setSelected: setter });
    }
    ${bad === 3 ? 'result.this_selected = result.selected; delete result.selected;' : ''}
    ${finish}
  };`;
  throw new Error(`Unknown family ${family}`);
};
