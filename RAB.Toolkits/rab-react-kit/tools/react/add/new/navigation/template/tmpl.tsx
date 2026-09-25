import type { HTMLAttributes, MouseEvent } from 'react';
export type NavRow = { id: string | number; name: string; path: string };
type __COMPONENT_NAME__Props = Omit<HTMLAttributes<HTMLElement>, 'children'> & {
  rows?: readonly NavRow[];
  selected?: string | number;
  handleClick?: (row: NavRow) => void;
  activeHref?: string;
  linkClassName?: string;
  label?: string;
};
const defaultRows: readonly NavRow[] = __NAV_ROWS__;
export const __COMPONENT_NAME__ = ({ rows = defaultRows, selected, handleClick, activeHref, linkClassName, label = __NAV_LABEL__, className, ...domProps }: __COMPONENT_NAME__Props) => {
  const onRowClick = (event: MouseEvent<HTMLAnchorElement>, row: NavRow) => {
    if (!handleClick) return;
    event.preventDefault();
    handleClick(row);
  };
  return <nav {...domProps} aria-label={label} className={['__NAV_CLASS__', className].filter(Boolean).join(' ')}>
    {rows.map(row => {
      const is_active = selected !== undefined ? String(selected) === String(row.id) : activeHref === row.path;
      return <a key={row.id} href={row.path} onClick={event => onRowClick(event, row)} className={[linkClassName, is_active && 'is-active'].filter(Boolean).join(' ')} aria-current={is_active ? 'page' : undefined}>{row.name}</a>;
    })}
  </nav>;
};
