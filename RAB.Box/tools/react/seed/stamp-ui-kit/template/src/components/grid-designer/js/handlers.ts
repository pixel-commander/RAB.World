import type {
  Dispatch,
  FormEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  SetStateAction,
} from 'react';
import {
  atomCss,
  RESIZE_EDGES,
  resizeBox,
  type ResizeEdge,
  gridAtomName,
  clamp,
  clampBox,
  normalizeTracks,
  placed,
  validateGridState,
  type GridBox,
  type GridState,
  type Track,
} from '../geometry.ts';
import type { GridDesignerHandle, GridDrawData } from '../GridDesigner.types.ts';
import type { HandlerKey } from '../../../HouseKeys.types.ts';
import {
  applyDevice,
  bindRoot,
  cellAt,
  clearAction,
  findOwned,
  hideOverlay,
  readAction,
  readBox,
  showDraft,
  showOverlay,
  writeSaveState,
  type GridDesignerRootRef,
} from './dom.ts';

export interface GridDesignerWriters {
  rows: Dispatch<SetStateAction<number>>;
  cols: Dispatch<SetStateAction<number>>;
  boxes: Dispatch<SetStateAction<GridBox[]>>;
  rowTracks: Dispatch<SetStateAction<Track[]>>;
  colTracks: Dispatch<SetStateAction<Track[]>>;
}

export interface GridDesignerHandlerOptions {
  rootRef: GridDesignerRootRef;
  snapshot: () => GridState;
  initial: GridState;
  writers: GridDesignerWriters;
  handleGridChange?: HandlerKey<GridState>;
  handleDraw?: HandlerKey<GridDrawData>;
  handleSave?: HandlerKey<unknown>;
  validate?: (state: GridState) => string | void;
  cssProvider?: (name: string, state: GridState) => string;
}

const copyBoxes = (boxes: GridBox[]) => boxes.map((box) => ({ ...box }));

