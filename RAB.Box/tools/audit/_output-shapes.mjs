// Presentation only. Result descriptions come from discovered owner contracts.
export const createAuditOutputGuide = (persistence = {}) => {
  const describe = tool => {
    const shape = tool?.contract?.result;
    if (shape === undefined || shape === null) return null;
    const creation = tool?.domain === 'audit' && tool?.meta?.operation === 'create' && tool?.meta?.target_type === 'project';
    return { shape, creation, owner:tool.contract.owners?.result ?? null,
      notes:creation ? ['Creates project files; this write stamp does not produce an audit-result report.'] : ['Shown inside the saved report’s result field. Arrays show one item’s shape; they can contain zero or many items.', 'A ? marks a field that only appears for some findings or outcomes. ChildResult means the result shape of the named child tool.'],
      settings:tool.contract.settings ?? null };
  };
  const format = (shape, depth=0) => {
    if (typeof shape === 'string') return shape;
    if (shape?.$nullable) return `${format(shape.$nullable,depth)} | null`;
    if (Array.isArray(shape)) return `[${format(shape[0],depth)}]`;
    const entries=Object.entries(shape ?? {}), short=`{ ${entries.map(([key,value])=>`${key}: ${format(value,depth+1)}`).join(', ')} }`;
    if (!short.includes('\n') && short.length + depth*2 <= 100) return short;
    const indent='  '.repeat(depth);
    return `{\n${entries.map(([key,value])=>`${indent}  ${key}: ${format(value,depth+1)}`).join(',\n')}\n${indent}}`;
  };
  const guide = { describe, format, savedReport:persistence.savedReport ?? null, tracking:persistence.tracking ?? null };
  guide.setPersistence = value => { guide.savedReport = value?.savedReport ?? null; guide.tracking = value?.tracking ?? null; };
  return guide;
};
