import { NavItem } from '../NavItem.tsx';

export default () => (
  <div className="demo-stack">
    <NavItem label="Default item" />
    <NavItem label="Current item" current />
    <NavItem label="With badge" badge={3} />
  </div>
);
