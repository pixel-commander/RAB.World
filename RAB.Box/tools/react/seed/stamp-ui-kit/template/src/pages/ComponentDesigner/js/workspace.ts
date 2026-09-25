import type { HandlerKey } from '../../../HouseKeys.types.ts';
export const resizeEdges = ['t', 'r', 'b', 'l', 'tl', 'tr', 'bl', 'br'] as const;
export function attachWorkspace(root: HTMLElement | null) {
  const canvas = root?.querySelector<HTMLElement>('[data-id="workspace"]');
  const box = root?.querySelector<HTMLElement>('[data-id="draw-grid"]');
  const hint = root?.querySelector<HTMLElement>('[data-id="draw-hint"]');
  if (!canvas || !box) return () => {};
  type Rect = { x: number; y: number; w: number; h: number };
  let drag: { id: number; x: number; y: number; rect: Rect; mode: string; previousHidden: boolean } | null = null;
  const snapshot = (): Rect => ({ x: parseFloat(box.style.left) || 0, y: parseFloat(box.style.top) || 0, w: box.offsetWidth, h: box.offsetHeight });
  const paint = (rect: Rect) => Object.assign(box.style, { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px` });
  const point = (data: PointerEvent) => { const rect = canvas.getBoundingClientRect(); return { x: Math.max(0, Math.min(canvas.clientWidth, data.clientX - rect.left)), y: Math.max(0, Math.min(canvas.clientHeight, data.clientY - rect.top)) }; };
  const handlePointerDown: HandlerKey<PointerEvent> = data => {
    if (!data || data.button !== 0 || drag || !(data.target instanceof Element)) return;
    const handle = data.target.closest<HTMLElement>('[data-id="resize-grid"], [data-id="move-grid"]');
    if (!handle && data.target !== canvas) return;
    const cursor = point(data);
    drag = { id: data.pointerId, ...cursor, rect: snapshot(), mode: handle?.dataset.edge ?? (handle ? 'move' : 'draw'), previousHidden: box.hidden === true };
    data.preventDefault();
    canvas.setPointerCapture(data.pointerId);
    if (hint) hint.hidden = true;
    box.hidden = false;
    if (!handle) paint({ ...cursor, w: 0, h: 0 });
  };
  const handlePointerMove: HandlerKey<PointerEvent> = data => {
    if (!data || !drag || data.pointerId !== drag.id) return;
    const cursor = point(data); const dx = cursor.x - drag.x; const dy = cursor.y - drag.y;
    const r = drag.rect;
    if (drag.mode === 'draw') { paint({ x: Math.min(drag.x, cursor.x), y: Math.min(drag.y, cursor.y), w: Math.abs(dx), h: Math.abs(dy) }); return; }
    if (drag.mode === 'move') { paint({ ...r, x: Math.max(0, Math.min(canvas.clientWidth - r.w, r.x + dx)), y: Math.max(0, Math.min(canvas.clientHeight - r.h, r.y + dy)) }); return; }
    let left = r.x, top = r.y, right = r.x + r.w, bottom = r.y + r.h;
    if (drag.mode.includes('l')) left = Math.max(0, Math.min(right - 48, r.x + dx));
    if (drag.mode.includes('r')) right = Math.min(canvas.clientWidth, Math.max(left + 48, right + dx));
    if (drag.mode.includes('t')) top = Math.max(0, Math.min(bottom - 48, r.y + dy));
    if (drag.mode.includes('b')) bottom = Math.min(canvas.clientHeight, Math.max(top + 48, bottom + dy));
    paint({ x: left, y: top, w: right - left, h: bottom - top });
  };
  const handlePointerUp: HandlerKey<PointerEvent> = data => {
    if (!data || !drag || data.pointerId !== drag.id) return;
    handlePointerMove(data);
    if (data.type !== 'pointerup' || box.offsetWidth < 48 || box.offsetHeight < 48) { paint(drag.rect); box.hidden = drag.previousHidden; }
    if (hint) hint.hidden = !box.hidden;
    drag = null;
    if (canvas.hasPointerCapture(data.pointerId)) canvas.releasePointerCapture(data.pointerId);
  };
  canvas.addEventListener('pointerdown', handlePointerDown);
  canvas.addEventListener('pointermove', handlePointerMove);
  canvas.addEventListener('pointerup', handlePointerUp);
  canvas.addEventListener('pointercancel', handlePointerUp);
  return () => {
    canvas.removeEventListener('pointerdown', handlePointerDown); canvas.removeEventListener('pointermove', handlePointerMove);
    canvas.removeEventListener('pointerup', handlePointerUp); canvas.removeEventListener('pointercancel', handlePointerUp);
  };
}
