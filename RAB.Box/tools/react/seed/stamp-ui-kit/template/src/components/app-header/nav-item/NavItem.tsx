import type { ReactNode } from 'react';
import './nav-item.css';

interface NavItemProps {
  label: string;
  badge?: ReactNode;
  current?: boolean;
  onClick?: () => void;
}

export const NavItem = ({ label, badge, current, onClick }: NavItemProps) => (
  <button
    type="button"
    className="nav-item action-nav"
    aria-current={current ? 'page' : undefined}
    onClick={onClick}
  >
    <span>{label}</span>
    {badge != null && <span className="nav-item__badge">{badge}</span>}
  </button>
);
