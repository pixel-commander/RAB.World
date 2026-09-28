import path from 'node:path';
import { readManifest } from '../world-search/world-search.mjs';

export const getWorldBeacons = async manifestPath => {
  if (typeof manifestPath !== 'string' || !path.isAbsolute(manifestPath)) throw new Error('Configure RAB_WORLD_BEACON_MANIFEST with an absolute world beacon manifest path.');
  return readManifest(manifestPath);
};

export const getBeaconManifests = async (manifestPath, beacons) => {
  const registry = await getWorldBeacons(manifestPath);
  const results = new Array(beacons.length);
  let next = 0;
  const worker = async () => {
    while (next < beacons.length) {
      const index = next++;
      const beacon = beacons[index];
      try {
  const matches = registry.items.filter(item => item && (typeof beacon === 'number' ? item.id === beacon : item.name === beacon));
  if (matches.length !== 1) throw new Error(matches.length ? 'Ambiguous beacon name; use its numeric ID.' : 'Beacon not found in the configured world.');
  const selected = matches[0];
  if (typeof selected.path !== 'string' || !path.isAbsolute(selected.path)) throw new Error('Registered beacon path must be absolute.');
        results[index] = { beacon: selected, manifest: await readManifest(path.join(selected.path, 'manifest.json')) };
      } catch (error) {
        results[index] = { requested: beacon, error: { code: error.code ?? 'BEACON_ERROR', message: error.message } };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, beacons.length) }, worker));
  return results;
};
