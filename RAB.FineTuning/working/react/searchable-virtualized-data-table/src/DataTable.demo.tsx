import { DataTable } from './DataTable';

type DemoRow = { id: number; name: string; team: string; status: 'Active' | 'Paused'; score: number; items: { item: string; quantity: number; price: string }[] };

const demoRows: DemoRow[] = Array.from({ length: 20_000 }, (_, id) => ({
  id: id + 1,
  name: `Person ${id + 1}`,
  team: ['Design', 'Engineering', 'Support'][id % 3],
  status: id % 5 === 0 ? 'Paused' : 'Active',
  score: 50 + (id % 51),
  items: [{ item: `Item ${id + 1}`, quantity: (id % 4) + 1, price: `$${(id % 90) + 10}` }],
}));

export const DataTableDemo = () => (
  <main style={{ height: 'calc(100vh - 48px)', maxWidth: 1024, margin: '0 auto', padding: 24 }}>
    <h1>People</h1>
    <DataTable
      data={demoRows}
      ignore_keys={['id']}
      view_more_key="items"
      legend_key="status"
      format={cell => {
        if (cell?.type === 'header') return cell.label?.replace(/^./, letter => letter.toUpperCase());
        if (cell?.type === 'cell' && cell.key === 'status') return <span style={{ color: cell?.value === 'Active' ? '#047857' : '#b45309' }}>{String(cell?.value ?? '')}</span>;
        return undefined;
      }}
    />
  </main>
);
