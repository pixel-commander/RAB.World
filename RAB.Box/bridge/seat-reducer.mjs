const has = (obj,key) => Object.prototype.hasOwnProperty.call(obj ?? {}, key);
export const scopeSeat = (owner,name) => `${owner}::${name}`;

export const reduceSeats = ({ current = {}, layers = [] } = {}) => {
  const next = { ...current };
  const provenance = {};
  for (const layer of layers) {
    if (!layer || typeof layer.values !== 'object' || !layer.values) continue;
    for (const [name,value] of Object.entries(layer.values)) {
      if (value === undefined) continue;
      next[name] = value;
      provenance[name] = { source:layer.source ?? 'unknown', owner:layer.owner ?? null };
    }
  }
  return { values:next, provenance };
};

export const substituteReturnedSeats = ({ parent = {}, returned = {}, bindings = null, childOwner = null } = {}) => {
  const next = { ...parent };
  const applied = [];
  const map = bindings ?? Object.fromEntries(Object.keys(returned).map(name => [name,name]));
  for (const [childName,parentName] of Object.entries(map)) {
    if (!has(returned,childName)) continue;
    next[parentName] = returned[childName];
    applied.push({ from:scopeSeat(childOwner ?? 'child',childName), to:parentName, value:returned[childName] });
  }
  return { values:next, applied };
};

export const normalForm = ({ required = [], values = {}, canReduce = false, completed = false, failed = false } = {}) => {
  if (failed) return 'failed';
  if (completed) return 'completed';
  const missing = required.filter(name => values[name] === undefined || values[name] === null || values[name] === '');
  if (!missing.length) return 'ready';
  return canReduce ? 'reducible' : 'unresolved';
};
