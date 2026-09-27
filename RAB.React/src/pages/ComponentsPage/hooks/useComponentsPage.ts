import type { ComponentType } from 'react';
import manifest from '../../../components/manifest.json';
import { useURL } from '../../../hooks/useURL/useURL';
const modules = import.meta.glob<{ default?: ComponentType; Demo?: ComponentType }>('../../../components/**/demo/Demo.tsx', { eager: true });
const entries = manifest.items.filter(item => item.signal !== false && item.transmitting !== false && /^[A-Za-z0-9_-]+$/.test(item.path)).map(item => {
  const module = modules[`../../../components/${item.path}/demo/Demo.tsx`];
  return { ...item, Demo: module?.default ?? module?.Demo };
});
export const useComponentsPage = () => {
  const [url, handleURL] = useURL();
  const selected = entries.find(item => item.name === url.section) ?? entries[0];
  return { entries, selected, handleURL };
};
