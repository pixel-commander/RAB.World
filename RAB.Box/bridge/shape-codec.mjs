const isRecord = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

// Canonical, JSON-safe projection used by receipts/replay. Repeated/cyclic runtime
// objects are represented by stable path references instead of recursing forever.
export const canonicalizeShape = (value, state = null, at = '$') => {
  const ctx = state ?? { seen:new WeakMap() };
  if (typeof value === 'function') return { kind:'runtime-value', type:'function', name:value.name || null };
  if (typeof value === 'bigint') return { kind:'runtime-value', type:'bigint', value:String(value) };
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    if (ctx.seen.has(value)) return { kind:'reference', path:ctx.seen.get(value) };
    ctx.seen.set(value,at);
    return value.map((item,index)=>canonicalizeShape(item,ctx,`${at}[${index}]`));
  }
  if (!isRecord(value)) return value;
  if (ctx.seen.has(value)) return { kind:'reference', path:ctx.seen.get(value) };
  ctx.seen.set(value,at);
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalizeShape(value[key],ctx,`${at}.${key}`)]));
};

export const encodeShape = shape => JSON.stringify(canonicalizeShape(shape));
export const decodeShape = text => canonicalizeShape(JSON.parse(String(text)));
export const shapeEquals = (a,b) => encodeShape(a) === encodeShape(b);

export const unresolvedSeat = name => ({ kind:'seat', name, state:'unresolved' });
export const resolvedSeat = (name,value,{source=null,owner=null}={}) => ({ kind:'seat', name, state:'resolved', value, source, owner });
