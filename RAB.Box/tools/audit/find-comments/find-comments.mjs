import path from 'node:path';
import { CODE_EXTS, walkFiles, readText, slash } from '../_shared.mjs';

const scanComments = source => {
  const found = [];
  let mode = 'code', line = 1, start = 1, buffer = '';
  const keep = kind => found.push({ line:start, kind, text:buffer.replace(/\s+/g,' ').trim().slice(0,240) });
  for (let i = 0; i < source.length;) {
    const ch = source[i], pair = ch + (source[i + 1] ?? '');
    if (mode === 'code') {
      if (pair === '//') { mode='line'; start=line; buffer=''; i+=2; continue; }
      if (pair === '/*') { mode='block'; start=line; buffer=''; i+=2; continue; }
      if (ch === "'") mode='single'; else if (ch === '"') mode='double'; else if (ch === '`') mode='template';
    } else if (['single','double','template'].includes(mode)) {
      if (ch === '\\') { if (source[i+1] === '\n') line++; i+=2; continue; }
      if ((mode==='single' && (ch==="'" || ch==='\n')) || (mode==='double' && (ch==='"' || ch==='\n')) || (mode==='template' && ch==='`')) mode='code';
    } else if (mode === 'line') {
      if (ch === '\n') { keep('line'); mode='code'; } else buffer += ch;
    } else if (mode === 'block') {
      if (pair === '*/') { keep('block'); mode='code'; i+=2; continue; }
      buffer += ch;
    }
    if (ch === '\n') line++;
    i++;
  }
  if (mode === 'line') keep('line');
  if (mode === 'block') keep('block');
  return found;
};

export const run = async ({ options }) => {
  const root = path.resolve(options.folder), rows = [];
  let filesScanned = 0, total = 0;
  for (const file of await walkFiles(root)) {
    if (!CODE_EXTS.has(path.extname(file).toLowerCase())) continue;
    filesScanned++;
    const comments = scanComments(await readText(file));
    if (!comments.length) continue;
    total += comments.length;
    rows.push({ file:slash(path.relative(root,file)), count:comments.length, comments });
  }
  rows.sort((a,b)=>b.count-a.count || a.file.localeCompare(b.file));
  return { status:'ok', scan:'find-comments', root, totals:{ files_scanned:filesScanned, files_with_comments:rows.length, comments:total }, rows };
};
