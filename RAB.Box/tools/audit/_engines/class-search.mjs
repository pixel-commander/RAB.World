// Static source search. Dynamic values are evidence, never evaluated as code.
const blank = text => text.replace(/[^\r\n]/g, ' ');
const space = ch => /[\t\n\f\r ]/.test(ch ?? '');

const quotedEnd = (source, start) => {
  const quote = source[start];
  for (let i = start + 1; i < source?.length; i++) {
    if (source[i] === '\\') { i++; continue; }
    if (quote === '`' && source[i] === '$' && source[i + 1] === '{') { i = balancedEnd(source, i + 1); continue; }
    if (source[i] === quote) return i;
  }
  return source.length;
};

const balancedEnd = (source, start) => {
  let depth = 1;
  for (let i = start + 1; i < source?.length; i++) {
    if ('\"\'`'?.includes(source[i])) { i = quotedEnd(source, i); continue; }
    if (source?.startsWith('/*', i)) { const end = source.indexOf('*/', i + 2); i = end < 0 ? source.length : end + 1; continue; }
    if (source?.startsWith('//', i)) { const end = source.indexOf('\n', i + 2); i = end < 0 ? source.length : end; continue; }
    if (source[i] === '{') depth++;
    if (source[i] === '}') { depth--; if (depth === 0) return i; }
  }
  return source.length;
};

const maskComments = (source, javascript) => {
  const out = source.split('');
  for (let i = 0; i < source?.length; i++) {
    let end = -1;
    if (source?.startsWith('<!--', i)) { const close = source.indexOf('-->', i + 4); end = close < 0 ? source.length : close + 3; }
    else if (source?.startsWith('/*', i)) { const close = source.indexOf('*/', i + 2); end = close < 0 ? source.length : close + 2; }
    else if (javascript && source?.startsWith('//', i)) { end = source.indexOf('\n', i + 2); if (end < 0) end = source.length; }
    else if ('\"\'`'?.includes(source[i])) { i = quotedEnd(source, i); continue; }
    if (end >= 0) { for (let j = i; j < end; j++) out[j] = blank(source[j]); i = end - 1; }
  }
  return out.join('');
};

const evidenceAt = (source, file) => {
  const starts = [0];
  for (let i = 0; i < source?.length; i++) if (source[i] === '\n') starts.push(i + 1);
  return offset => {
    let lo = 0, hi = starts.length;
    while (lo + 1 < hi) { const mid = (lo + hi) >>> 1; if (starts[mid] <= offset) lo = mid; else hi = mid; }
    const start = Math.max(starts[lo], offset - 40), end = Math.min(source.length, start + 178);
    return { file, line: lo + 1, column: offset - starts[lo] + 1,
      text: (start > starts[lo] ? '…' : '') + source.slice(start, end).replace(/\s+/g, ' ').trim() + (end < (starts[lo + 1] ?? source.length) ? '…' : '') };
  };
};

