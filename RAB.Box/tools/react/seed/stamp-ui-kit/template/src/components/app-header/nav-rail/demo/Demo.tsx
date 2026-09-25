import { NavRail } from '../NavRail.tsx';

export default () => (
  <NavRail
    items={[
      { heading: 'Monitor' },
      { label: 'Overview', current: true },
      { label: 'Services' },
      { label: 'Incidents', badge: 3 },
    ]}
  />
);
