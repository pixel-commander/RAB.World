import type { PointerEvent, KeyboardEvent } from 'react';
import type { HandlerKey } from '../../../HouseKeys.types.ts';

const drags = new WeakMap<HTMLButtonElement, { id: number; x: number; y: number }>();
const boxOf = (handle: HTMLButtonElement) => handle.closest<HTMLElement>('[data-id="rabbit-mascot"]');
const place = (box: HTMLElement, x: number, y: number) => {
  const rect = box.getBoundingClientRect();
  box.style.left = `${Math.max(0, Math.min(window.innerWidth - rect.width, x))}px`;
  box.style.top = `${Math.max(0, Math.min(window.innerHeight - rect.height, y))}px`;
  box.style.right = 'auto';
  box.style.bottom = 'auto';
};
export const handlePointerDown: HandlerKey<PointerEvent<HTMLButtonElement>, string, void> = (event) => {
  if (!event || event.button !== 0) return;
  const handle = event.currentTarget, box = boxOf(handle);
  if (!box) return;
  const rect = box.getBoundingClientRect();
  drags.set(handle, { id: event.pointerId, x: event.clientX - rect.left, y: event.clientY - rect.top });
  handle.setPointerCapture(event.pointerId);
  event.preventDefault();
};
export const handlePointerMove: HandlerKey<PointerEvent<HTMLButtonElement>, string, void> = (event) => {
  if (!event) return;
  const drag = drags.get(event.currentTarget), box = boxOf(event.currentTarget);
  if (drag && box && drag.id === event.pointerId) place(box, event.clientX - drag.x, event.clientY - drag.y);
};
export const handlePointerUp: HandlerKey<PointerEvent<HTMLButtonElement>, string, void> = (event) => {
  if (!event) return;
  drags.delete(event.currentTarget);
  if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
};
export const handleKeyDown: HandlerKey<KeyboardEvent<HTMLButtonElement>, string, void> = (event) => {
  if (!event || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
  const box = boxOf(event.currentTarget);
  if (!box) return;
  event.preventDefault();
  const rect = box.getBoundingClientRect(), step = event.shiftKey ? 30 : 10;
  place(box, rect.left + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0),
    rect.top + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0));
};
