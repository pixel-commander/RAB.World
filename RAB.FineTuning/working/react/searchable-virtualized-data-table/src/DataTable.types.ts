import type { ReactNode, RefObject } from 'react';

export type DataTableRow = Record<string, unknown>;

export type HandlerKey<Data = unknown, Type extends string = string, Result = unknown> = (
  data?: Data,
  type?: Type,
) => Result;

export type DataTableColumn<T extends DataTableRow> = {
  key: Extract<keyof T, string>;
  label: string;
};

export type DataTableHeaderCell<T extends DataTableRow> = {
  type: 'header';
  key: Extract<keyof T, string>;
  label: string;
};

export type DataTableBodyCell<T extends DataTableRow> = {
  [K in Extract<keyof T, string>]: {
    type: 'cell';
    key: K;
    value: T[K] | undefined;
    row?: T;
  };
}[Extract<keyof T, string>];

export type DataTableCell<T extends DataTableRow> = DataTableHeaderCell<T> | DataTableBodyCell<T>;

export type DataTableSort<T extends DataTableRow> = {
  key: Extract<keyof T, string>;
  direction: 'asc' | 'desc';
};

export type DataTableProps<T extends DataTableRow> = {
  data: T[];
  /** Initial row-height estimate; the rendered row is measured automatically. */
  rowHeight?: number;
  overscan?: number;
  className?: string;
  /** Optional parent-owned row/header action. */
  handleClick?: HandlerKey<T | DataTableColumn<T>, 'row' | 'header'>;
  /** Optional parent-owned persistence hook; the table never saves data by itself. */
  handleSave?: HandlerKey<T[]>;
  handleOrder?: HandlerKey<string[]>;
  emptyMessage?: ReactNode;
  /** Keys to omit from every automatically generated outer or nested table column. */
  ignore_keys?: string[];
  /** Inferred field whose unique values should be rendered as a generated legend. */
  legend_key?: Extract<keyof T, string>;
  renderExpandedRow?: (row: T) => ReactNode;
  /** Row field containing an array of objects to render in the generated expanded table. */
  view_more_key?: Extract<keyof T, string>;
  searchPlaceholder?: string;
  /** Return a node for any inferred header or cell. Return undefined to use its default text. */
  format?: (cell?: DataTableCell<T>) => ReactNode | undefined;
};

export type DataTableModel<T extends DataTableRow> = {
  columns: DataTableColumn<T>[];
  filteredRows: T[];
  legendItems: string[];
  moveColumn: (from: Extract<keyof T, string>, to: Extract<keyof T, string>) => string[];
  onScroll: () => void;
  observeRow: (node: HTMLTableRowElement | null) => void;
  rootRef: RefObject<HTMLDivElement | null>;
  search: string;
  setSearch: (search: string) => void;
  sort: DataTableSort<T> | null;
  startIndex: number;
  totalHeight: number;
  toggleSort: (key: Extract<keyof T, string>) => void;
  viewableRowEnd: number;
  viewableRowStart: number;
  virtualRowHeight: number;
  visibleRows: T[];
};
