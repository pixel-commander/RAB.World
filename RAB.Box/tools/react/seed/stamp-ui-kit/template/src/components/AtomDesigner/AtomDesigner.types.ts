import type { DataKeys, HandlerKey } from '../../HouseKeys.types.ts';
import type { AtomCard } from './FormAtomDesigner/FormAtomDesigner.tsx';
export interface Atom extends AtomCard { text: string; }
export interface Rect { x: number; y: number; w: number; h: number; }
export interface SaveAtomData extends DataKeys { name: string; text: string; }
export interface SavedAtomData extends DataKeys { name: string; file: string; }
export interface AtomDesignerProps {
  handleSave?: HandlerKey<SaveAtomData, 'atom', void | Promise<void>>;
  handleChange?: HandlerKey<string>;
  handleSelect?: HandlerKey<Atom>;
  handleFilter?: HandlerKey<Atom['family']>;
  handleSaveResult?: HandlerKey<SavedAtomData, 'saved'>;
}
