import type { NavItem } from './SiteShell';

export type SiteNavProps = {
  items: NavItem[];
  selected: string;
  handleClick: (name: string) => void;
};

export const SiteNav = ({ items, selected, handleClick }: SiteNavProps) => {
  return (
    <nav aria-label="Main navigation" className="site-nav container-cell container-cell--inset">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={item.name === selected ? 'action-ghost is-active' : 'action-ghost'}
          aria-current={item.name === selected ? 'page' : undefined}
          onClick={() => handleClick(item.name)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
};
