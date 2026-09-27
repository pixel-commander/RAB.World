import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import type { Edge, FloatPanelProps } from '../FloatPanel.types';
import { clamp } from '../js/float-panel';

export const useFloatPanel = ({ collapsed = false, docked = false }: Pick<FloatPanelProps, 'collapsed' | 'docked'>) => {
  const rootRef = useRef<HTMLElement>(null);
  const openBlockSize = useRef('');
  const drag = useRef<{ pointerId: number; dx: number; dy: number } | null>(null);
  const resize = useRef<{ pointerId: number; edge: Edge; startX: number; startY: number; rect: DOMRect } | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (collapsed) {
      openBlockSize.current = root.style.blockSize || openBlockSize.current;
      root.style.blockSize = '';
    } else if (openBlockSize.current) root.style.blockSize = openBlockSize.current;
  }, [collapsed]);

  const startDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (docked || (event.target as HTMLElement).closest('[data-id="float-panel-toggle"]')) return;
    const rect = rootRef.current!.getBoundingClientRect();
    drag.current = { pointerId: event.pointerId, dx: event.clientX - rect.left, dy: event.clientY - rect.top };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const active = drag.current;
    const root = rootRef.current;
    if (!active || !root || active.pointerId !== event.pointerId) return;
    const rect = root.getBoundingClientRect();
    root.style.insetInlineStart = `${clamp(event.clientX - active.dx, 0, window.innerWidth - rect.width)}px`;
    root.style.insetBlockStart = `${clamp(event.clientY - active.dy, 0, window.innerHeight - rect.height)}px`;
    root.style.insetInlineEnd = 'auto';
    root.style.insetBlockEnd = 'auto';
  };
  const endDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const startResize = (edge: Edge, event: ReactPointerEvent<HTMLSpanElement>) => {
    resize.current = { pointerId: event.pointerId, edge, startX: event.clientX, startY: event.clientY, rect: rootRef.current!.getBoundingClientRect() };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const moveResize = (event: ReactPointerEvent<HTMLSpanElement>) => {
    const active = resize.current;
    const root = rootRef.current;
    if (!active || !root || active.pointerId !== event.pointerId) return;
    const dx = event.clientX - active.startX;
    const dy = event.clientY - active.startY;
    const fromLeft = active.edge.includes('l');
    const fromTop = active.edge.includes('t');
    const horizontal = active.edge.includes('l') || active.edge.includes('r');
    const vertical = active.edge.includes('t') || active.edge.includes('b');
    const width = horizontal ? Math.max(280, active.rect.width + (fromLeft ? -dx : dx)) : active.rect.width;
    const height = vertical ? Math.max(180, active.rect.height + (fromTop ? -dy : dy)) : active.rect.height;
    root.style.inlineSize = `${width}px`;
    root.style.blockSize = `${height}px`;
    if (fromLeft) root.style.insetInlineStart = `${active.rect.left + active.rect.width - width}px`;
    if (fromTop) root.style.insetBlockStart = `${active.rect.top + active.rect.height - height}px`;
  };
  const endResize = (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (resize.current?.pointerId !== event.pointerId) return;
    resize.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return { rootRef, startDrag, moveDrag, endDrag, startResize, moveResize, endResize };
};
