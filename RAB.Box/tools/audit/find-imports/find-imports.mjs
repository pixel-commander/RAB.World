import path from 'node:path';
import { CODE_EXTS, walkFiles, readText, slash } from '../_shared.mjs';

const STATIC_RE = /import\s+(?:type\s+)?(?:([\s\S]*?)\s+from\s*)?['"]([^'"]+)['"]/g;
const DYNAMIC_RE = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const REQUIRE_RE = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const lineOf = (source, offset) => source.slice(0,offset).split('\n').length;

export const run = async ({ options }) => {
  const root = path.resolve(options.folder), rows = [], bySource = {};
  let filesScanned = 0, totalImports = 0;
  for (const file of await walkFiles(root)) {
    if (!CODE_EXTS.has(path.extname(file).toLowerCase())) continue;
    filesScanned++;
    const source = await readText(file), imports = [];
    const record = (spec, offset, style) => {
      const hit = { source:spec, line:lineOf(source,offset), style };
      imports.push(hit);
      (bySource[spec] ??= []).push({ file:slash(path.relative(root,file)), line:hit.line, style });
    };
    STATIC_RE.lastIndex=0; for (let m=STATIC_RE.exec(source);m;m=STATIC_RE.exec(source)) record(m[2],m.index,'static');
    DYNAMIC_RE.lastIndex=0; for (let m=DYNAMIC_RE.exec(source);m;m=DYNAMIC_RE.exec(source)) record(m[1],m.index,'dynamic');
    REQUIRE_RE.lastIndex=0; for (let m=REQUIRE_RE.exec(source);m;m=REQUIRE_RE.exec(source)) record(m[1],m.index,'require');
    if (!imports.length) continue;
    totalImports += imports.length;
    rows.push({ file:slash(path.relative(root,file)), count:imports.length, imports });
  }
  rows.sort((a,b)=>b.count-a.count || a.file.localeCompare(b.file));
  return { status:'ok', scan:'find-imports', root, totals:{ files_scanned:filesScanned, files_importing:rows.length, imports:totalImports }, rows, index:{ by_source:bySource } };
};
