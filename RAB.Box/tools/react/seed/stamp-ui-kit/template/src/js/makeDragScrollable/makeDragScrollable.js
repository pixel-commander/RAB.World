const instances = new WeakMap();

/** Enhance a DOM element in place. No result payload; handleRemove tears it handlePointerDown. */
export function makeDragScrollable(element, options = {}) {
  if (!element || element.nodeType !== 1) return;
  instances.get(element)?.();
  const doc = element.ownerDocument;
  const win = doc.defaultView;
  const size = Number.isFinite(options.size) ? Math.max(2, options.size) : 4;
  const saved = {};
  for (const key of ['position', 'overflowY', 'scrollbarWidth']) saved[key] = element.style[key];
  const oldAttribute = element.getAttribute('data-drag-scrollable');
  const oldId = element.getAttribute('id');
  if (!element.id) element.id = `drag-scrollable-${Date.now()}`;
  element.setAttribute('data-drag-scrollable', '');
  if (win.getComputedStyle(element).position === 'static') element.style.position = 'relative';
  element.style.overflowY = 'auto';
  element.style.scrollbarWidth = 'none';
  const style = doc.createElement('style');
  style.textContent = '[data-drag-scrollable]::-webkit-scrollbar { display: none; }';
  doc.head.append(style);
  const track = doc.createElement('div');
  const thumb = doc.createElement('div');
  track.dataset.id = 'drag-scroll-track';
  thumb.dataset.id = 'drag-scroll-thumb';
  Object.assign(track.style, { position: 'absolute', width: `${size + 6}px`, touchAction: 'none', zIndex: '1' });
  Object.assign(thumb.style, { position: 'absolute', top: '0', left: '3px', width: `${size}px`, borderRadius: 'var(--radius-control, 4px)', backgroundColor: 'var(--border-strong, #596174)', cursor: 'grab' });
  thumb.tabIndex = 0;
  thumb.setAttribute('role', 'scrollbar');
  thumb.setAttribute('aria-label', options.label || 'Scroll');
  thumb.setAttribute('aria-controls', element.id);
  thumb.setAttribute('aria-orientation', 'vertical');
  thumb.setAttribute('aria-valuemin', '0');
  thumb.setAttribute('aria-valuemax', '100');
  track.append(thumb); element.append(track);
  let drag = null;
  let disposed = false;
  let frame = 0;
  const sync = () => {
    frame = 0;
    if (disposed) return;
    const range = element.scrollHeight - element.clientHeight;
    track.hidden = range <= 1 || element.clientHeight === 0;
    if (track.hidden) return;
    const height = Math.max(0, element.clientHeight - 8);
    const thumbHeight = Math.min(height * 0.9, 5 * Math.min(48, Math.max(24, height * element.clientHeight / element.scrollHeight * 0.5)));
    Object.assign(track.style, { top: `${element.scrollTop + 4}px`, left: `${element.scrollLeft + element.clientWidth - size - 6}px`, height: `${height}px` });
    thumb.style.height = `${thumbHeight}px`;
    thumb.style.transform = `translateY(${element.scrollTop / range * (height - thumbHeight)}px)`;
    thumb.setAttribute('aria-valuenow', String(Math.round(element.scrollTop / range * 100)));
  };
  const handleChange = () => { if (!frame && !disposed) frame = win.requestAnimationFrame(sync); };
  const handleMouseLeave = typeof options.handleMouseLeave === 'function' ? options.handleMouseLeave : (() => { thumb.style.backgroundColor = 'var(--border-strong, #596174)'; });
  const handleMouseEnter = typeof options.handleMouseEnter === 'function' ? options.handleMouseEnter : (() => { thumb.style.backgroundColor = 'var(--accent-secondary, #29b6ff)'; });
  const handlePointerDown = typeof options.handlePointerDown === 'function' ? options.handlePointerDown : ((event, type) => {
    if (!event) return;
    if (event.button !== 0) return;
    event.preventDefault(); event.stopPropagation();
    thumb.focus({ preventScroll: true });
    const travel = Math.max(1, track.clientHeight - thumb.offsetHeight);
    if (event.target === track) element.scrollTop = (event.clientY - track.getBoundingClientRect().top - thumb.offsetHeight / 2) / travel * (element.scrollHeight - element.clientHeight);
    drag = { id: event.pointerId, y: event.clientY, scroll: element.scrollTop };
    track.setPointerCapture(event.pointerId);
    thumb.style.backgroundColor = 'var(--accent-default, #ff2ed1)';
  });
  const handlePointerMove = typeof options.handlePointerMove === 'function' ? options.handlePointerMove : ((event, type) => {
    if (!event) return;
    if (!drag || drag.id !== event.pointerId) return;
    element.scrollTop = drag.scroll + (event.clientY - drag.y) * (element.scrollHeight - element.clientHeight) / Math.max(1, track.clientHeight - thumb.offsetHeight);
  });
  const handlePointerUp = typeof options.handlePointerUp === 'function' ? options.handlePointerUp : ((event, type) => {
    if (!event) return;
    if (!drag || drag.id !== event.pointerId) return;
    drag = null;
    if (track.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId);
    handleMouseLeave();
  });
  const handleKeyDown = typeof options.handleKeyDown === 'function' ? options.handleKeyDown : ((event, type) => {
    if (!event) return;
    const moves = { ArrowDown: 40, ArrowUp: -40, PageDown: element.clientHeight, PageUp: -element.clientHeight, Home: -element.scrollHeight, End: element.scrollHeight };
    if (!(event.key in moves)) return;
    event.preventDefault(); event.stopPropagation(); element.scrollTop += moves[event.key];
  });
  const handleFocus = typeof options.handleFocus === 'function' ? options.handleFocus : handleMouseEnter;
  const handleBlur = typeof options.handleBlur === 'function' ? options.handleBlur : handleMouseLeave;
  const handlePointerCancel = typeof options.handlePointerCancel === 'function' ? options.handlePointerCancel : handlePointerUp;
  // Native touch scrolling already supplies momentum. Mouse/pen use this gesture.
  let contentDrag = null;
  let momentum = 0;
  let suppressClick = false;
  let suppressTimer = 0;
  const handleCancel = () => {
    if (momentum) win.cancelAnimationFrame(momentum);
    momentum = 0;
  };
  const handleDragStart = (data, type) => {
    if (!data || data.defaultPrevented || data.button !== 0 || data.pointerType === 'touch' || track.contains(data.target)) return;
    if (data.target.closest?.('[data-drag-scrollable]') !== element) return;
    if (typeof options.handleDragStart === 'function' && options.handleDragStart(data, 'scroll') === false) return;
    handleCancel();
    suppressClick = false;
    win.clearTimeout(suppressTimer);
    contentDrag = { id: data.pointerId, y: data.clientY, lastY: data.clientY, scroll: element.scrollTop, time: win.performance.now(), velocity: 0, active: false, userSelect: element.style.userSelect, cursor: element.style.cursor };
  };
  const handleDrag = (data, type) => {
    if (data?.defaultPrevented) { handleClear(); return; }
    const active = contentDrag;
    if (!data || !active || active.id !== data.pointerId) return;
    if (!active.active && Math.abs(data.clientY - active.y) < 5) return;
    if (!active.active) {
      active.active = true;
      element.setPointerCapture(data.pointerId);
      element.style.userSelect = 'none';
      element.style.cursor = 'grabbing';
    }
    data.preventDefault();
    const now = win.performance.now();
    const elapsed = Math.max(1, now - active.time);
    const velocity = (active.lastY - data.clientY) / elapsed;
    active.velocity = elapsed > 100 ? velocity : active.velocity * 0.35 + velocity * 0.65;
    active.lastY = data.clientY;
    active.time = now;
    element.scrollTop = active.scroll + active.y - data.clientY;
  };
  const handleDragEnd = (data, type) => {
    const active = contentDrag;
    if (!data || !active || active.id !== data.pointerId) return;
    contentDrag = null;
    element.style.userSelect = active.userSelect;
    element.style.cursor = active.cursor;
    if (element.hasPointerCapture(data.pointerId)) element.releasePointerCapture(data.pointerId);
    if (!active.active) return;
    suppressClick = true;
    suppressTimer = win.setTimeout(() => { suppressClick = false; }, 0);
    if (data.type !== 'pointerup' || win.performance.now() - active.time > 100 || win.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let velocity = Math.max(-3, Math.min(3, active.velocity));
    let previous = win.performance.now();
    const coast = (now) => {
      if (disposed) return;
      const elapsed = Math.min(32, now - previous);
      previous = now;
      const before = element.scrollTop;
      element.scrollTop += velocity * elapsed;
      velocity *= Math.exp(-elapsed / 240);
      if (Math.abs(velocity) < 0.02 || Math.abs(element.scrollTop - before) < 0.1) { momentum = 0; return; }
      momentum = win.requestAnimationFrame(coast);
    };
    momentum = win.requestAnimationFrame(coast);
  };
  const handleClear = () => {
    handleCancel();
    const active = contentDrag;
    contentDrag = null;
    if (!active) return;
    element.style.userSelect = active.userSelect;
    element.style.cursor = active.cursor;
    if (element.hasPointerCapture(active.id)) element.releasePointerCapture(active.id);
  };
  const handleClick = (data, type) => {
    if (!suppressClick || !data) return;
    suppressClick = false;
    data.preventDefault(); data.stopImmediatePropagation();
  };
  element.addEventListener('click', handleClick, true);
  const listeners = [[element, 'dragstart', handleClear], [element, 'dragenter', handleClear], [element, 'drop', handleClear], [win, 'blur', handleClear], [element, 'pointerdown', handleDragStart], [doc, 'pointermove', handleDrag], [doc, 'pointerup', handleDragEnd], [doc, 'pointercancel', handleDragEnd], [element, 'lostpointercapture', handleDragEnd], [element, 'wheel', handleCancel], [element, 'keydown', handleCancel], [element, 'scroll', handleChange], [track, 'pointerdown', handlePointerDown], [track, 'pointermove', handlePointerMove], [track, 'pointerup', handlePointerUp], [track, 'pointercancel', handlePointerCancel], [track, 'lostpointercapture', handlePointerUp], [thumb, 'keydown', handleKeyDown], [thumb, 'pointerenter', handleMouseEnter], [thumb, 'pointerleave', handleMouseLeave], [thumb, 'focus', handleFocus], [thumb, 'blur', handleBlur]];
  listeners.forEach(([target, type, handler]) => target.addEventListener(type, handler));
  const resize = new win.ResizeObserver(handleChange);
  const observeChildren = () => { resize.disconnect(); resize.observe(element); for (const child of element.children) if (child !== track) resize.observe(child); };
  observeChildren();
  const mutation = new win.MutationObserver((records) => {
    if (!records.some(record => record.target !== track && !track.contains(record.target))) return;
    observeChildren(); handleChange();
  });
  mutation.observe(element, { childList: true, subtree: true, characterData: true, attributes: true });
  sync();
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    handleClear();
    win.clearTimeout(suppressTimer);
    element.removeEventListener('click', handleClick, true);
    if (contentDrag) {
      element.style.userSelect = contentDrag.userSelect;
      element.style.cursor = contentDrag.cursor;
      contentDrag = null;
    }
    if (frame) win.cancelAnimationFrame(frame);
    resize.disconnect(); mutation.disconnect();
    listeners.forEach(([target, type, handler]) => target.removeEventListener(type, handler));
    track.remove(); style.remove();
    Object.assign(element.style, saved);
    if (oldAttribute === null) element.removeAttribute('data-drag-scrollable'); else element.setAttribute('data-drag-scrollable', oldAttribute);
    if (oldId === null) element.removeAttribute('id');
    instances.delete(element);
  };
  instances.set(element, cleanup);

}
export function handleRemove(element) {
  if (element && typeof element === 'object') instances.get(element)?.();
}
export default makeDragScrollable;
