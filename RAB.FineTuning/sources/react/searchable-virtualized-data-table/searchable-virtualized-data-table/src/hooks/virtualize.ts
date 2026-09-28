export type VirtualizeOptions = {
  element: HTMLElement | null;
  rowCount: number;
  rowHeight: number;
  scrollTop: number;
  overscan: number;
};

export const virtualize = ({
  element,
  rowCount,
  rowHeight,
  scrollTop,
  overscan,
}: VirtualizeOptions) => {
  const viewportHeight = element?.clientHeight ?? 0;
  const rowAt = (offset: number) => {
    if (!rowCount) return 0;
    return Math.min(rowCount - 1, Math.max(0, Math.floor(offset / rowHeight)));
  };

  const viewStart = rowAt(scrollTop);
  const viewEnd = rowCount ? Math.min(rowCount, rowAt(scrollTop + viewportHeight) + 1) : 0;
  const startIndex = Math.max(0, viewStart - overscan);
  const endIndex = Math.min(rowCount, viewEnd + overscan);

  return {
    startIndex,
    endIndex,
    totalHeight: rowCount * rowHeight,
    viewableRowStart: rowCount ? viewStart + 1 : 0,
    viewableRowEnd: Math.max(viewStart, viewEnd),
  };
};
