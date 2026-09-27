import path from 'node:path';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { createSearchUsage } from '../../../../../RAB.Box/bridge/world-search-usage.mjs';
import { maintainIndexIds } from '../../../../../RAB.Box/bridge/index-identities.mjs';

export const readManifest = async file => {
  const stat = await lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 8 * 1024 * 1024) throw new Error(`Invalid manifest file: ${file}`);
  const data = JSON.parse(await readFile(file, 'utf8'));
  if (data?.version !== 'manifest/v1' || !Array.isArray(data.items)) throw new Error(`Expected manifest/v1 with items: ${file}`);
  return data;
};
const inside = (root, target) => {
  const relative = path.relative(root, target);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
};

export const run = async ({ options, context = {} }) => {
  if (typeof options.query !== 'string' || !options.query.trim()) throw new Error('A nonempty query is required.');
  if (typeof options.manifest_path !== 'string' || !path.isAbsolute(options.manifest_path)) throw new Error('manifest_path must be absolute.');
  const registry = await readManifest(options.manifest_path);
  const terms = options.query.trim().toLowerCase().split(/\s+/);
  const enabled = registry.items.map((beacon, index) => ({ beacon, priority: index + 1 }))
    .filter(({ beacon }) => beacon?.beacon === 'on' && beacon.indexed !== false);
  const groups = new Array(enabled.length);
  let next = 0;
  const worker = async () => {
    while (next < enabled.length) {
      const slot = next++;
      const { beacon, priority } = enabled[slot];
      const group = { beacon_id: beacon.id, beacon_path: beacon.path, priority, items: [], errors: [] };
      groups[slot] = group;
      try {
        if (typeof beacon.path !== 'string' || !path.isAbsolute(beacon.path)) throw new Error('Beacon path must be absolute.');
        const root = await realpath(beacon.path);
        const manifest = await readManifest(path.join(root, 'manifest.json'));
        if (manifest.indexed === false) continue;
        if (manifest.items.some(item => item && item.id == null)) {
          const maintained = await maintainIndexIds(path.join(root, 'manifest.json'), { rabHome: context.rab_home });
          manifest.items = maintained.items;
        }
        for (const item of manifest.items) {
          if (!item || typeof item !== 'object' || item.indexed === false || item.signal === false || item.transmitting === false) continue;
          const text = [item.name, item.title, item.description, item.type, item.path].filter(value => typeof value === 'string').join(' ').toLowerCase();
          if (!terms.every(term => text.includes(term))) continue;
          if (typeof item.path !== 'string' || !item.path.trim()) {
            group.errors.push({ message: 'Matching item has no path.', id: item.id });
            continue;
          }
          const target = path.resolve(root, item.path);
          if (!inside(root, target)) {
            group.errors.push({ message: 'Item path escapes beacon root.', id: item.id });
            continue;
          }
          group.items.push({ ...item, source_beacon_id: beacon.id, beacon_priority: priority, resolved_path: target });
        }
      } catch (error) {
        group.errors.push({ code: error.code ?? 'BAD_MANIFEST', message: error.message });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, enabled.length) }, worker));
  // Base is a world-root convention, not a beacon or a toolkit entry.
  // Read it only after the ordered beacon search has completed.
  const baseGroup = { beacon_id: null, beacon_path: null, priority: registry.items.length + 1, items: [], errors: [] };
  try {
    const worldDirectory = path.dirname(path.dirname(options.manifest_path));
    const settings = JSON.parse(await readFile(path.join(worldDirectory, 'settings.json'), 'utf8'));
    if (typeof settings.path !== 'string' || !path.isAbsolute(settings.path)) throw new Error('World settings.path must be an absolute root path.');
    const baseRoot = path.join(settings.path, 'base');
    baseGroup.beacon_path = baseRoot;
    const manifest = await readManifest(path.join(baseRoot, 'manifest.json'));
    if (manifest.indexed !== false) {
      for (const item of manifest.items) {
        if (!item || item.indexed === false || item.signal === false || item.transmitting === false) continue;
        const text = [item.name, item.title, item.description, item.type, item.path].filter(value => typeof value === 'string').join(' ').toLowerCase();
        if (!terms.every(term => text.includes(term))) continue;
        if (typeof item.path !== 'string' || !item.path.trim()) throw new Error('Matching Base item has no path.');
        const target = path.resolve(baseRoot, item.path);
        if (!inside(baseRoot, target)) throw new Error('Item path escapes Base root.');
        baseGroup.items.push({ ...item, source: 'base', source_manifest: path.join(baseRoot, 'manifest.json'), resolved_path: target });
      }
    }
  } catch (error) {
    baseGroup.errors.push({ code: error.code ?? 'BAD_MANIFEST', message: error.message });
  }
  groups.push(baseGroup);
  const result = {
    status: groups.some(group => group.errors.length) ? 'partial' : 'completed',
    query: options.query, manifest_path: options.manifest_path,
    items: groups.flatMap(group => group.items),
    errors: groups.flatMap(group => group.errors.map(error => ({ ...error, beacon_id: group.beacon_id, beacon_path: group.beacon_path, priority: group.priority })))
  };
  try { return await createSearchUsage({ rabHome: context.rab_home }).recordSearch(result); }
  catch (error) { return { ...result, tracking_error: { code: error.code ?? 'TRACKING_ERROR', message: error.message } }; }
};
