import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const run = async ({ options, helpers }) => {
const worldsRoot = path.resolve(options.source);
const outputRoot = path.resolve(options.output);
const readJSON = async (file, fallback = null) => {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
};
const readText = async (file) => {
  try { return await readFile(file, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return ''; throw error; }
};

const manifest = await readJSON(path.join(worldsRoot, 'manifest.json'), { items: [] });
const worlds = [];
const beacons = [];
for (const item of manifest.items ?? []) {
  const root = path.resolve(worldsRoot, item.path);
  const settings = await readJSON(path.join(root, 'settings.json'), {});
  const settingsUrl = `/world-settings/${encodeURIComponent(String(item.id))}/settings.json`;
  const settingsDirectory = path.join(outputRoot, 'world-settings', String(item.id));
  await mkdir(settingsDirectory, { recursive: true });
  await writeFile(path.join(settingsDirectory, 'settings.json'), JSON.stringify(settings, null, 2) + '\n');
  const beaconManifest = await readJSON(path.join(root, 'beacons', 'manifest.json'), { items: [] });
  const toolkitManifest = await readJSON(path.join(root, 'toolkits', 'manifest.json'), { items: [] });
  const watcher = await readJSON(path.join(root, 'world-watcher.json'), null);
  const readme = await readText(path.join(root, 'README.txt'));
  worlds.push({ ...item, root, settings, settingsUrl, watcher, readme, toolkits: toolkitManifest.items ?? [], beacon_count: beaconManifest.items?.length ?? 0 });
  for (const beacon of beaconManifest.items ?? []) beacons.push({ ...beacon, world_id: item.id, world_name: item.name });
}

const catalog = await helpers.listTools({ fresh: true });
const tools = catalog.items.map(tool => ({
  id: tool.id,
  key: tool.key,
  title: tool.title,
  description: tool.description,
  domain: tool.domain,
  operation: tool.meta?.operation ?? null,
  target_type: tool.meta?.target_type ?? null,
  source: tool.source,
  toolkit: tool.toolkit?.name ?? null,
}));

const output = {
  generated_at: new Date().toISOString(),
  source: worldsRoot,
  worlds,
  beacons,
  tools,
  unavailable_tools: catalog.unavailable ?? [],
  manifests: [],
};
// Publish saved data only. Scanning Base is a separate explicit tool call.
const baseManifest = options.base_manifest ? await readJSON(path.resolve(options.base_manifest)) : null;
if (baseManifest) {
  const publicRoot = path.join(outputRoot, 'manifests');
  await mkdir(publicRoot, { recursive: true });
  await writeFile(path.join(publicRoot, 'base.json'), JSON.stringify(baseManifest, null, 2) + '\n');
  output.manifests.push({ id: baseManifest.id, name: 'base', title: 'Base', description: baseManifest.description, path: '/manifests/base.json' });
}
const destination = path.join(outputRoot, 'world.generated.json');
await mkdir(path.dirname(destination), { recursive: true });
await writeFile(destination, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
return { status: 'exported', file: destination, worlds: worlds.length, beacons: beacons.length, tools: tools.length };
};
