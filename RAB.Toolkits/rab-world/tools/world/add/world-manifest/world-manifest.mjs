import path from 'node:path';
import { lstat, readFile, readdir, realpath } from 'node:fs/promises';

const fail = (message, code = 'BAD_INPUT') => {
  throw Object.assign(new Error(message), { code });
};

const readItems = async folder => {
  const entries = (await readdir(folder, { withFileTypes: true })).filter(entry => entry.isDirectory() && !entry.isSymbolicLink()).sort((left, right) => left.name.localeCompare(right.name));
  const items = [];
  for (const entry of entries) {
    const settingsFile = path.join(folder, entry.name, 'settings.json');
    let info;
    try { info = await lstat(settingsFile); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    if (!info.isFile() || info.isSymbolicLink() || info.size > 1024 * 1024) fail(`${entry.name}/settings.json must be a regular JSON file under 1 MiB.`, 'BAD_SETTINGS');
    let settings;
    try { settings = JSON.parse(await readFile(settingsFile, 'utf8')); }
    catch { fail(`${entry.name}/settings.json must contain valid JSON.`, 'BAD_SETTINGS'); }
    if (!settings || typeof settings !== 'object' || Array.isArray(settings) || typeof settings.name !== 'string' || !settings.name.trim()) fail(`${entry.name}/settings.json needs a nonempty name.`, 'BAD_SETTINGS');
    const kind = settings.kind ?? settings.type ?? settings.meta?.kind ?? 'item';
    if (typeof kind !== 'string' || !kind.trim()) fail(`${entry.name}/settings.json has an invalid kind.`, 'BAD_SETTINGS');
    items.push({ id: Number.isSafeInteger(settings.id) && settings.id > 0 ? settings.id : null, name: settings.name, title: typeof settings.title === 'string' && settings.title.trim() ? settings.title : settings.name, description: typeof settings.description === 'string' ? settings.description : '', kind, path: entry.name });
  }
  return items;
};

export const run = async ({ options, helpers }) => {
  if (typeof options.folder !== 'string' || !path.isAbsolute(options.folder)) fail('Folder must be an absolute path.');
  const folder = await realpath(options.folder).catch(error => { if (error.code === 'ENOENT') fail('Folder does not exist.'); throw error; });
  if (!(await lstat(folder)).isDirectory()) fail('Folder must be a directory.');
  const file = path.join(folder, 'manifest.json');
  try { await lstat(file); fail('manifest.json already exists; it will not be replaced.', 'ALREADY_EXISTS'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const name = options.name === undefined ? path.basename(folder) : options.name;
  const title = options.title === undefined ? name : options.title;
  const description = options.description === undefined ? '' : options.description;
  if (typeof name !== 'string' || !name.trim() || typeof title !== 'string' || !title.trim() || typeof description !== 'string') fail('Name and title must be nonempty text; description must be text.');
  const identity = await helpers.createItemSettings({ name, title, description, settings: [], meta: { kind: 'manifest' } });
  const items = await readItems(folder);
  const manifest = { version: 'manifest/v1', id: identity.id, name, title, description, date_added: new Date().toISOString(), path: folder, items, indexed: true };
  const verification = await helpers.writeArtifactPlan({ destination: folder, allowedRoot: folder, uniqueDirectory: false, files: [{ path: 'manifest.json', text: JSON.stringify(manifest, null, 2) + '\n' }] });
  return { status: 'created', manifest, file, verification };
};
