import path from 'node:path';
import { CODE_EXTS, walkFiles, readText, slash } from './_shared.mjs';

export const lineOf = (source, offset) => source.slice(0, Math.max(0, offset)).split('\n').length;
export const lineTextAt = (source, offset) => source.split(/\r?\n/)[lineOf(source, offset) - 1]?.trim() ?? '';
export const rel = (root, file) => slash(path.relative(root, file));
export const isCodeFile = file => CODE_EXTS.has(path.extname(file).toLowerCase());
export const scanFiles = root => walkFiles(root);
export const read = readText;

const blank = ch => ch === '\n' || ch === '\r' ? ch : ' ';

export const maskComments = source => {
  const out = [...source];
  let state = 'code';
  for (let i = 0; i < source.length; i++) {
    const ch = source[i], next = source[i + 1];
    if (state === 'line') {
      if (ch === '\n') state = 'code'; else out[i] = blank(ch);
      continue;
    }
    if (state === 'block') {
      if (ch === '*' && next === '/') { out[i] = out[i + 1] = ' '; i++; state = 'code'; }
      else out[i] = blank(ch);
      continue;
    }
    if (state === 'single' || state === 'double' || state === 'template') {
      const quote = state === 'single' ? "'" : state === 'double' ? '"' : '`';
      if (ch === '\\') { i++; continue; }
      if (ch === quote) state = 'code';
      continue;
    }
    if (ch === '/' && next === '/') { out[i] = out[i + 1] = ' '; i++; state = 'line'; continue; }
    if (ch === '/' && next === '*') { out[i] = out[i + 1] = ' '; i++; state = 'block'; continue; }
    if (ch === "'") state = 'single';
    else if (ch === '"') state = 'double';
    else if (ch === '`') state = 'template';
  }
  return out.join('');
};

export const maskCommentsAndStrings = source => {
  const out = [...source];
  let state = 'code';
  for (let i = 0; i < source.length; i++) {
    const ch = source[i], next = source[i + 1];
    if (state === 'line') {
      if (ch === '\n') state = 'code'; else out[i] = blank(ch);
      continue;
    }
    if (state === 'block') {
      if (ch === '*' && next === '/') { out[i] = out[i + 1] = ' '; i++; state = 'code'; }
      else out[i] = blank(ch);
      continue;
    }
    if (state === 'single' || state === 'double' || state === 'template') {
      const quote = state === 'single' ? "'" : state === 'double' ? '"' : '`';
      if (ch === '\\') { out[i] = blank(ch); if (i + 1 < out.length) out[++i] = blank(source[i]); continue; }
      out[i] = blank(ch);
      if (ch === quote) state = 'code';
      continue;
    }
    if (ch === '/' && next === '/') { out[i] = out[i + 1] = ' '; i++; state = 'line'; continue; }
    if (ch === '/' && next === '*') { out[i] = out[i + 1] = ' '; i++; state = 'block'; continue; }
    if (ch === "'") { out[i] = ' '; state = 'single'; }
    else if (ch === '"') { out[i] = ' '; state = 'double'; }
    else if (ch === '`') { out[i] = ' '; state = 'template'; }
  }
  return out.join('');
};

export const allMatches = (regex, source) => {
  const flags = regex.flags.includes('g') ? regex.flags : regex.flags + 'g';
  const re = new RegExp(regex.source, flags);
  const out = [];
  for (let match = re.exec(source); match; match = re.exec(source)) {
    out.push(match);
    if (match[0] === '') re.lastIndex++;
  }
  return out;
};

export const expressionPort = value => {
  const expression = String(value ?? '').trim().replace(/[),;]+$/g, '').trim();
  return { expression, resolved: /^\d+$/.test(expression) ? Number(expression) : null };
};

export const compactSnippet = (source, offset, width = 180) => {
  const line = lineTextAt(source, offset).replace(/\s+/g, ' ');
  return line.length > width ? line.slice(0, width - 1) + '…' : line;
};

export const extractBalancedCall = (source, openIndex) => {
  let depth = 0, quote = null, escaped = false;
  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '(') depth++;
    else if (ch === ')' && --depth === 0) return source.slice(openIndex, i + 1);
  }
  return null;
};

export const isCodePosition = (masked, index) => {
  const ch = masked[index];
  return ch !== undefined && !/\s/.test(ch);
};

export const splitTopLevelArgs = call => {
  const open=call.indexOf('('), close=call.lastIndexOf(')');
  if(open<0||close<=open)return [];
  const source=call.slice(open+1,close), out=[];
  let start=0, depth=0, quote=null, escaped=false;
  for(let i=0;i<source.length;i++){
    const ch=source[i];
    if(quote){
      if(escaped){escaped=false;continue;}
      if(ch==='\\'){escaped=true;continue;}
      if(ch===quote)quote=null;
      continue;
    }
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}
    if(ch==='('||ch==='{'||ch==='[')depth++;
    else if(ch===')'||ch==='}'||ch===']')depth--;
    else if(ch===','&&depth===0){out.push(source.slice(start,i).trim());start=i+1;}
  }
  out.push(source.slice(start).trim());
  return out;
};
