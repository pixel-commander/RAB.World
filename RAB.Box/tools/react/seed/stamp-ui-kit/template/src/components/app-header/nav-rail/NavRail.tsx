import type { ReactNode } from 'react';
import './nav-rail.css';

export type RailItem =
  | { heading: string }
  | { heading?: undefined; label: string; badge?: ReactNode; current?: boolean; onClick?: () => void };

export const NavRail = ({ items = [] }: { items?: RailItem[] }) => (
  <nav className="nav-rail">
    {items.map((item, index) =>
      item.heading != null ? (
        <span key={`h-${index}`} className="nav-rail__heading">{item.heading}</span>
      ) : (
        <button
          key={item.label}
          type="button"
          className="nav-item action-nav"
          aria-current={item.current ? 'page' : undefined}
          onClick={item.onClick}
        >
          <span>{item.label}</span>
          {item.badge != null && <span className="nav-item__badge">{item.badge}</span>}
        </button>
      ),
    )}
  </nav>
);
