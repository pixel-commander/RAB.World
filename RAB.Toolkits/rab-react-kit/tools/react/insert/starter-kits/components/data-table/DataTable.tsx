import type { ReactNode } from 'react';
import './data-table.css';

interface DataTableProps {
  head?: string[];
  rows?: ReactNode[][];
}

export const DataTable = ({ head = [], rows = [] }: DataTableProps) => (
  <table className="data-table">
    <thead>
      <tr>
        {head.map((label) => (
          <th key={label}>{label}</th>
        ))}
      </tr>
    </thead>
    <tbody>
      {rows.map((cells, rowIndex) => (
        <tr key={rowIndex}>
          {cells.map((cell, cellIndex) => (
            <td key={cellIndex}>{cell}</td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
);

export const StatusPill = ({ kind, children }: { kind: 'ok' | 'warn' | 'down'; children: ReactNode }) => (
  <span className={`status-pill status-pill--${kind}`}>{children}</span>
);
