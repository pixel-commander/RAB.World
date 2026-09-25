import type { MutableRefObject } from 'react';
import { DEVICES, RESIZE_EDGES, boxGridArea, clamp, type ResizeEdge, type GridBox } from '../geometry.ts';

export type GridDesignerRootRef = MutableRefObject<HTMLDivElement | null>;

export type DrawAction =
  | { kind: 'draw'; pointerId: number; startRow: number; startCol: number }
  | { kind: 'move'; pointerId: number; id: number; startRow: number; startCol: number; source: GridBox }
  | { kind: 'resize'; pointerId: number; id: number; edge: ResizeEdge; source: GridBox };

export function findOwned<ElementType extends Element>(rootRef: GridDesignerRootRef, selector: string) {
  return rootRef.current?.querySelector<ElementType>(selector) ?? null;
}

export function bindRoot(rootRef: GridDesignerRootRef, element: HTMLDivElement | null) {
  rootRef.current = element;
  element?.querySelectorAll<HTMLElement>('[data-id^="row-"], [data-id^="col-"]').forEach((track) => {
    const id = track.dataset.id;
    const mode = id ? element.querySelector<HTMLSelectElement>('[data-id="track-' + id + '-mode"]')?.value : undefined;
    track.classList.toggle('grid-designer__track--manual', mode === 'manual');
  });
}

export function storeBox(element: HTMLElement, box: GridBox) {
  element.dataset.r1 = String(box.r1);
  element.dataset.c1 = String(box.c1);
  element.dataset.r2 = String(box.r2);
  element.dataset.c2 = String(box.c2);
}

export function readBox(element: HTMLElement | null, id = -1): GridBox | null {
  if (!element) return null;
  const r1 = Number(element.dataset.r1);
  const c1 = Number(element.dataset.c1);
  const r2 = Number(element.dataset.r2);
  const c2 = Number(element.dataset.c2);
  return [r1, c1, r2, c2].every(Number.isFinite) ? { id, r1, c1, r2, c2 } : null;
}

export function clearAction(canvas: HTMLElement) {
  canvas.querySelectorAll('[data-resizing]').forEach((box) => box.removeAttribute('data-resizing'));
  ['resizeEdge', 'actionKind', 'pointerId', 'boxId', 'startRow', 'startCol', 'sourceR1', 'sourceC1', 'sourceR2', 'sourceC2'].forEach((key) => delete canvas.dataset[key]);
}

export function readAction(canvas: HTMLElement): DrawAction | null {
  const kind = canvas.dataset.actionKind;
  const pointerId = Number(canvas.dataset.pointerId);
  if (!kind || !Number.isFinite(pointerId)) return null;
  if (kind === 'draw') {
    const startRow = Number(canvas.dataset.startRow);
    const startCol = Number(canvas.dataset.startCol);
    return Number.isFinite(startRow) && Number.isFinite(startCol)
      ? { kind, pointerId, startRow, startCol }
      : null;
  }
  const id = Number(canvas.dataset.boxId);
  const source = {
    id,
    r1: Number(canvas.dataset.sourceR1),
    c1: Number(canvas.dataset.sourceC1),
    r2: Number(canvas.dataset.sourceR2),
    c2: Number(canvas.dataset.sourceC2),
  };
  if (![id, source.r1, source.c1, source.r2, source.c2].every(Number.isFinite)) return null;
  if (kind === 'move') {
    const startRow = Number(canvas.dataset.startRow);
    const startCol = Number(canvas.dataset.startCol);
    return Number.isFinite(startRow) && Number.isFinite(startCol)
      ? { kind, pointerId, id, startRow, startCol, source }
      : null;
  }
  if (kind === 'resize') {
    const edge = canvas.dataset.resizeEdge as ResizeEdge;
    if (RESIZE_EDGES.includes(edge)) return { kind, pointerId, id, edge, source };
  }
  return null;
}

export function showOverlay(rootRef: GridDesignerRootRef, selector: string, box: GridBox) {
  const element = findOwned<HTMLElement>(rootRef, selector);
  if (!element) return;
  delete element.dataset.hideToken;
  storeBox(element, box);
  element.style.setProperty('--box-area', boxGridArea(box));
  element.classList.add('is-visible');
}

export function hideOverlay(rootRef: GridDesignerRootRef, selector: string) {
  findOwned<HTMLElement>(rootRef, selector)?.classList.remove('is-visible');
}

export function applyDevice(rootRef: GridDesignerRootRef, value: string) {
  const viewport = findOwned<HTMLElement>(rootRef, '[data-id="viewport"]');
  const frame = findOwned<HTMLElement>(rootRef, '[data-id="device-frame"]');
  const device = value in DEVICES ? DEVICES[value as keyof typeof DEVICES] : null;
  if (device) {
    viewport?.setAttribute('data-device', value);
    frame?.style.setProperty('--device-inline', device.inline + 'px');
    frame?.style.setProperty('--device-block', device.block + 'px');
    return;
  }
  viewport?.removeAttribute('data-device');
  frame?.style.removeProperty('--device-inline');
  frame?.style.removeProperty('--device-block');
}

export function writeSaveState(rootRef: GridDesignerRootRef, message?: string, busy?: boolean) {
  const status = findOwned<HTMLOutputElement>(rootRef, '[data-id="save-status"]');
  const submit = findOwned<HTMLButtonElement>(rootRef, '[data-id="save-submit"]');
  if (message !== undefined && status) status.textContent = message;
  if (busy !== undefined && submit) submit.disabled = busy;
}

export function showDraft(rootRef: GridDesignerRootRef, box: GridBox, isBlocked: boolean) {
  showOverlay(rootRef, '[data-id="draft"]', box);
  findOwned<HTMLElement>(rootRef, '[data-id="draft"]')?.classList.toggle('grid-designer__draft--blocked', isBlocked);
}

export function cellAt(rootRef: GridDesignerRootRef, clientX: number, clientY: number, rows: number, cols: number) {
  const canvas = findOwned<HTMLElement>(rootRef, '[data-id="canvas"]');
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return {
    row: clamp(Math.floor(((clientY - rect.top) / rect.height) * rows) + 1, 1, rows),
    col: clamp(Math.floor(((clientX - rect.left) / rect.width) * cols) + 1, 1, cols),
  };
}
