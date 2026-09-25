import path from 'node:path';
import { walkFiles } from '../_shared.mjs';

export const run = async ({ options }) => {
  const root = path.resolve(options.folder), counts = {};
  const files = await walkFiles(root);
  for (const file of files) {
    const ext = path.extname(file).toLowerCase() || '(no extension)';
    counts[ext] = (counts[ext] ?? 0) + 1;
  }
  const rows = Object.entries(counts).map(([label,count])=>({label,count})).sort((a,b)=>b.count-a.count || a.label.localeCompare(b.label));
  return { status:'ok', scan:'count-file-types', root, totals:{ total_files:files.length, total_types:rows.length }, rows };
};
