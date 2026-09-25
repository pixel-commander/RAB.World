// Read flat rules without confusing quoted values, comments, or nested scopes.
export const splitCssList = (source, separator = ',') => {
  const parts = []; let start = 0, quote = '', comment = false, depth = 0;
  for (let i = 0; i < source.length; i++) {
    const c = source[i], next = source[i + 1];
    if (comment) { if (c === '*' && next === '/') { comment = false; i++; } continue; }
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = ''; continue; }
    if (c === '/' && next === '*') { comment = true; i++; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '(' || c === '[') depth++;
    if (c === ')' || c === ']') depth--;
    if (!depth && c === separator) { parts.push(source.slice(start, i).trim()); start = i + 1; }
  }
  parts.push(source.slice(start).trim());
  return parts.filter(Boolean);
};

export const parseDeclarations = input => {
  let value = input;
  if (typeof value === 'string') {
    value = value.trim();
    if (value.startsWith('{')) { try { value = JSON.parse(value); } catch {} }
  }
  let pairs;
  if (value && typeof value === 'object' && !Array.isArray(value)) pairs = Object.entries(value).map(([property, item]) => [property.trim(), String(item).trim()]);
  else {
    const text = String(value === undefined || value === null ? '' : value).trim();
    if (!text) throw Object.assign(new Error('styles are required.'), { code: 'INPUT_REQUIRED' });
    pairs = splitCssList(text, ';').map(piece => {
      const index = piece.indexOf(':');
      if (index < 1) throw Object.assign(new Error(`Invalid CSS declaration: ${piece}`), { code: 'BAD_REQUEST' });
      return [piece.slice(0, index).trim(), piece.slice(index + 1).trim()];
    });
  }
  if (!pairs.length) throw Object.assign(new Error('No CSS declarations were parsed.'), { code: 'BAD_REQUEST' });
  for (const [property, item] of pairs) {
    if (!/^(?:--[A-Za-z0-9_-]+|[A-Za-z][A-Za-z0-9-]*)$/.test(property) || !item || /[{}]|@import/i.test(item)) throw Object.assign(new Error(`Unsafe or invalid CSS declaration: ${property}`), { code: 'BAD_REQUEST' });
  }
  return pairs;
};

export const readCssRules = source => {
  const rules = [], stack = []; let start = 0, quote = '', comment = false, depth = 0;
  for (let i = 0; i < source.length; i++) {
    const c = source[i], next = source[i + 1];
    if (comment) { if (c === '*' && next === '/') { comment = false; i++; } continue; }
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = ''; continue; }
    if (c === '/' && next === '*') { comment = true; i++; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '(' || c === '[') depth++;
    if (c === ')' || c === ']') depth--;
    if (depth) continue;
    if (c === '{') {
      const header = source.slice(start, i);
      const leading = /^(?:\s|\/\*[\s\S]*?\*\/)*/.exec(header)[0].length;
      const selector = header.slice(leading).trim();
      if (stack.length) stack.at(-1).nested = true;
      stack.push({ start: start + leading, open: i, selector, scope: stack.map(x => x.selector).join('\u0000'), nested: false });
      start = i + 1;
    } else if (c === '}') {
      const rule = stack.pop();
      if (!rule) throw Object.assign(new Error('Unbalanced CSS braces.'), { code: 'BAD_REQUEST' });
      if (!rule.nested && !rule.selector.startsWith('@')) rules.push({ ...rule, end: i + 1, body: source.slice(rule.open + 1, i), selectors: splitCssList(rule.selector) });
      start = i + 1;
    } else if (c === ';' && !stack.length) start = i + 1;
  }
  if (stack.length || quote || comment || depth) throw Object.assign(new Error('Incomplete CSS rule.'), { code: 'BAD_REQUEST' });
  return rules;
};