export function createGridDesignerHandlers({
  rootRef,
  snapshot,
  initial,
  writers,
  handleGridChange,
  handleDraw,
  handleSave,
  validate,
  cssProvider,
}: GridDesignerHandlerOptions) {
  const publish = (next: GridState, drawn?: GridBox) => {
    handleGridChange?.(next, 'grid');
    if (drawn) handleDraw?.({ box: drawn, state: next }, 'draw');
  };

  const commitBoxes = (nextBoxes: GridBox[], drawn?: GridBox) => {
    writers.boxes(nextBoxes);
    publish({ ...snapshot(), boxes: copyBoxes(nextBoxes) }, drawn);
  };

  const setGrid = (nextRows: number, nextCols: number) => {
    const current = snapshot();
    const rows = Math.max(1, Math.floor(nextRows || 1));
    const cols = Math.max(1, Math.floor(nextCols || 1));
    const boxes = current.boxes.map((box) => clampBox(box, rows, cols));
    const rowTracks = normalizeTracks(current.rowTracks, rows);
    const colTracks = normalizeTracks(current.colTracks, cols);
    writers.rows(rows);
    writers.cols(cols);
    writers.boxes(boxes);
    writers.rowTracks(rowTracks);
    writers.colTracks(colTracks);
    publish({ rows, cols, boxes, rowTracks, colTracks });
  };

  const reset = () => {
    const next = {
      rows: initial.rows,
      cols: initial.cols,
      boxes: copyBoxes(initial.boxes),
      rowTracks: initial.rowTracks.map((track) => ({ ...track })),
      colTracks: initial.colTracks.map((track) => ({ ...track })),
    };
    writers.rows(next.rows);
    writers.cols(next.cols);
    writers.boxes(next.boxes);
    writers.rowTracks(next.rowTracks);
    writers.colTracks(next.colTracks);
    applyDevice(rootRef, '');
    publish(next);
  };

  const openSave = () => {
    const current = snapshot();
    writeSaveState(rootRef, validate?.(current) || validateGridState(current) || '');
    const dialog = findOwned<HTMLDialogElement>(rootRef, '[data-id="save-dialog"]');
    if (dialog && !dialog.open) dialog.showModal();
  };

  const closeSave = () => findOwned<HTMLDialogElement>(rootRef, '[data-id="save-dialog"]')?.close();

  const beginDraw = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = snapshot();
    const cell = cellAt(rootRef, event.clientX, event.clientY, current.rows, current.cols);
    if (!cell) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.dataset.actionKind = 'draw';
    event.currentTarget.dataset.pointerId = String(event.pointerId);
    event.currentTarget.dataset.startRow = String(cell.row);
    event.currentTarget.dataset.startCol = String(cell.col);
    hideOverlay(rootRef, '[data-id="blocked"]');
    const candidate = { id: -1, r1: cell.row, c1: cell.col, r2: cell.row, c2: cell.col };
    showDraft(rootRef, candidate, !placed(candidate, current.boxes, current.rows, current.cols));
  };

  const beginBoxAction = (event: ReactPointerEvent<HTMLDivElement>, box: GridBox, kind: 'move' | 'resize', edge: ResizeEdge = 'br') => {
    const current = snapshot();
    const cell = cellAt(rootRef, event.clientX, event.clientY, current.rows, current.cols);
    if (!cell) return;
    const canvas = event.currentTarget;
    canvas.setPointerCapture(event.pointerId);
    canvas.dataset.actionKind = kind;
    canvas.dataset.resizeEdge = edge;
    if (kind === 'resize') findOwned<HTMLElement>(rootRef, '[data-id="resize-' + edge + '-' + box.id + '"]')?.setAttribute('data-resizing', '');
    canvas.dataset.pointerId = String(event.pointerId);
    canvas.dataset.boxId = String(box.id);
    canvas.dataset.sourceR1 = String(box.r1);
    canvas.dataset.sourceC1 = String(box.c1);
    canvas.dataset.sourceR2 = String(box.r2);
    canvas.dataset.sourceC2 = String(box.c2);
    if (kind === 'move') {
      canvas.dataset.startRow = String(cell.row);
      canvas.dataset.startCol = String(cell.col);
    }
  };

  const handleCanvasPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    const targetId = target.closest<HTMLElement>('[data-id]')?.dataset.id;
    if (targetId?.startsWith('area-') || targetId?.startsWith('remove-')) return;
    const boxElement = target.closest<HTMLElement>('[data-id^="box-"]');
    if (!boxElement) {
      event.preventDefault();
      beginDraw(event);
      return;
    }
    const box = snapshot().boxes.find((candidate) => candidate.id === Number(boxElement.dataset.id?.slice(4)));
    if (!box) return;
    event.preventDefault();
    const edge = targetId?.split('-')[1] as ResizeEdge;
    beginBoxAction(event, box, targetId?.startsWith('resize-') && RESIZE_EDGES.includes(edge) ? 'resize' : 'move', edge);
  };

  const handleCanvasPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const action = readAction(event.currentTarget);
    if (!action || action.pointerId !== event.pointerId) return;
    const current = snapshot();
    const cell = cellAt(rootRef, event.clientX, event.clientY, current.rows, current.cols);
    if (!cell) return;
    if (action.kind === 'draw') {
      const candidate = { id: -1, r1: action.startRow, c1: action.startCol, r2: cell.row, c2: cell.col };
      showDraft(rootRef, candidate, !placed(candidate, current.boxes, current.rows, current.cols));
      return;
    }
    if (action.kind === 'move') {
      const height = action.source.r2 - action.source.r1;
      const width = action.source.c2 - action.source.c1;
      const r1 = clamp(action.source.r1 + cell.row - action.startRow, 1, Math.max(1, current.rows - height));
      const c1 = clamp(action.source.c1 + cell.col - action.startCol, 1, Math.max(1, current.cols - width));
      const candidate = { ...action.source, r1, c1, r2: r1 + height, c2: c1 + width };
      const result = placed(candidate, current.boxes, current.rows, current.cols, action.id);
      if (result) {
        hideOverlay(rootRef, '[data-id="blocked"]');
        commitBoxes(current.boxes.map((box) => box.id === action.id ? result : box));
      } else showOverlay(rootRef, '[data-id="blocked"]', candidate);
      return;
    }
    const candidate = resizeBox(action.source, action.edge, cell.row, cell.col);
    const result = placed(candidate, current.boxes, current.rows, current.cols, action.id);
    if (result) {
      hideOverlay(rootRef, '[data-id="blocked"]');
      commitBoxes(current.boxes.map((box) => box.id === action.id ? result : box));
    } else showOverlay(rootRef, '[data-id="blocked"]', candidate);
  };

  const handleCanvasPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const action = readAction(event.currentTarget);
    if (!action || action.pointerId !== event.pointerId) return;
    const current = snapshot();
    const releasedCell = action.kind === 'draw'
      ? cellAt(rootRef, event.clientX, event.clientY, current.rows, current.cols)
      : null;
    const draft = action.kind === 'draw' && releasedCell
      ? { id: -1, r1: action.startRow, c1: action.startCol, r2: releasedCell.row, c2: releasedCell.col }
      : readBox(findOwned<HTMLElement>(rootRef, '[data-id="draft"]'));
    if (action.kind === 'draw' && draft) {
      const nextId = Math.max(0, ...current.boxes.map((box) => box.id)) + 1;
      const candidate = placed({ ...draft, id: nextId }, current.boxes, current.rows, current.cols);
      if (candidate) commitBoxes([...current.boxes, candidate], candidate);
      else showOverlay(rootRef, '[data-id="blocked"]', draft);
    }
    clearAction(event.currentTarget);
    hideOverlay(rootRef, '[data-id="draft"]');
    findOwned<HTMLElement>(rootRef, '[data-id="draft"]')?.classList.remove('grid-designer__draft--blocked');
    const blocked = findOwned<HTMLElement>(rootRef, '[data-id="blocked"]');
    if (!blocked) return;
    const hideToken = String(performance.now());
    blocked.dataset.hideToken = hideToken;
    window.setTimeout(() => {
      if (blocked.dataset.hideToken === hideToken) hideOverlay(rootRef, '[data-id="blocked"]');
    }, 260);
  };

  const updateTrack = (axis: 'row' | 'col', index: number, patch: Partial<Track>) => {
    const current = snapshot();
    const source = axis === 'row' ? current.rowTracks : current.colTracks;
    const next = source.map((track, trackIndex) => trackIndex === index ? { ...track, ...patch } : track);
    findOwned<HTMLElement>(rootRef, '[data-id="' + axis + '-' + index + '"]')?.classList.toggle('grid-designer__track--manual', next[index].mode === 'manual');
    if (axis === 'row') {
      writers.rowTracks(next);
      publish({ ...current, rowTracks: next });
    } else {
      writers.colTracks(next);
      publish({ ...current, colTracks: next });
    }
  };

  const handleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const id = (event.target as HTMLElement).closest<HTMLElement>('[data-id]')?.dataset.id;
    if (id === 'reset') reset();
    else if (id === 'open-save') openSave();
    else if (id === 'close-save') closeSave();
    else if (id?.startsWith('remove-')) {
      const current = snapshot();
      const boxId = Number(id.slice(7));
      commitBoxes(current.boxes.filter((box) => box.id !== boxId));
    }
  };

  const handleChange = (event: FormEvent<HTMLDivElement>) => {
    const element = event.target as HTMLInputElement | HTMLSelectElement;
    const id = element.dataset.id;
    const current = snapshot();
    if (id === 'rows') setGrid(Number(element.value), current.cols);
    else if (id === 'cols') setGrid(current.rows, Number(element.value));
    else if (id === 'device') applyDevice(rootRef, element.value);
    else if (id?.startsWith('track-')) {
      const [, axis, index, field] = id.split('-') as ['', 'row' | 'col', string, 'mode' | 'manual'];
      updateTrack(axis, Number(index), { [field]: element.value } as Partial<Track>);
    } else if (id?.startsWith('area-')) {
      const boxId = Number(id.slice(5));
      commitBoxes(current.boxes.map((box) => box.id === boxId ? { ...box, area: element.value } : box));
    }
  };

  const save = async (form: HTMLFormElement) => {
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    if (!/^grid-[a-z0-9][a-z0-9-]*$/.test(name)) {
      writeSaveState(rootRef, 'Name must be grid-<variant> in kebab-case.');
      return;
    }
    const type = String(data.get('type') || 'misc');
    const current = snapshot();
    const problem = validate?.(current) || validateGridState(current);
    if (problem) {
      writeSaveState(rootRef, problem);
      return;
    }
    writeSaveState(rootRef, 'Saving…', true);
    try {
      const response = await fetch('/api/atoms/grid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          type,
          description: String(data.get('description') || ''),
          css: (cssProvider ?? atomCss)(name, current),
        }),
      });
      if (!response.ok) throw new Error('POST /api/atoms/grid failed (' + response.status + ').');
      const detail = await response.json();
      writeSaveState(rootRef, 'Saved.');
      handleSave?.(detail, 'save');
    } catch (error) {
      writeSaveState(rootRef, error instanceof Error ? error.message : 'Save failed.');
    } finally {
      writeSaveState(rootRef, undefined, false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void save(event.currentTarget);
  };

  const api: GridDesignerHandle = {
    getState: snapshot,
    setState: (next) => {
      const current = snapshot();
      const rows = Math.max(1, next.rows ?? current.rows);
      const cols = Math.max(1, next.cols ?? current.cols);
      const boxes = copyBoxes(next.boxes ?? current.boxes).map((box) => clampBox(box, rows, cols));
      const rowTracks = normalizeTracks(next.rowTracks ?? current.rowTracks, rows);
      const colTracks = normalizeTracks(next.colTracks ?? current.colTracks, cols);
      writers.rows(rows);
      writers.cols(cols);
      writers.boxes(boxes);
      writers.rowTracks(rowTracks);
      writers.colTracks(colTracks);
      publish({ rows, cols, boxes, rowTracks, colTracks });
    },
    getAtomCss: (name = 'grid-custom') => {
      const atomName = gridAtomName(name);
      return (cssProvider ?? atomCss)(atomName, snapshot());
    },
    openSave,
    reset,
  };

  return {
    api,
    bindRoot: (element: HTMLDivElement | null) => bindRoot(rootRef, element),
    handleClick,
    handleChange,
    handlePointerDown: handleCanvasPointerDown,
    handlePointerMove: handleCanvasPointerMove,
    handlePointerUp: handleCanvasPointerEnd,
    handlePointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => {
      clearAction(event.currentTarget);
      hideOverlay(rootRef, '[data-id="draft"]');
      hideOverlay(rootRef, '[data-id="blocked"]');
    },
    handleSubmit,
  };
}