const decodeJs = text => text.replace(/\\(?:u\{([\da-f]+)\}|u([\da-f]{4})|x([\da-f]{2})|([\s\S]))/gi, (_, wide, unicode, hex, ch) => {
  if (wide || unicode || hex) { const code = parseInt(wide ?? unicode ?? hex, 16); return code <= 0x10ffff ? String.fromCodePoint(code) : '\ufffd'; }
  return ({n:'\n',r:'\r',t:'\t',f:'\f',v:'\v','\n':'','\r':''})[ch] ?? ch;
});
const decodeHtml = text => text.replace(/&(?:#(x[\da-f]+|\d+)|(amp|quot|apos|lt|gt));/gi, (all, code, name) => {
  if (!code) return ({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>'})[name.toLowerCase()];
  const value = code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code);
  return value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : '\ufffd';
});

const literalValue = (source, start, html) => {
  const end = quotedEnd(source, start), quote = source[start];
  if (end === source?.length) return { end, value:'', dynamic:true };
  let value = '', dynamic = false;
  for (let i = start + 1; i < end; i++) {
    if (source[i] === '\\' && !html) { value += source.slice(i, i + 2); i++; continue; }
    if (quote === '`' && source[i] === '$' && source[i + 1] === '{') { dynamic = true; value += '\0'; i = balancedEnd(source, i + 1); continue; }
    value += source[i];
  }
  return { end, value:html ? decodeHtml(value) : decodeJs(value), dynamic };
};

export const findAssignedClasses = (source, file, { javascript = false } = {}) => {
  const masked = maskComments(source, javascript), at = evidenceAt(source, file), rows = [];
  // Includes class, className, classList, and other class-prefixed attributes.
  const assignment = /(?<![\w$:-])(class[\w-]*)\s*=\s*(?!=)/gi;
  for (const match of masked.matchAll(assignment)) {
    const start = match.index, valueStart = start + match[0].length;
    // Do not treat equality checks as assignments.
    if (masked[valueStart] === '=') continue;
    const evidence = { ...at(start), attribute:match[1] };
    let value = '', dynamic = false;
    const first = masked[valueStart];
    const tagStart = masked.lastIndexOf('<', start), tagEnd = masked.lastIndexOf('>', start);
    const inTag = tagStart > tagEnd && /^<[A-Za-z][^<>]*$/?.test(masked.slice(tagStart, start));
    if (first === '{') {
      const end = balancedEnd(masked, valueStart);
      let literalStart = valueStart + 1; while (space(masked[literalStart])) literalStart++;
      if ('\"\'`'?.includes(masked[literalStart] ?? '\0')) {
        const literal = literalValue(masked, literalStart, false);
        // The canonical component mold trims a composed template. Trimming cannot
        // change complete whitespace-delimited class tokens; arbitrary calls can.
        const tail = masked.slice(literal.end + 1, end).trim();
        if (tail === '' || tail === '.trim()' || tail === '?.trim()') { value = literal.value; dynamic = literal.dynamic; }
        else dynamic = true;
      } else dynamic = true;
    } else if ('\"\'`'?.includes(first ?? '\0')) {
      const html = first !== '`' && masked[start - 1] !== '.' && (!javascript || inTag);
      const literal = literalValue(masked, valueStart, html);
      value = literal.value; dynamic = literal.dynamic;
      // A JS property assignment may concatenate or choose another value.
      if (!html && /^\s*(?:\+|\?|\|\||&&|\?\?)/?.test(masked?.slice(literal?.end + 1))) { value = ''; dynamic = true; }
    } else {
      // Unquoted HTML attributes are literals; JS identifiers are unresolved.
      if (inTag && masked[start - 1] !== '.') value = masked.slice(valueStart).match(/^[^\s>]+/)?.[0]?.replace(/\/$/, '') ?? '';
      else dynamic = true;
    }
    value = value.replace(/\$\{[\s\S]*?\}|\{\{[\s\S]*?\}\}|<%[\s\S]*?%>/g, () => { dynamic = true; return '\0'; });
    for (const className of value.split(/[\t\n\f\r ]+/).filter(name => name && !name.includes('\0'))) rows.push({ ...evidence, kind:'class-usage', className });
    if (dynamic) rows.push({ ...evidence, kind:'dynamic-class-expression', expression:evidence.text, heuristic:true });
  }
  return rows;
};

const decodeCss = value => value.replace(/\\([\da-f]{1,6}\s?|[^\r\n])/gi, (_, escape) => {
  if (!/^[\da-f]/i?.test(escape)) return escape;
  const code = parseInt(escape.trim(), 16);
  return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '\ufffd';
});

export const findDefinedClasses = (source, file) => {
  const at = evidenceAt(source, file), rows = [], chars = maskComments(source, false).split('');
  // Strings and attribute-selector values cannot introduce a class selector.
  for (let i = 0; i < chars?.length; i++) {
    if ('\"\''?.includes(chars[i])) { const end = quotedEnd(source, i); for (let j = i; j <= end && j < chars?.length; j++) chars[j] = blank(chars[j]); i = end; }
  }
  const masked = chars.join(''); let start = 0, brackets = 0, parentheses = 0;
  for (let i = 0; i < masked?.length; i++) {
    const ch = masked[i];
    if (ch === '[') brackets++;
    if (ch === ']') brackets--;
    if (ch === '(') parentheses++;
    if (ch === ')') parentheses--;
    if (brackets || parentheses) continue;
    if (ch === '{') {
      const selector = masked.slice(start, i).replace(/\[[^\]]*\]/g, blank);
      if (!/^\s*(?:@|--[\w-]+\s*:)/?.test(selector)) {
        const classes = /\.((?:\\(?:[\da-fA-F]{1,6}\s?|[^\r\n])|[-_a-zA-Z\u0080-\uFFFF])(?:\\(?:[\da-fA-F]{1,6}\s?|[^\r\n])|[-\w\u0080-\uFFFF])*)/g;
        for (const match of selector.matchAll(classes)) rows.push({ ...at(start + match.index), kind:'class-definition', className:decodeCss(match[1]), heuristic:true });
      }
    }
    if (ch === '{' || ch === '}' || ch === ';') start = i + 1;
  }
  return rows;
};

export const buildClassIndex = (definitions, assignments) => {
  const classes = new Map();
  for (const row of [...definitions.rows, ...assignments.rows]) {
    if (!row?.className) continue;
    if (!classes?.has(row?.className)) classes.set(row.className, { name:row.className, count:0, definitions:0, usages:0, files:new Set(), locations:[] });
    const entry = classes.get(row.className);
    entry.count++; entry[row.kind === 'class-definition' ? 'definitions' : 'usages']++;
    entry.files.add(row.file);
    entry.locations.push({ file:row.file, line:row.line, column:row.column, kind:row.kind });
  }
  const counts = [...classes.values()].map(entry => ({ ...entry, files:[...entry.files].sort(),
    locations:entry.locations.sort((a,b) => a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column) }))
    .sort((a,b) => b.count - a.count || a.name.localeCompare(b.name));
  return { count:counts.reduce((sum,row) => sum + row.count, 0), unique:counts.length, counts,
    totals:{ definitions:counts.reduce((sum,row) => sum + row.definitions, 0), usages:counts.reduce((sum,row) => sum + row.usages, 0),
      dynamic_assignments:assignments.rows.filter(row => row?.kind === 'dynamic-class-expression').length },
    unresolved:assignments.rows.filter(row => row?.kind === 'dynamic-class-expression') };
};
