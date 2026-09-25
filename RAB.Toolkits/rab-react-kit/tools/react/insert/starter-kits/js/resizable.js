// resizable.js — makeResizable(el, opts): turns any container into a
// resizable div. Drag the t/r/b/l edge or corner handles; the element sets
// its own inline-size / block-size inline while dragging. Global by design:
// also rides window.makeResizable.

const AXES = {
  t: { block: -1 },
  b: { block: 1 },
  l: { inline: -1 },
  r: { inline: 1 },
  tl: { block: -1, inline: -1 },
  tr: { block: -1, inline: 1 },
  bl: { block: 1, inline: -1 },
  br: { block: 1, inline: 1 },
};

export const makeResizable = (el, opts = {}) => {
  const {
    handles = ['t', 'r', 'b', 'l', 'tl', 'tr', 'bl', 'br'],
    minInline = 160,
    minBlock = 100,
    onResize,
  } = opts;

  if (getComputedStyle(el).position === 'static') {
    el.style.position = 'relative';
  }
  el.classList.add('resizable');

  const spans = handles.map((name) => {
    const axis = AXES[name];
    const handle = document.createElement('span');
    handle.className = `resizable__handle resizable__handle--${name}`;
    handle.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      handle.setPointerCapture(event.pointerId); // the drag survives leaving the handle
      const rect = el.getBoundingClientRect();
      const from = { x: event.clientX, y: event.clientY, w: rect.width, h: rect.height, left: rect.left, top: rect.top };
      // a floating element resizes FROM the grabbed edge: t/l drags move
      // the origin so the opposite edge holds still (in-flow elements
      // stay put — the flow owns their origin)
      const floating = ['fixed', 'absolute'].includes(getComputedStyle(el).position);
      const move = (drag) => {
        if (axis.inline) {
          const next = Math.max(minInline, from.w + (drag.clientX - from.x) * axis.inline);
          if (floating && axis.inline < 0) {
            el.style.insetInlineStart = `${from.left + (from.w - next)}px`;
            el.style.insetInlineEnd = 'auto';
          }
          el.style.inlineSize = `${next}px`;
        }
        if (axis.block) {
          const next = Math.max(minBlock, from.h + (drag.clientY - from.y) * axis.block);
          if (floating && axis.block < 0) {
            el.style.insetBlockStart = `${from.top + (from.h - next)}px`;
            el.style.insetBlockEnd = 'auto';
          }
          el.style.blockSize = `${next}px`;
        }
        if (onResize) onResize(el);
      };
      const stop = () => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', stop);
        handle.removeEventListener('pointercancel', stop);
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', stop);
      handle.addEventListener('pointercancel', stop);
    });
    el.append(handle);
    return handle;
  });

  return {
    destroy: () => {
      spans.forEach((handle) => handle.remove());
      el.classList.remove('resizable');
    },
  };
};

window.makeResizable = makeResizable;
