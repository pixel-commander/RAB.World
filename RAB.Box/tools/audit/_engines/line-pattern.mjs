import path from 'node:path';
import { AUDIT_EXTS, CODE_EXTS, STYLE_EXTS, CONFIG_EXTS, walkFilesByExt, readText, rel, slash } from '../_shared.mjs';

const extSet = scope => scope === 'code' ? CODE_EXTS : scope === 'style' ? STYLE_EXTS : scope === 'config' ? CONFIG_EXTS : AUDIT_EXTS;

export const runLinePattern = async ({ sourceFolder, tool }) => {
  const cfg = tool.meta.config ?? {};
  const files = await walkFilesByExt(sourceFolder, extSet(cfg.scope));
  const rows = [];
  const regex = new RegExp(cfg.pattern, cfg.flags?.includes('g') ? cfg.flags : `${cfg.flags ?? ''}g`);
  for (const file of files) {
    const lines = (await readText(file)).split(/\r?\n/);
    lines.forEach((text, index) => {
      regex.lastIndex = 0;
      for (const match of text.matchAll(regex)) {
        if (cfg.exclude && new RegExp(cfg.exclude).test(text)) continue;
        rows.push({ file:rel(sourceFolder,file), line:index+1, column:(match.index ?? 0)+1, kind:cfg.kind ?? tool.name, text:text.trim() });
      }
    });
  }
  rows.sort((a,b)=>a.file.localeCompare(b.file)||a.line-b.line||a.column-b.column);
  return { status:'ok', scan:tool.address ?? tool.key, root:slash(path.resolve(sourceFolder)), heuristic:Boolean(cfg.heuristic), totals:{files_scanned:files.length,matches:rows.length}, rows };
};
