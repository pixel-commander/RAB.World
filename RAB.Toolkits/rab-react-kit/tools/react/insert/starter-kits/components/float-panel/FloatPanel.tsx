import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import './float-panel.css';

const EDGES = ['t', 'r', 'b', 'l', 'tl', 'tr', 'bl', 'br'] as const;
type Edge = (typeof EDGES)[number];

export interface FloatPanelProps {
  title?: ReactNode;
  children?: ReactNode;
  hidden?: boolean;
  collapsed?: boolean;
  resizable?: boolean;
  docked?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

export const FloatPanel = ({ title = '', children, hidden = false, collapsed = false, resizable = true, docked = false, onCollapsedChange }: FloatPanelProps) => {
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
    if (docked || (event.target as HTMLElement).closest('.float-panel__toggle')) return;
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

  return (
    <section ref={rootRef} hidden={hidden} className={`float-panel container-float${collapsed ? ' float-panel--collapsed' : ''}${docked ? ' float-panel--docked' : ''}${resizable && !docked ? ' resizable' : ''}`}>
      <header className="float-panel__header" title={docked ? undefined : 'Drag to move'} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
        <span className="float-panel__title">{title}</span>
        <button type="button" className="float-panel__toggle" aria-label={collapsed ? 'Expand panel' : 'Collapse panel'} onClick={() => onCollapsedChange?.(!collapsed)}>{collapsed ? '+' : '–'}</button>
      </header>
      <div className="float-panel__body" hidden={collapsed}>{children}</div>
      {resizable && !docked && EDGES.map((edge) => (
        <span key={edge} className={`resizable__handle resizable__handle--${edge}`} aria-hidden="true" onPointerDown={(event) => startResize(edge, event)} onPointerMove={moveResize} onPointerUp={endResize} onPointerCancel={endResize} />
      ))}
    </section>
  );
};
