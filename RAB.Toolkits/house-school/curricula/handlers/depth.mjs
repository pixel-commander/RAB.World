// Bounded linear component-boundary mechanics; JSX layout is a separate lesson.
export const generateDepth = ({ depth = 1, brokenAt = null, defect = 'argument-order' } = {}) => {
  if (!Number.isInteger(depth) || depth < 1 || depth > 32) throw new RangeError('depth must be 1..32');
  if (brokenAt !== null && (!Number.isInteger(brokenAt) || brokenAt < 0 || brokenAt >= depth)) throw new RangeError('brokenAt must name a boundary');
  if (!['argument-order', 'handler-name', 'callback-guard'].includes(defect)) throw new Error('unsupported depth defect');
  const boundaries = Array.from({ length: depth }, (_, index) => {
    const broken = index === brokenAt;
    const rename = broken && defect === 'handler-name';
    const order = broken && defect === 'argument-order';
    const unguarded = broken && defect === 'callback-guard';
    return `const boundary${index} = (props = {}) => ({ ...props,
  ${rename ? 'handleClick: undefined, pickThing' : 'handleClick'}: (data, type) => props?.handleClick${unguarded ? '' : '?.'}(${order ? 'type, data' : 'data, type'})
});`;
  });
  const source = `${boundaries.join('\n')}\nexport const packBag = (props = {}) => {
  let bag = props;
${Array.from({ length: depth }, (_, index) => `  bag = boundary${index}(bag);`).join('\n')}
  return bag;
};`;
  return { source, boundarySources: boundaries.map((source, index) => source.replace(`const boundary${index}`, 'export const packBag')),
    manifest: { depth, brokenAt, defect: brokenAt === null ? null : defect,
    expected: brokenAt === null ? 'PASS' : 'FAIL', owner: 'caller', handlerKey: 'handleClick' } };
};
