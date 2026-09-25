import type { HandlerKey } from '../../../HouseKeys.types.ts';
import type { Atom } from '../AtomDesigner.types.ts';
export interface ListAtomDesignerProps {
  atoms?: Atom[];
  kind?: Atom['family'];
  selectedName?: string;
  handleSelect?: HandlerKey<Atom>;
  handleFilter?: HandlerKey<Atom['family']>;
}
