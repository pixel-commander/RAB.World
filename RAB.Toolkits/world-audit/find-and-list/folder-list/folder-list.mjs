import { ignoredPaths } from '../../audit-runner/audit-store.mjs';
import { randomUUID } from 'node:crypto';
import { readdir, realpath, stat, mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
export const run = async ({ options, context = {} }) => {
  if (typeof options?.path !== 'string' || !options.path.trim()) throw Object.assign(new Error('A folder path is required.'), { code: 'BAD_REQUEST' });
  const world = options.world;
  if (typeof world !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(world)) throw new Error('World must be a simple world folder name.');
  const rabHome = context.rab_home ?? String.raw`\\Desktop-t72isdi\c\Users\gauge\.rab`;
  const saveFile = options.save_file ?? path.join(rabHome, 'worlds', world, 'audits', 'folder-list', 'report.json');
  if (typeof saveFile !== 'string' || !saveFile.trim()) throw new Error('Save file must be a nonempty path.');
  // Require an existing world so a typo cannot create another world registry.
  if (options.save_file === undefined) await stat(path.join(rabHome, 'worlds', world, 'settings.json'));
  const folder = await realpath(options.path);
  if (!(await stat(folder)).isDirectory()) throw Object.assign(new Error('Path must be a folder.'), { code: 'BAD_REQUEST' });
  const recursive = options.recursive ?? false;
  if (typeof recursive !== 'boolean') throw new Error('recursive must be boolean.');
  if (options.max_depth !== undefined && (!Number.isInteger(options.max_depth) || options.max_depth < 0)) throw new Error('max_depth must be a nonnegative integer.');
  const depthLimit = recursive ? options.max_depth ?? Infinity : Math.min(options.max_depth ?? 1, 1);
  const toolSettings = JSON.parse(await readFile(new URL('./settings.json', import.meta.url), 'utf8'));
  const excluded = options.exclude ?? toolSettings.settings.find(field => field.name === 'exclude').default;
  if (!Array.isArray(excluded) || excluded.some(value => typeof value !== 'string' || !value.trim())) throw new Error('exclude must be an array of paths.');
  const key = value => process.platform === 'win32' ? value.toLowerCase() : value;
  let ignored=[];
  try{ignored=ignoredPaths(path.join(rabHome,'worlds',world,'audits','audits.sqlite'));}catch(error){if(error.code!=='ERR_SQLITE_ERROR' || !String(error.message).includes('unable to open'))throw error;}
  const exclusions = [...excluded,...ignored].map(value => key(path.resolve(folder, value)));
  const rows = [{ path: folder, parent: null, depth: 0 }];
  const errors = [], skipped = [];
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    context.onProgress?.({folders:index,path:row.path,discovered:rows.length});
    if (exclusions.some(exclude => key(row.path) === exclude || key(row.path).startsWith(exclude + path.sep))) { skipped.push({path:row.path,reason:'excluded'}); continue; }
    if (row.depth >= depthLimit) continue;
    let entries;
    try { entries = await readdir(row.path, { withFileTypes: true }); }
    catch (error) { errors.push({ path: row.path, code: error.code ?? 'READ_FAILED', message: error.message }); continue; }
    for (const entry of entries.sort((a,b) => a.name.localeCompare(b.name))) {
      const full = path.join(row.path, entry.name);
      if (entry.isSymbolicLink()) { skipped.push({ path: full, reason: 'link' }); continue; }
      if (!entry.isDirectory()) continue;
      if (['.git', 'node_modules', '.gitignore'].includes(entry.name.toLowerCase())) { skipped.push({path:full,reason:'excluded'}); continue; }
      if (exclusions.some(exclude => key(full) === exclude || key(full).startsWith(exclude + path.sep))) { skipped.push({ path: full, reason: 'excluded' }); continue; }
      rows.push({ path: full, parent: index, depth: row.depth + 1 });
    }
  }
  const items = rows.map(row => ({ parent: row.parent === null ? null : rows[row.parent].path, name: path.basename(row.path)||row.path, type:'folder',path:row.path }));
  const report = {
    id: randomUUID(), name: 'folder-list', title: 'Folder List',
    description: `Folder map of ${folder}. Root depth is 0.`,
    items, errors, skipped,
  };
  await mkdir(path.dirname(saveFile), { recursive: true });
  await writeFile(saveFile, JSON.stringify(report, null, 2) + '\n');
  return { ...report, save_file: path.resolve(saveFile) };
};
