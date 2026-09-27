import { useEffect, useState } from 'react';
import type { ManifestData } from '../ManifestViewer.types';

const validEntry = (value: unknown, depth = 0): boolean => {
  if (depth > 64 || !value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  for (const key of ['name', 'title', 'description', 'path', 'type', 'key']) if (item[key] !== undefined && typeof item[key] !== 'string') return false;
  if (item.files !== undefined && (!Array.isArray(item.files) || !item.files.every(f => typeof f === 'string'))) return false;
  if (item.items !== undefined) {
    if (!item.items || typeof item.items !== 'object') return false;
    if (!Object.values(item.items).every(child => validEntry(child, depth + 1))) return false;
  }
  return true;
};
const parseManifest = (value: unknown): ManifestData => {
  if (!validEntry(value) || !(value as ManifestData).items) throw new Error('This manifest must contain an items array or object.');
  return value as ManifestData;
};

export const useManifest = (manifest?: ManifestData, path?: string) => {
  const [loaded, setLoaded] = useState<{ path?: string; data?: ManifestData; error?: string }>({});
  useEffect(() => {
    if (manifest !== undefined || !path) return;
    const controller = new AbortController();
    setLoaded({ path });
    fetch(path, { signal: controller.signal }).then(response => {
      if (!response.ok) throw new Error(`Could not load manifest (${response.status}).`);
      return response.json();
    }).then(value => { if (!controller.signal.aborted) setLoaded({ path, data: parseManifest(value) }); })
      .catch(error => { if (!controller.signal.aborted) setLoaded({ path, error: error.message }); });
    return () => controller.abort();
  }, [manifest, path]);
  if (manifest !== undefined) {
    try { return { data: parseManifest(manifest), loading: false }; }
    catch (error) { return { error: (error as Error).message, loading: false }; }
  }
  if (!path) return { error: 'Supply a manifest or a manifest URL.', loading: false };
  if (loaded.path !== path) return { loading: true };
  return { ...loaded, loading: !loaded.data && !loaded.error };
};
