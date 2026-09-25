import { useRef, useState } from 'react';
import type { DragEvent, PointerEvent, ReactNode } from 'react';
import './layout-designer.css';

/* the palette's drag payload type: a component spec as JSON */
export const DROP_TYPE = 'application/x-rab-component';

export interface ContentSpec {
  name: string;
}

export interface Box {
  id: string;
  r1: number;
  c1: number;
  r2: number;
  c2: number;
  content?: ContentSpec;
}

interface Cell {
  r: number;
  c: number;
}

type Rect = Omit<Box, 'id' | 'content'>;

type Action =
  | { kind: 'draw'; start: Cell }
  | { kind: 'move'; id: string; offset: Cell }
  | { kind: 'resize'; id: string; edges: string };

export interface LayoutDesignerProps {
  rows?: number;
  cols?: number;
  maxRows?: number;
  maxCols?: number;
  initialBoxes?: Box[];
  onChange?: (boxes: Box[]) => void;
  renderContent?: (spec: ContentSpec) => ReactNode;
}

/* geometry — pure helpers: plain numbers and rects in, values out ----------- */

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

const cellFromPoint = (rect: DOMRect, clientX: number, clientY: number, rows: number, cols: number): Cell => {
  const cw = rect.width / cols;
  const ch = rect.height / rows;
  const c = clamp(Math.floor((clientX - rect.left) / cw), 0, cols - 1);
  const r = clamp(Math.floor((clientY - rect.top) / ch), 0, rows - 1);
  return { r, c };
};

const normalizeBox = (a: Cell, b: Cell): Rect => ({
  r1: Math.min(a.r, b.r),
  c1: Math.min(a.c, b.c),
  r2: Math.max(a.r, b.r),
  c2: Math.max(a.c, b.c),
});

/* CSS grid-area string (1-based, end-exclusive) for a box rect */
export const boxGridArea = (b: Rect) => `${b.r1 + 1} / ${b.c1 + 1} / ${b.r2 + 2} / ${b.c2 + 2}`;

const overlaps = (a: Rect, b: Rect) => a.r1 <= b.r2 && b.r1 <= a.r2 && a.c1 <= b.c2 && b.c1 <= a.c2;

/* slide box fully clear of mover along one axis; null means no axis given */
const shiftToClear = (mover: Rect, box: Box, dr: number, dc: number): Box | null => {
  if (dr > 0) {
    const d = mover.r2 + 1 - box.r1;
    return { ...box, r1: box.r1 + d, r2: box.r2 + d };
  }
  if (dr < 0) {
    const d = box.r2 + 1 - mover.r1;
    return { ...box, r1: box.r1 - d, r2: box.r2 - d };
  }
  if (dc > 0) {
    const d = mover.c2 + 1 - box.c1;
    return { ...box, c1: box.c1 + d, c2: box.c2 + d };
  }
  if (dc < 0) {
    const d = box.c2 + 1 - mover.c1;
    return { ...box, c1: box.c1 - d, c2: box.c2 - d };
  }
  return null;
};

const RESIZE_EDGES = ['t', 'r', 'b', 'l', 'tl', 'tr', 'bl', 'br'] as const;

const closest = (event: { target: EventTarget | null }, selector: string): HTMLElement | null =>
  (event.target as HTMLElement | null)?.closest(selector) ?? null;

/* the designer ---------------------------------------------------------------
   Press-drag on empty grid draws a box, clamped to maxRows × maxCols; a draft
   crossing another box turns blocked (red) and never lands. Drag a box header
   to move it, drag a grip to resize; either pushes neighbours out of the way
   when there is room and holds still when there is not. renderContent(spec)
   turns a dropped palette spec into the box's content. */
