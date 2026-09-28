import type { ComponentType } from 'react';
import type { AtomCategory } from '../StyleGuidePage.types';
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const segment = (value: string) => /^[A-Za-z0-9_-]+$/.test(value);
export const readAtomCategories = (manifests: Record<string, unknown>, demos: Record<string, { default?: ComponentType; Demo?: ComponentType }>): AtomCategory[] => {
  const categories: AtomCategory[] = [];
  for (const [file, value] of Object.entries(manifests).sort(([a], [b]) => a.localeCompare(b))) {
    if (!record(value) || value.version !== 'manifest/v1' || !Array.isArray(value.items) || value.indexed === false) continue;
    const name = file.split('/').at(-2) ?? '';
    if (!segment(name)) continue;
    const seen = new Set<string>();
    const items: AtomCategory['items'] = [];
    for (const item of value.items) {
      if (!record(item) || item.signal === false || item.transmitting === false || item.indexed === false || typeof item.path !== 'string') continue;
      const relative = item.path.replaceAll('\\', '/');
      if (!relative.split('/').every(segment) || seen.has(relative)) continue;
      seen.add(relative);
      const module = demos[file.replace(/manifest\.json$/, '') + relative + '/demo/Demo.tsx'];
      items.push({ path: relative, title: typeof item.title === 'string' ? item.title : typeof item.name === 'string' ? item.name : relative, description: typeof item.description === 'string' ? item.description : '', Demo: module?.default ?? module?.Demo });
    }
    categories.push({name, title: typeof value.title === 'string' ? value.title : name, items});
  }
  return categories;
};
