import type { ComponentType } from 'react';
import { readAtomCategories } from './atom-manifests';
const manifests = import.meta.glob('../../../atoms/*/manifest.json', { eager: true, import: 'default' });
const demos = import.meta.glob<{ default?: ComponentType; Demo?: ComponentType }>('../../../atoms/**/demo/Demo.tsx', { eager: true });
export const atomCategories = readAtomCategories(manifests, demos);
