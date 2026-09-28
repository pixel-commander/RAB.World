import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DataTableColumn, DataTableModel, DataTableRow, DataTableSort } from '../DataTable.types';
import { virtualize } from './virtualize';

type UseDataTableOptions<T extends DataTableRow> = {
  data: T[];
  legend_key?: Extract<keyof T, string>;
  ignore_keys: string[];
  overscan: number;
  rowHeight: number;
  view_more_key?: Extract<keyof T, string>;
};

const valueText = (value: unknown) => {
  if (value == null) return '';
  if (value instanceof Date) return value.toLocaleString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const compareValues = (left: unknown, right: unknown) => {
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  if (left instanceof Date && right instanceof Date) return left.getTime() - right.getTime();
  return valueText(left).localeCompare(valueText(right), undefined, { numeric: true, sensitivity: 'base' });
};

export const useDataTable = <T extends DataTableRow>({
  data,
  legend_key,
  ignore_keys,
  rowHeight,
  view_more_key,
  overscan,
}: UseDataTableOptions<T>): DataTableModel<T> => {
  const rootRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const rowObserverRef = useRef<ResizeObserver | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<DataTableSort<T> | null>(null);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [scrollTop, setScrollTop] = useState(0);
  const [, setLayoutVersion] = useState(0);
  const [virtualRowHeight, setVirtualRowHeight] = useState(rowHeight);

  // Columns intentionally come only from the first item, as the component contract specifies.
  const columns = useMemo<DataTableColumn<T>[]>(() => {
    const inferred = Object.keys(data[0] ?? {}).filter(key => key !== view_more_key && !ignore_keys.includes(key));
    const ordered = [...columnOrder.filter(key => inferred.includes(key)), ...inferred.filter(key => !columnOrder.includes(key))];
    return ordered.map(key => ({ key: key as Extract<keyof T, string>, label: key }));
  }, [columnOrder, data, ignore_keys, view_more_key]);

  const legendItems = useMemo(() => {
    if (!legend_key) return [];
    // Ordered unique values without allocating a Set, so legend order follows the source data.
    return data.reduce<string[]>((items, row) => {
      const value = valueText(row?.[legend_key]);
      return items.includes(value) ? items : [...items, value];
    }, []);
  }, [data, legend_key]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const matchingRows = query ? data.filter(row => columns.some(({ key }) => valueText(row?.[key]).toLocaleLowerCase().includes(query))) : data;
    if (!sort) return matchingRows;
    return matchingRows
      .map((row, index) => ({ row, index }))
      .sort((left, right) => {
        const result = compareValues(left.row?.[sort.key], right.row?.[sort.key]);
        return result === 0 ? left.index - right.index : sort.direction === 'asc' ? result : -result;
      })
      .map(({ row }) => row);
  }, [columns, data, search, sort]);

  const { endIndex, startIndex, totalHeight, viewableRowEnd, viewableRowStart } = virtualize({
    element: rootRef.current,
    rowCount: filteredRows.length,
    rowHeight: virtualRowHeight,
    scrollTop,
    overscan,
  });
  const visibleRows = filteredRows.slice(startIndex, endIndex);

  const measure = useCallback(() => setLayoutVersion(version => version + 1), []);

  useEffect(() => {
    measure();
    const observer = new ResizeObserver(measure);
    if (rootRef.current) observer.observe(rootRef.current);
    return () => observer.disconnect();
  }, [measure]);

  useEffect(() => {
    rootRef.current?.scrollTo({ top: 0 });
    setScrollTop(0);
  }, [search]);

  useEffect(() => setVirtualRowHeight(rowHeight), [rowHeight]);

  useEffect(() => {
    if (sort && !columns.some(column => column.key === sort.key)) setSort(null);
  }, [columns, sort]);

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
  }, []);

  const onScroll = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      setScrollTop(rootRef.current?.scrollTop ?? 0);
      frameRef.current = null;
    });
  }, []);

  const observeRow = useCallback((node: HTMLTableRowElement | null) => {
    rowObserverRef.current?.disconnect();
    if (!node) return;
    const measureRow = () => {
      const nextHeight = node.getBoundingClientRect().height;
      if (nextHeight > 0) setVirtualRowHeight(current => Math.abs(current - nextHeight) < .5 ? current : nextHeight);
    };
    measureRow();
    rowObserverRef.current = new ResizeObserver(measureRow);
    rowObserverRef.current.observe(node);
  }, []);

  const toggleSort = useCallback((key: Extract<keyof T, string>) => {
    setSort(current => {
      if (current?.key !== key) return { key, direction: 'asc' };
      if (current.direction === 'asc') return { key, direction: 'desc' };
      return null;
    });
  }, []);

  const moveColumn = useCallback((from: Extract<keyof T, string>, to: Extract<keyof T, string>) => {
    const ordered = columnOrder.length ? [...columnOrder] : columns.map(column => column.key);
    const fromIndex = ordered.indexOf(from);
    const toIndex = ordered.indexOf(to);
    if (from === to || fromIndex < 0 || toIndex < 0) return ordered;
    ordered.splice(fromIndex, 1);
    ordered.splice(toIndex, 0, from);
    setColumnOrder(ordered);
    return ordered;
  }, [columnOrder, columns]);

  return { columns, filteredRows, legendItems, moveColumn, observeRow, onScroll, rootRef, search, setSearch, sort, startIndex, totalHeight, toggleSort, viewableRowEnd, viewableRowStart, virtualRowHeight, visibleRows };
};

export { valueText };