export const LayoutDesigner = ({
  rows = 8,
  cols = 4,
  maxRows = 2,
  maxCols = 4,
  initialBoxes = [],
  onChange,
  renderContent,
}: LayoutDesignerProps) => {
  const [boxes, setBoxes] = useState<Box[]>(() => initialBoxes.map((b) => ({ ...b })));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ rect: Rect; blocked: boolean } | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const actionRef = useRef<Action | null>(null);
  const idRef = useRef(0);
  const canvasRef = useRef<HTMLDivElement>(null);
  const boxesRef = useRef(boxes);
  boxesRef.current = boxes;

  const inBounds = (b: Rect) => b.r1 >= 0 && b.c1 >= 0 && b.r2 < rows && b.c2 < cols;

  /* place box `id` at `rect`, pushing overlapped boxes along one axis;
     cascades through neighbours; null when there is no room */
  const placed = (id: string, rect: Rect, dr: number, dc: number): Box[] | null => {
    const current = boxesRef.current;
    const next = new Map(current.map((b) => [b.id, b]));
    next.set(id, { ...next.get(id)!, ...rect });
    const queue = [id];
    let guard = current.length * current.length + 8;
    while (queue.length) {
      if ((guard -= 1) < 0) return null;
      const mover = next.get(queue.shift()!)!;
      for (const box of next.values()) {
        if (box.id === mover.id || !overlaps(mover, box)) continue;
        const pushed = shiftToClear(mover, box, dr, dc);
        if (!pushed || !inBounds(pushed)) return null;
        next.set(box.id, pushed);
        queue.push(box.id);
      }
    }
    return [...next.values()];
  };

  const settle = (next: Box[]) => {
    if (onChange) onChange(next.map((b) => ({ ...b })));
  };

  const cellFromEvent = (event: { clientX: number; clientY: number }): Cell =>
    cellFromPoint(canvasRef.current!.getBoundingClientRect(), event.clientX, event.clientY, rows, cols);

  /* draw: clamp the draft to the max footprint around its anchor */
  const clampDraft = (start: Cell, p: Cell): Rect => {
    const r = clamp(p.r, start.r - maxRows + 1, start.r + maxRows - 1);
    const c = clamp(p.c, start.c - maxCols + 1, start.c + maxCols - 1);
    return normalizeBox(start, { r, c });
  };

  const showDraft = (rect: Rect) => {
    setDraft({ rect, blocked: boxesRef.current.some((b) => overlaps(rect, b)) });
  };

  const moveTo = (cellPos: Cell) => {
    const action = actionRef.current;
    if (!action || action.kind !== 'move') return;
    const box = boxesRef.current.find((b) => b.id === action.id);
    if (!box) return;
    const h = box.r2 - box.r1;
    const w = box.c2 - box.c1;
    const r1 = clamp(cellPos.r - action.offset.r, 0, rows - 1 - h);
    const c1 = clamp(cellPos.c - action.offset.c, 0, cols - 1 - w);
    if (r1 === box.r1 && c1 === box.c1) return;
    const rect: Rect = { r1, c1, r2: r1 + h, c2: c1 + w };
    const dr = Math.sign(r1 - box.r1);
    const dc = Math.sign(c1 - box.c1);
    const next = (dr !== 0 && placed(action.id, rect, dr, 0)) || (dc !== 0 && placed(action.id, rect, 0, dc)) || null;
    if (next) setBoxes(next);
  };

  /* resize along the grabbed edges: rails move one side, corners move two */
  const resizeTo = (cellPos: Cell) => {
    const action = actionRef.current;
    if (!action || action.kind !== 'resize') return;
    const box = boxesRef.current.find((b) => b.id === action.id);
    if (!box) return;
    const edges = action.edges;
    const rect: Rect = { r1: box.r1, c1: box.c1, r2: box.r2, c2: box.c2 };
    if (edges.includes('r')) rect.c2 = clamp(cellPos.c, box.c1, Math.min(cols - 1, box.c1 + maxCols - 1));
    if (edges.includes('l')) rect.c1 = clamp(cellPos.c, Math.max(0, box.c2 - maxCols + 1), box.c2);
    if (edges.includes('b')) rect.r2 = clamp(cellPos.r, box.r1, Math.min(rows - 1, box.r1 + maxRows - 1));
    if (edges.includes('t')) rect.r1 = clamp(cellPos.r, Math.max(0, box.r2 - maxRows + 1), box.r2);
    if (rect.r1 === box.r1 && rect.c1 === box.c1 && rect.r2 === box.r2 && rect.c2 === box.c2) return;
    const dr = rect.r2 > box.r2 ? 1 : rect.r1 < box.r1 ? -1 : 0;
    const dc = rect.c2 > box.c2 ? 1 : rect.c1 < box.c1 ? -1 : 0;
    let next: Box[] | null = null;
    if (dr) next = placed(action.id, rect, dr, 0);
    if (!next && dc) next = placed(action.id, rect, 0, dc);
    if (!next && !dr && !dc) next = placed(action.id, rect, 0, 0);
    if (next) setBoxes(next);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (closest(event, '.layout-designer__box-remove')) return; // delete button owns its click
    const cellPos = cellFromEvent(event);
    const boxEl = closest(event, '.layout-designer__box');

    if (boxEl) {
      const id = boxEl.dataset.boxId!;
      const box = boxesRef.current.find((b) => b.id === id);
      if (!box) return;
      setSelectedId(id);
      const grip = closest(event, '.layout-designer__box-resize');
      if (grip) {
        actionRef.current = { kind: 'resize', id, edges: grip.dataset.resize! };
        setMovingId(id);
        canvasRef.current!.setPointerCapture(event.pointerId);
      } else if (closest(event, '.layout-designer__box-header')) {
        actionRef.current = { kind: 'move', id, offset: { r: cellPos.r - box.r1, c: cellPos.c - box.c1 } };
        setMovingId(id);
        canvasRef.current!.setPointerCapture(event.pointerId);
      }
      return; // plain body press: selection only — loaded content keeps its own pointer
    }

    setSelectedId(null); // pressing empty grid deselects and starts a draw
    actionRef.current = { kind: 'draw', start: cellPos };
    canvasRef.current!.setPointerCapture(event.pointerId);
    showDraft(clampDraft(cellPos, cellPos));
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const action = actionRef.current;
    if (!action) return;
    const cellPos = cellFromEvent(event);
    if (action.kind === 'draw') showDraft(clampDraft(action.start, cellPos));
    else if (action.kind === 'move') moveTo(cellPos);
    else if (action.kind === 'resize') resizeTo(cellPos);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const done = actionRef.current;
    actionRef.current = null;
    setMovingId(null);
    if (canvasRef.current!.hasPointerCapture(event.pointerId)) {
      canvasRef.current!.releasePointerCapture(event.pointerId);
    }
    if (!done) return;
    if (done.kind === 'draw') {
      const rect = clampDraft(done.start, cellFromEvent(event));
      setDraft(null);
      if (boxesRef.current.some((b) => overlaps(rect, b))) return; // never lands on another box
      idRef.current += 1;
      const next = [...boxesRef.current, { ...rect, id: `box-${idRef.current}` }];
      setBoxes(next);
      setSelectedId(`box-${idRef.current}`);
      settle(next);
    } else {
      settle(boxesRef.current); // move/resize already landed cell by cell
    }
  };

  const removeBox = (id: string) => {
    const next = boxesRef.current.filter((b) => b.id !== id);
    setBoxes(next);
    setSelectedId((was) => (was === id ? null : was));
    settle(next);
  };

  /* palette drop: a dragged spec lands in the box under the pointer,
     or lands a fresh box on empty grid */
  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (![...event.dataTransfer.types].includes(DROP_TYPE)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    const boxEl = closest(event, '.layout-designer__box');
    setDropId(boxEl ? boxEl.dataset.boxId! : null);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    const raw = event.dataTransfer.getData(DROP_TYPE);
    if (!raw) return;
    event.preventDefault();
    setDropId(null);
    const spec = JSON.parse(raw) as ContentSpec;
    const boxEl = closest(event, '.layout-designer__box');

    if (boxEl) {
      const id = boxEl.dataset.boxId!;
      const next = boxesRef.current.map((b) => (b.id === id ? { ...b, content: spec } : b));
      setBoxes(next);
      setSelectedId(id);
      settle(next);
      return;
    }

    // empty grid: land a box for it — a 2×2 seat when it fits, else one cell
    const cellPos = cellFromEvent(event);
    const seat = [
      normalizeBox(cellPos, { r: Math.min(cellPos.r + 1, rows - 1), c: Math.min(cellPos.c + 1, cols - 1) }),
      normalizeBox(cellPos, cellPos),
    ].find((rect) => !boxesRef.current.some((b) => overlaps(rect, b)));
    if (!seat) return; // never lands on another box
    idRef.current += 1;
    const next = [...boxesRef.current, { ...seat, id: `box-${idRef.current}`, content: spec }];
    setBoxes(next);
    setSelectedId(`box-${idRef.current}`);
    settle(next);
  };

  return (
    <div className="layout-designer">
      <div
        ref={canvasRef}
        className="layout-designer__canvas"
        style={{ '--layout-designer-rows': rows, '--layout-designer-cols': cols } as React.CSSProperties}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDragOver={onDragOver}
        onDragLeave={(event) => {
          if (!canvasRef.current!.contains(event.relatedTarget as Node)) setDropId(null);
        }}
        onDrop={onDrop}
      >
        {Array.from({ length: rows * cols }, (unused, index) => (
          <div key={index} className="layout-designer__cell" />
        ))}
        {draft && (
          <div
            className={`layout-designer__draft${draft.blocked ? ' layout-designer__draft--blocked' : ''}`}
            style={{ gridArea: boxGridArea(draft.rect) }}
          />
        )}
        {boxes.map((b) => (
          <div
            key={b.id}
            data-box-id={b.id}
            className={[
              'layout-designer__box',
              b.id === selectedId && 'layout-designer__box--selected',
              b.id === movingId && 'layout-designer__box--moving',
              b.id === dropId && 'layout-designer__box--drop',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ gridArea: boxGridArea(b) }}
            title="Click to select · drag header to move · drag a grip to resize"
          >
            <header className="layout-designer__box-header">
              <span className="layout-designer__box-dims">{`${b.c2 - b.c1 + 1}×${b.r2 - b.r1 + 1}`}</span>
              <button
                type="button"
                className="layout-designer__box-remove"
                aria-label="Remove box"
                onClick={() => removeBox(b.id)}
              >
                ×
              </button>
            </header>
            <div className="layout-designer__box-body">
              {b.content && renderContent ? renderContent(b.content) : null}
            </div>
            {RESIZE_EDGES.map((edge) => (
              <span
                key={edge}
                className={`layout-designer__box-resize layout-designer__box-resize--${edge}`}
                data-resize={edge}
                aria-hidden="true"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
