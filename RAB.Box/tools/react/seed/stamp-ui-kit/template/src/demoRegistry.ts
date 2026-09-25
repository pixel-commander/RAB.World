import type { ComponentType } from 'react';

/* presence is registration, the vite way (RULES P3/P4): a component with
   demo/Demo.tsx lands in the style-guide gallery by existing; its own
   settings.ts saying indexed: true lands it on the Demos page. */

export interface DemoEntry {
  path: string;
  name: string;
  title: string;
  Demo: ComponentType;
  indexed: boolean;
}

interface DemoModule {
  default: ComponentType;
}

interface SettingsModule {
  default: { name: string; title?: string; indexed: boolean };
}

const demoModules = import.meta.glob<DemoModule>('./components/**/demo/Demo.tsx', { eager: true });
const settingsModules = import.meta.glob<SettingsModule>('./components/**/settings.ts', { eager: true });

const pathOf = (key: string): string =>
  key.replace('./components/', '').replace(/\/(demo\/Demo\.tsx|settings\.ts)$/, '');

const settingsByPath = new Map(
  Object.entries(settingsModules).map(([key, module]) => [pathOf(key), module.default]),
);

export const demoIndex: DemoEntry[] = Object.entries(demoModules)
  .map(([key, module]) => {
    const path = pathOf(key);
    const name = path.split('/').pop() as string;
    const title = settingsByPath.get(path)?.title;
    return {
      path,
      name,
      title: typeof title === 'string' ? title : name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase()),
      Demo: module.default,
      indexed: settingsByPath.get(path)?.indexed === true,
    };
  })
  .sort((a, b) => a.path.localeCompare(b.path));

export const demoByName = (name: string): DemoEntry | undefined =>
  demoIndex.find((entry) => entry.name === name);
