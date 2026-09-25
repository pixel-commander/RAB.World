import { own, equal, insist, fail, bind, clone } from './core.mjs';

export const tokenize = input => {
  insist(typeof input === 'string' && input.length > 0 && input.length <= 8192, 'INVALID_INPUT', 'Supply a sentence of 1–8192 characters.');
  const tokens = [], ends = { '"': '"', "'": "'", '“': '”', '‘': '’' };
  let i = 0;
  while (i < input.length) {
    if (/\s/u.test(input[i])) { i++; continue; }
    const start = i, c = input[i];
    if (own(ends, c)) {
      let value = '', closed = false;
      i++;
      while (i < input.length) {
        const ch = input[i++];
        if (ch === ends[c]) { closed = true; break; }
        if (ch === '\\') {
          const next = input[i++];
          insist(next === ends[c] || next === '\\', 'UNSUPPORTED_LANGUAGE', 'Only a quote or backslash may be escaped inside a literal.');
          value += next;
        } else value += ch;
      }
      insist(closed, 'UNSUPPORTED_LANGUAGE', 'Unclosed quoted literal.', { at: start });
      tokens.push({ kind: 'literal', value, raw: input.slice(start, i), start, end: i });
      continue;
    }
    if (',=.!?'.includes(c)) { tokens.push({ kind: 'punctuation', value: c, raw: c, start, end: ++i }); continue; }
    const match = /^(?:[A-Za-z0-9_\/\\-][A-Za-z0-9_.\/\\-]*)(?:['’][A-Za-z]+)?/u.exec(input.slice(i));
    insist(match, 'UNSUPPORTED_LANGUAGE', 'A character has no rule in this grammar; nothing was discarded.', { at: i, text: c });
    let raw = match[0];
    if (raw.endsWith('.') && raw !== '.') raw = raw.slice(0, -1);
    insist(raw, 'UNSUPPORTED_LANGUAGE', 'Unsupported token.');
    i += raw.length;
    tokens.push({ kind: 'word', value: raw.toLowerCase().replaceAll('’', "'"), raw, start, end: i });
  }
  insist(tokens.length > 0 && tokens.length <= 512, 'INVALID_INPUT', 'Supply 1–512 lexical units.');
  return tokens;
};

const phraseTokens = text => text.trim().toLowerCase().split(/\s+/u);
const matchAt = (tokens, i, phrase) => {
  const words = phraseTokens(phrase);
  return words.every((word, n) => tokens[i + n]?.kind === 'word' && tokens[i + n].value === word) ? words.length : 0;
};

export const findHeads = (text, project) => {
  let tokens = tokenize(text);
  let mode = 'command', start = 0;
  if (tokens[start]?.value === 'please') start++;
  if (tokens[start]?.value === 'can' && tokens[start + 1]?.value === 'you') { mode = 'query'; start += 2; }
  if (['.', '!', '?'].includes(tokens.at(-1)?.value)) {
    insist(tokens.at(-1).value !== '?' || mode === 'query', 'UNSUPPORTED_LANGUAGE', 'A question mark must not be silently converted into a command. Use an explicit supported query.');
    tokens = tokens.slice(0, -1);
  }
  const results = [];
  for (const [capability, entry] of Object.entries(project.manifest.stamps)) {
    if (!entry.language) continue;
    for (const verb of entry.language.verbs) {
      const matchedVerb = matchAt(tokens, start, verb);
      if (!matchedVerb) continue;
      let i = start + matchedVerb;
      if (['a', 'an'].includes(tokens[i]?.value)) i++;
      if (tokens[i]?.value === 'new') i++;
      for (const phrase of new Set([capability, ...entry.language.names])) {
        const n = matchAt(tokens, i, phrase);
        if (n) results.push({ capability, mode, tokens: tokens.slice(i + n), prefix: text.slice(0, tokens[i + n - 1].end) });
      }
    }
  }
  const unique = new Map(results.map(x => [JSON.stringify([x.capability, x.mode, x.tokens.map(y => y.start)]), x]));
  insist(unique.size > 0, 'UNSUPPORTED_LANGUAGE', 'No registered command construction matches. Unknown input was not stripped.', { text });
  insist(new Set([...unique.values()].map(x => x.capability)).size === 1, 'AMBIGUOUS', 'More than one registered capability matches this wording.', { capabilities: [...new Set([...unique.values()].map(x => x.capability))] });
  return [...unique.values()];
};

export const fieldBindings = family => {
  const inherited = new Set();
  for (const stamp of family.values()) for (const dep of stamp.entry.dependencies ?? []) for (const key of Object.keys(dep.bindings)) inherited.add(`${dep.capability}.${key}`);
  const fields = [];
  for (const stamp of family.values()) for (const [key, field] of Object.entries(stamp.settings.options)) {
    const id = `${stamp.name}.${key}`;
    const prefixes = new Set([id, ...(!inherited.has(id) ? [key, ...(field.language?.prefixes ?? [])] : [])]);
    fields.push({ id, capability: stamp.name, key, field, prefixes: [...prefixes], inherited: inherited.has(id) });
  }
  return fields;
};

export const parseModifiers = (tokens, fields) => {
  const complete = [], problems = [];
  let attempts = 0, farthest = 0;
  const walk = (i, values, evidence, trace) => {
    insist(++attempts <= 4096, 'UNSUPPORTED_LANGUAGE', 'Grammar branching limit reached; use explicit field names.');
    farthest = Math.max(farthest, i);
    if (i === tokens.length) { complete.push({ values, evidence, trace }); return; }
    if (tokens[i]?.value === ',' || tokens[i]?.value === 'and') {
      if (!trace.length || i + 1 >= tokens.length || [',', 'and'].includes(tokens[i + 1].value)) return;
      walk(i + 1, values, evidence, trace);
      return;
    }
    const candidates = [];
    for (const descriptor of fields) {
      const { field, inherited } = descriptor;
      if (!inherited && field.type === 'boolean') for (const truth of ['true', 'false']) for (const phrase of field.language?.[truth] ?? []) {
        const n = matchAt(tokens, i, phrase);
        if (n) candidates.push({ descriptor, value: truth === 'true', end: i + n, source: 'boolean-phrase' });
      }
      for (const prefix of descriptor.prefixes) {
        const n = matchAt(tokens, i, prefix);
        if (!n) continue;
        let at = i + n;
        if (tokens[at]?.value === '=') at++;
        const referenceMatches = Object.entries(field.language?.references ?? {}).flatMap(([phrase, value]) => {
          const width = matchAt(tokens, at, phrase);
          return width ? [{ descriptor, value, end: at + width, source: 'declared-reference' }] : [];
        });
        if (referenceMatches.length) { candidates.push(...referenceMatches); continue; }
        const token = tokens[at];
        if (!token || !['word', 'literal'].includes(token.kind)) continue;
        let value = token.kind === 'literal' ? token.value : token.raw;
        if (field.type === 'boolean') {
          const table = { true: true, yes: true, false: false, no: false };
          if (!own(table, String(value).toLowerCase())) continue;
          value = table[String(value).toLowerCase()];
        }
        if (field.type === 'number') { value = Number(value); if (!Number.isFinite(value)) continue; }
        candidates.push({ descriptor, value, end: at + 1, source: 'explicit-text' });
      }
    }
    for (const candidate of candidates) {
      const v = { ...values }, e = clone(evidence), { descriptor } = candidate;
      const item = { source: candidate.source, raw: tokens.slice(i, candidate.end).map(x => x.raw).join(' '), start: tokens[i].start, end: tokens[candidate.end - 1].end, role: descriptor.field.role ?? null };
      try { bind(v, e, descriptor.id, candidate.value, item); }
      catch (error) { problems.push(error); continue; }
      walk(candidate.end, v, e, [...trace, { field: descriptor.id, ...item }]);
    }
  };
  walk(0, {}, {}, []);
  const distinct = new Map(complete.map(x => [JSON.stringify(Object.entries(x.values).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)), x]));
  if (!distinct.size && problems.length) throw problems[0];
  insist(distinct.size > 0, 'UNSUPPORTED_LANGUAGE', 'Some input has no supported attachment. No partial command may execute.', { at: tokens[farthest]?.start ?? null, remaining: tokens.slice(farthest).map(x => x.raw).join(' ') });
  insist(distinct.size === 1, 'AMBIGUOUS', 'Words fit more than one seat. Use a qualified field name.', { possibilities: [...distinct.values()].map(x => x.values) });
  return [...distinct.values()][0];
};

export const expandBindings = flat => {
  const result = {};
  for (const [qualified, value] of Object.entries(flat)) {
    const split = qualified.lastIndexOf('.');
    const capability = qualified.slice(0, split), key = qualified.slice(split + 1);
    result[capability] ??= {};
    result[capability][key] = value;
  }
  return result;
};
