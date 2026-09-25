// Separate training structures; never imports the fresh evaluation renderer.
export const targeted = (family, defect, variant) => {
  const result = variant ? 'Object.assign({}, props)' : '{ ...props }';
  if (family === 'handlers') return `export const packBag = (props) => {
    const bag = ${result};
    bag.${defect === 2 ? 'pickThing' : 'handleClick'} = (data, type) => {
      ${defect === 3 ? '' : 'if (props == null) return;'}
      if (props.handleClick === undefined) return;
      return props.handleClick(${defect === 1 ? 'type, data' : 'data, type'});
    };
    return bag;
  };`;
  if (family === 'wrapping') return `export const packBag = (props) => {
    const bag = ${result};
    const mergePayload = (data) => ({ ${defect === 1 ? '' : '...data, '}doThat: 2 });
    bag.handleClick = (data, type) => {
      if (props == null || props.handleClick === undefined) return;
      ${defect === 3 ? 'props.handleClick(mergePayload(data), type);' : ''}
      props.handleClick(mergePayload(data), ${defect === 2 ? 'undefined' : 'type'});
    };
    return bag;
  };`;
  if (family === 'bags') return `export const packBag = (props) => {
    const receive = (input) => {
      ${defect === 1 ? '' : 'if (input == null) input = {};'}
      const { title, ...other } = input;
      const bag = ${defect === 2 ? '{}' : '{ ...other }'};
      bag.${defect === 3 ? 'heading' : 'title'} = title;
      return bag;
    };
    return receive(props);
  };`;
  if (family === 'collections') return `export const readLabels = (props) => {
    const read = (items) => {
      ${defect === 1 ? '' : `if (items == null) return ${defect === 3 ? 'undefined' : '[]'};`}
      return Array.from(items, (entry) => ${defect === 2 ? "entry.label || ''" : "entry == null ? '' : entry.label || ''"});
    };
    return read(props?.items);
  };`;
  if (family === 'selection-ownership') return `export const packBag = (props, internal_selected) => {
    const resolvePair = () => {
      if (${defect === 1 ? 'props?.setSelected !== undefined' : 'typeof props?.setSelected === "function"'}) return [props?.selected, props.setSelected];
      return ${defect === 2 ? '[undefined, internal_selected[1]]' : 'internal_selected'};
    };
    const [selected, setSelected] = resolvePair();
    return { ...props, ${defect === 3 ? 'this_selected: selected' : 'selected'}, setSelected };
  };`;
  throw new Error(family);
};
