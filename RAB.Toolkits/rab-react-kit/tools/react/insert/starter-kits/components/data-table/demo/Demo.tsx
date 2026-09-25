import { DataTable, StatusPill } from '../DataTable.tsx';

export default () => (
  <DataTable
    head={['Service', 'Status']}
    rows={[
      ['api-gateway', <StatusPill kind="ok">Healthy</StatusPill>],
      ['billing', <StatusPill kind="warn">Degraded</StatusPill>],
      ['notifications', <StatusPill kind="down">Down</StatusPill>],
    ]}
  />
);
