import { useEffect, useRef } from 'react';
import { filterRows } from './js/filterRows.ts';
import type { ListAtomDesignerProps } from './ListAtomDesigner.types.ts';
import './css/list-atom-designer.css';
export const ListAtomDesigner = ({ atoms = [], kind, selectedName, handleSelect, handleFilter }: ListAtomDesignerProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const handleInputChange = () => filterRows(rootRef.current);
  useEffect(() => { filterRows(rootRef.current); }, [atoms, kind]);
  return <div ref={rootRef} className="list-atom-designer">
  <label className="list-atom-designer__search">Search atoms
    <input className="list-atom-designer__search-input container-inset" data-id="search" type="search" name="atom-search" placeholder="Filter atoms…" onInput={handleInputChange} />
  </label>
  <nav className="list-atom-designer__kinds">{(['container', 'action'] as const).map((family) => <button key={family} type="button" className="action-nav list-atom-designer__kind" aria-current={kind === family ? 'page' : undefined} onClick={() => handleFilter?.(family)}>{family === 'container' ? 'Containers' : 'Actions'}</button>)}</nav>

  <nav className="list-atom-designer__list">{Array.isArray(atoms) && atoms.filter((atom) => atom?.family === kind && typeof atom.name === 'string').map((atom) => <button key={atom.name} data-id="atom-row" type="button" className={`list-atom-designer__item ${atom.name.includes('--') ? `${atom.name.split('--')[0]} ` : ''}${atom.name}`} aria-current={atom.name === selectedName ? 'page' : undefined} onClick={() => handleSelect?.(atom)}>{atom.name}</button>)}</nav>
  <p className="list-atom-designer__empty" data-id="empty" role="status" hidden>No matching atoms.</p>
</div>;
};
