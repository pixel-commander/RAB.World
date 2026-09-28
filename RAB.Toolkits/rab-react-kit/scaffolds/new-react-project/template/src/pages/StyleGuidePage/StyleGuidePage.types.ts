import type { ComponentType } from 'react';

export interface AtomExample { path: string; title: string; description: string; Demo?: ComponentType; }
export interface AtomCategory { name: string; title: string; items: AtomExample[]; }
