import { readdir, realpath, stat, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
export const run = async ({ options, context = {} }) => {
  if (typeof options?.path !== 'string' || !options.path.trim()) throw Object.assign(new Error('A folder path is required.'), { code: 'BAD_REQUEST' });
  const supplied = Array.isArray(options.types) ? options.types : typeof options.types === 'string' ? options.types.split(',') : [];
  if (!supplied.length || supplied.some(value => typeof value !== 'string' || !/^\.?[a-zA-Z0-9]+$/.test(value.trim()))) throw new Error('Types requires file extensions such as .tsx, .css.');
  const types = [...new Set(supplied.map(value => '.' + value.trim().replace(/^\./, '').toLowerCase()))];
  const world = options.world;
  if (typeof world !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(world)) throw new Error('World must be a simple world folder name.');
  const rabHome = context.rab_home ?? String.raw`\\Desktop-t72isdi\c\Users\gauge\.rab`;
  const saveFile = options.save_file ?? path.join(rabHome, 'worlds', world, 'audits', 'file-types', 'report.json');
  if (typeof saveFile !== 'string' || !saveFile.trim()) throw new Error('Save file must be a nonempty path.');
  // Require an existing world so a typo cannot create another world registry.
  if (options.save_file === undefined) await stat(path.join(rabHome, 'worlds', world, 'settings.json'));
  const folder = await realpath(options.path);
  if (!(await stat(folder)).isDirectory()) throw Object.assign(new Error('Path must be a folder.'), { code: 'BAD_REQUEST' });
  const entries = await readdir(folder, { withFileTypes: true });
  const items = entries.filter(entry => entry.isFile() && types.includes(path.extname(entry.name).toLowerCase())).sort((a, b) => a.name.localeCompare(b.name)).map(entry => ({ name: entry.name, path: path.join(folder, entry.name), type: 'file' }));
  const report = { path: folder, types, items };
  await mkdir(path.dirname(saveFile), { recursive: true });
  await writeFile(saveFile, JSON.stringify(report, null, 2) + '\n');
  return { ...report, save_file: path.resolve(saveFile) };
};
