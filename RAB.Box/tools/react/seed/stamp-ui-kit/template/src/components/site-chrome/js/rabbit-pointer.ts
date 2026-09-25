import type { MouseEvent } from 'react';
import type { HandlerKey } from '../../../HouseKeys.types.ts';

const send = (event: MouseEvent<HTMLElement>, reset = false) => {
  const frame = event.currentTarget.querySelector<HTMLIFrameElement>('[data-id="rabbit-background"]');
  if (!frame?.contentWindow) return;
  const box = frame.getBoundingClientRect();
  if (box.width <= 0 || box.height <= 0) return;
  const clamp = (value: number) => Math.max(-0.5, Math.min(0.5, value));
  frame.contentWindow.postMessage({
    rabbitPointer: {
      active: !reset && event.clientX >= box.left && event.clientX <= box.right &&
        event.clientY >= box.top && event.clientY <= box.bottom,
      x: reset ? 0 : clamp((event.clientX - box.left) / box.width - 0.5),
      y: reset ? 0 : clamp((event.clientY - box.top) / box.height - 0.5),
    },
  }, window.location.origin);
};

export const handleMouseMove: HandlerKey<MouseEvent<HTMLElement>, string, void> = (event) => {
  if (event) send(event);
};
export const handleMouseLeave: HandlerKey<MouseEvent<HTMLElement>, string, void> = (event) => {
  if (event) send(event, true);
};
