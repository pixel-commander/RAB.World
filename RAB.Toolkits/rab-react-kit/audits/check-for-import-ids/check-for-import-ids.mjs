import { readFile, writeFile, stat, access } from 'node:fs/promises';
import path from 'node:path';

const resolveSettings = async (specifier, folder) => {
  if (!path.isAbsolute(specifier) && !specifier.startsWith('.')) return { reason: 'unresolved import path (package or alias)' };
  const target = path.resolve(folder, specifier);
  const candidates = [target, ...['.tsx', '.ts', '.jsx', '.js', '.mts', '.mjs', '.cts', '.cjs'].map(ext => target + ext)];
  for (const candidate of candidates) {
    let info;
    try { info = await stat(candidate); } catch (error) { if (error.code === 'ENOENT' || error.code === 'ENOTDIR') continue; throw error; }
    return { file: path.join(info.isDirectory() ? candidate : path.dirname(candidate), 'settings.json') };
  }
  return { reason: 'import path not found' };
};

export const run = async ({ options }) => {
  if (typeof options?.path !== 'string' || !options.path.trim() || typeof options?.file !== 'string' || !options.file.trim() || path.basename(options.file) !== options.file) throw new Error('Provide path and file (source filename).');
  const sourcePath = path.resolve(options.path, options.file);
  await access(sourcePath);
  const settingsPath = path.join(path.dirname(sourcePath), 'settings.json');
  const notes = [];
  let original;
  try { original = await readFile(settingsPath, 'utf8'); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return { message: 'no settings.json', path: sourcePath, updated: 0, notes: [{ path: settingsPath, reason: 'no settings.json' }] };
  }
  const settings = JSON.parse(original);
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw new Error('settings.json must contain an object.');
  if (settings.required === undefined) return { message: 'no required imports', path: sourcePath, updated: 0, notes };
  if (!Array.isArray(settings.required)) throw new Error('settings.required must be an array.');
  let updated = 0;
  for (const row of settings.required) {
    if (!row || typeof row !== 'object' || typeof row.path !== 'string' || !row.path.trim()) { notes.push({ reason: 'required row has no import path' }); continue; }
    const resolved = await resolveSettings(row.path, path.dirname(sourcePath));
    if (resolved.reason) { notes.push({ name: row.name, path: row.path, reason: resolved.reason }); continue; }
    let dependency;
    try { dependency = JSON.parse(await readFile(resolved.file, 'utf8')); } catch (error) {
      if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
      notes.push({ name: row.name, path: row.path, settings: resolved.file, reason: error.code === 'ENOENT' ? 'no settings.json' : 'invalid settings.json' }); continue;
    }
    const id = dependency?.id;
    if (!((typeof id === 'number' && Number.isFinite(id)) || (typeof id === 'string' && id.trim() !== ''))) { notes.push({ name: row.name, path: row.path, settings: resolved.file, reason: 'no id' }); continue; }
    if (row.id !== id) { row.id = id; updated++; }
  }
  if (updated) {
    if (await readFile(settingsPath, 'utf8') !== original) throw new Error('settings.json changed during the scan; retry.');
    await writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n');
  }
  return { message: updated + ' import IDs recorded', path: sourcePath, updated, notes, required: settings.required };
};
