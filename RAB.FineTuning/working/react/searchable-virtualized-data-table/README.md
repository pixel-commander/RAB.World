# DataTable

Copy `src/` into a React + TypeScript app. Import the component and its CSS:

```tsx
import { DataTable } from './DataTable';
import './DataTable.css';
```

```tsx
<DataTable
  data={rows}
  legend_key="status"
  view_more_key="items"
  ignore_keys={['id']}
  handleClick={(item, target) => console.log(item, target)}
  handleOrder={(order, target) => console.log(order, target)}
  handleSave={nextRows => saveRows(nextRows)}
/>
```

`data` is an array of objects. The first row generates columns. Each header and body cell receives `data-cell="fieldName"`; body cells also receive one-based `data-row` and `data-col`.

`handleClick(item, 'row' | 'header')` is called for non-button row clicks and sort-header clicks. `handleSave` is an optional parent-owned persistence callback; it is intentionally not called unless a consuming app adds a mutation flow.

Both use the standalone optional two-slot `HandlerKey<Data, Type>` contract.

## Update data

Pass a new data array when rows change. React rerenders, then the table re-infers columns from the new first row.

```tsx
const [rows, setRows] = useState(initialRows);

setRows(current => [...current, { item: 'Build', time: '10:00', name: 'Rabbit', color: 'violet' }]);
<DataTable data={rows} />
```

## Keys

Keys are object property names, not database IDs.

- `legend_key="status"` — unique `row?.status` values create the legend.
- `view_more_key="items"` — reads `row?.[view_more_key ?? '']`; an array of objects becomes the nested table.
- `ignore_keys={['id']}` — prevents those property names from generating columns.

The outer table infers columns from its first row. A nested table infers its own columns from its own first item. Only one expanded table is open at once.

## Virtualize

Only the top-level table virtualizes. `virtualize(element, options)` reads the scroll element’s `scrollTop` and `clientHeight`, then returns `startIndex`, `endIndex`, `totalHeight`, and the visible row range. The table renders only that slice plus `overscan` rows. A `ResizeObserver` remeasures the scroll element and first rendered row when CSS or container height changes.

`rowHeight` is the starting estimate; default is `44`.

The table fills its parent height. Give the host a height; the middle `data-area="main"` becomes the scroll region:

```css
.screen { height: 100dvh; }
```

## Format cells

`format` receives an optional discriminated cell and may return any React node. Header cells have `label`; body cells have optional `value` and `row`.

```tsx
format={cell => {
  if (cell?.type === 'header') return cell.label;
  if (cell?.type === 'cell' && cell.key === 'status') return <strong>{cell?.value ?? 'Unknown'}</strong>;
  return undefined; // use the default text
}}
```

Style externally with semantic classes:

```css
.my-screen .data-table .table-cell[data-cell="status"] { color: rebeccapurple; }
.my-screen .data-table .table-row.even .table-cell { background: #fafafa; }
```

Top-level tables virtualize. Nested tables render their local data completely.
