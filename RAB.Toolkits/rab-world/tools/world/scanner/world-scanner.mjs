import path from 'node:path';
import { lstat, mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';

const MAX_JSON = 1024 * 1024;
const SKIP_DIRS = new Set(['.git', '.rab', 'node_modules', 'template']);
const fail = (message, code = 'BAD_INPUT') => { throw Object.assign(new Error(message), { code }); };
const isObject = value => value && typeof value === 'object' && !Array.isArray(value);
const positiveId = value => Number.isSafeInteger(value) && value > 0;

const regularJson = async file => {
  const info = await lstat(file);
  if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_JSON) fail(`${file} must be a regular JSON file under 1 MiB.`, 'BAD_JSON');
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch { fail(`${file} must contain valid JSON.`, 'BAD_JSON'); }
};

const childItems = async folder => {
  const entries = (await readdir(folder, { withFileTypes: true })).filter(entry => entry.isDirectory() && !entry.isSymbolicLink()).sort((a, b) => a.name.localeCompare(b.name));
  const items = [];
  for (const entry of entries) {
    const file = path.join(folder, entry.name, 'settings.json');
    try {
      const settings = await regularJson(file);
      if (!isObject(settings) || typeof settings.name !== 'string' || !settings.name.trim()) fail(`${file} needs a nonempty name.`, 'BAD_SETTINGS');
      const kind = settings.kind ?? settings.type ?? settings.meta?.kind ?? 'item';
      if (typeof kind !== 'string' || !kind.trim()) fail(`${file} has an invalid kind.`, 'BAD_SETTINGS');
      items.push({ id: positiveId(settings.id) ? settings.id : null, name: settings.name, title: typeof settings.title === 'string' && settings.title.trim() ? settings.title : settings.name, description: typeof settings.description === 'string' ? settings.description : '', kind, path: entry.name });
    } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
  }
  return items;
};

const findBeacons = async root => {
  const found = [];
  const walk = async folder => {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const target = path.join(folder, entry.name);
      if (entry.isFile() && entry.name === 'beacon.json') found.push(target);
      else if (entry.isDirectory() && !SKIP_DIRS.has(entry.name)) await walk(target);
    }
  };
  await walk(root);
  return found.sort((a, b) => a.localeCompare(b));
};

const worldMap = async worldsPath => {
  const worlds = new Map();
  for (const entry of await readdir(worldsPath, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    try {
      const settings = await regularJson(path.join(worldsPath, entry.name, 'settings.json'));
      if (isObject(settings) && positiveId(settings.id) && settings.meta?.kind === 'world') worlds.set(settings.id, path.join(worldsPath, entry.name));
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return worlds;
};

const writeJson = async (file, value) => {
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(temp, JSON.stringify(value, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
  await rename(temp, file);
};

const existingManifest = async file => {
  try {
    const manifest = await regularJson(file);
    if (!isObject(manifest) || manifest.version !== 'manifest/v1' || !positiveId(manifest.id)) fail(`${file} is not a manifest/v1 record and will not be replaced.`, 'UNSUPPORTED_MANIFEST');
    return manifest;
  } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
};

const manifestFor = async ({ folder, existing, name, title, description, items, helpers }) => {
  const identity = existing ?? await helpers.createItemSettings({ name, title, description, settings: [], meta: { kind: 'manifest' } });
  return { version: 'manifest/v1', id: identity.id, name, title, description, date_added: existing?.date_added ?? new Date().toISOString(), items, indexed: true };
};

export const run = async ({ options, helpers }) => {
  if (typeof options.path !== 'string' || !path.isAbsolute(options.path)) fail('Path must be an absolute folder.');
  if (typeof options.worlds_path !== 'string' || !path.isAbsolute(options.worlds_path)) fail('Worlds Path must be an absolute folder.');
  const root = path.resolve(options.path);
  const worldsPath = path.resolve(options.worlds_path);
  if (!(await lstat(root)).isDirectory() || !(await lstat(worldsPath)).isDirectory()) fail('Path and Worlds Path must both be directories.');
  const worlds = await worldMap(worldsPath);
  const beaconFiles = await findBeacons(root);
  const skipped = [], routed = new Map(), refreshed = [];
  for (const beaconFile of beaconFiles) {
    const folder = path.dirname(beaconFile);
    try {
      const beacon = await regularJson(beaconFile);
      if (!isObject(beacon) || !positiveId(beacon.id) || !positiveId(beacon.world)) fail('beacon needs positive numeric id and world.', 'BAD_BEACON');
      if (beacon.beacon !== 'on') { skipped.push({ path: beaconFile, reason: 'beacon_off' }); continue; }
      const worldFolder = worlds.get(beacon.world);
      if (!worldFolder) { skipped.push({ path: beaconFile, reason: 'unknown_world', world: beacon.world }); continue; }
      const manifestFile = path.join(folder, 'manifest.json');
      const localExisting = await existingManifest(manifestFile);
      const local = await manifestFor({ folder, existing: localExisting, name: localExisting?.name ?? path.basename(folder), title: localExisting?.title ?? beacon.title ?? beacon.name, description: localExisting?.description ?? beacon.description ?? '', items: await childItems(folder), helpers });
      await writeJson(manifestFile, local);
      refreshed.push({ beacon: beacon.id, manifest: manifestFile });
      const record = { ...beacon, path: folder };
      const list = routed.get(beacon.world) ?? [];
      list.push(record);
      routed.set(beacon.world, list);
    } catch (error) { skipped.push({ path: beaconFile, reason: error.code ?? 'invalid_beacon', message: error.message }); }
  }
  const worldManifests = [];
  for (const [worldId, beacons] of routed) {
    const folder = path.join(worlds.get(worldId), 'beacons');
    const file = path.join(folder, 'manifest.json');
    try {
      const existing = await existingManifest(file);
      const manifest = await manifestFor({ folder, existing, name: existing?.name ?? 'beacons', title: existing?.title ?? 'Beacons', description: existing?.description ?? 'Beacon records for this world.', items: beacons.sort((a, b) => a.id - b.id), helpers });
      await writeJson(file, manifest);
      worldManifests.push({ world: worldId, manifest: file, count: beacons.length });
    } catch (error) { skipped.push({ path: file, reason: error.code ?? 'world_manifest_error', message: error.message }); }
  }
  return { status: 'completed', path: root, worlds_path: worldsPath, discovered: beaconFiles.length, refreshed, world_manifests: worldManifests, skipped };
};
