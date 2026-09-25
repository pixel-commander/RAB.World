import { useImperativeHandle, useState, type CSSProperties, type ForwardedRef } from 'react';
import { normalizeBoxes, normalizeCount, normalizeTracks, trackListCss, type GridBox, type GridState, type Track } from '../geometry.ts';
import { createGridDesignerHandlers } from '../js/handlers.ts';
import type { GridDesignerRootRef } from '../js/dom.ts';
import type { GridDesignerHandle, GridDrawData } from '../GridDesigner.types.ts';
import type { HandlerKey } from '../../../HouseKeys.types.ts';

export interface UseGridDesignerOptions {
  rootRef: GridDesignerRootRef;
  handleRef: ForwardedRef<GridDesignerHandle>;
  rows: number;
  cols: number;
  boxes: GridBox[];
  rowTracks?: Track[];
  colTracks?: Track[];
  handleChange?: HandlerKey<GridState>;
  handleDraw?: HandlerKey<GridDrawData>;
  handleSave?: HandlerKey<unknown>;
  validate?: (state: GridState) => string | void;
  cssProvider?: (name: string, state: GridState) => string;
}

export function useGridDesigner({
  rootRef,
  handleRef,
  rows: initialRows,
  cols: initialCols,
  boxes: initialBoxes,
  rowTracks: initialRowTracks,
  colTracks: initialColTracks,
  handleChange,
  handleDraw,
  handleSave,
  validate,
  cssProvider,
}: UseGridDesignerOptions) {
  const safeRows = normalizeCount(initialRows, 6);
  const safeCols = normalizeCount(initialCols, 6);
  const safeBoxes = normalizeBoxes(initialBoxes, safeRows, safeCols);
  const [rows, setRows] = useState(safeRows);
  const [cols, setCols] = useState(safeCols);
  const [boxes, setBoxes] = useState(() => safeBoxes);
  const [rowTracks, setRowTracks] = useState(() => normalizeTracks(initialRowTracks, safeRows));
  const [colTracks, setColTracks] = useState(() => normalizeTracks(initialColTracks, safeCols));
  const snapshot = (): GridState => ({
    rows,
    cols,
    boxes: boxes.map((box) => ({ ...box })),
    rowTracks: rowTracks.map((track) => ({ ...track })),
    colTracks: colTracks.map((track) => ({ ...track })),
  });

  const initial: GridState = {
    rows: safeRows,
    cols: safeCols,
    boxes: safeBoxes.map((box) => ({ ...box })),
    rowTracks: normalizeTracks(initialRowTracks, safeRows),
    colTracks: normalizeTracks(initialColTracks, safeCols),
  };

  const handlers = createGridDesignerHandlers({
    rootRef,
    snapshot,
    initial,
    writers: {
      rows: setRows,
      cols: setCols,
      boxes: setBoxes,
      rowTracks: setRowTracks,
      colTracks: setColTracks,
    },
    handleGridChange: handleChange,
    handleDraw,
    handleSave,
    validate,
    cssProvider,
  });

  useImperativeHandle(handleRef, () => handlers.api);

  const gridStyle = {
    '--grid-rows': trackListCss(rowTracks, rows),
    '--grid-cols': trackListCss(colTracks, cols),
    '--grid-row-count': rows,
    '--grid-column-count': cols,
  } as CSSProperties;
  return {
    snapshot,
    gridStyle,
    ...handlers,
  };
}
