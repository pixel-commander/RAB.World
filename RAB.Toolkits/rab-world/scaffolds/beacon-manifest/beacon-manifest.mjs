import path from 'node:path';
import { lstat, readFile, realpath } from 'node:fs/promises';

const fail = (message, code = 'BAD_INPUT') => {
  throw Object.assign(new Error(message), { code });
};

const readBeacon = async folder => {
  const file = path.join(folder, 'beacon.json');
  let info;
  try { info = await lstat(file); }
  catch (error) { if (error.code === 'ENOENT') fail('Beacon Folder must contain beacon.json.'); throw error; }
  if (!info.isFile() || info.isSymbolicLink() || info.size > 1024 * 1024) fail('beacon.json must be a regular JSON file under 1 MiB.');
  let beacon;
  try { beacon = JSON.parse(await readFile(file, 'utf8')); }
  catch { fail('beacon.json must contain valid JSON.'); }
  if (!Number.isSafeInteger(beacon.id) || beacon.id <= 0 || typeof beacon.name !== 'string' || !beacon.name.trim()) fail('beacon.json needs a positive numeric id and a nonempty name.');
  return beacon;
};

export const run = async ({ options, helpers }) => {
  if (typeof options.beacon_path !== 'string' || !path.isAbsolute(options.beacon_path)) fail('Beacon Folder must be an absolute path.');
  const folder = await realpath(options.beacon_path).catch(error => { if (error.code === 'ENOENT') fail('Beacon Folder does not exist.'); throw error; });
  const folderInfo = await lstat(folder);
  if (!folderInfo.isDirectory()) fail('Beacon Folder must be a directory.');
  const beacon = await readBeacon(folder);
  const manifestFile = path.join(folder, 'manifest.json');
  try { await lstat(manifestFile); fail('manifest.json already exists; it will not be replaced.', 'ALREADY_EXISTS'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const title = options.title === undefined ? (beacon.title || beacon.name) : options.title;
  const description = options.description === undefined ? (beacon.description || '') : options.description;
  if (typeof title !== 'string' || !title.trim() || typeof description !== 'string') fail('Title must be nonempty text and description must be text.');
  const identity = await helpers.createItemSettings({ name: beacon.name, title, description, settings: [], meta: { kind: 'beacon-manifest' } });
  const manifest = {
    version: 'beacon-manifest/v1',
    id: identity.id,
    name: beacon.name,
    title,
    description,
    date_added: new Date().toISOString(),
    beacon: { id: beacon.id, name: beacon.name, file: 'beacon.json' },
    items: {},
    indexed: false
  };
  const verification = await helpers.writeArtifactPlan({ destination: folder, allowedRoot: folder, uniqueDirectory: false, files: [{ path: 'manifest.json', text: JSON.stringify(manifest, null, 2) + '\n' }] });
  return { status: 'created', manifest, file: manifestFile, verification };
};
