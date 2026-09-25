const instances = new WeakMap();
const resolveElement = (ref) => ref?.current ?? ref;

/** The chosen edge controls the handle position, dimension, and direction. */
export function makeAreaResizable(ref, type = 'right') {
  const element = resolveElement(ref);
  if (!element || element.nodeType !== 1) return;
  if (!['left', 'right', 'top', 'bottom'].includes(type)) return;
  instances.get(element)?.();
  const row = type === 'top' || type === 'bottom';
  const direction = type === 'left' || type === 'top' ? -1 : 1;
  const property = row ? 'height' : 'width';
  const doc = element.ownerDocument;
  const win = doc.defaultView;
  const originalEdge = element.getAttribute('data-resize-edge');
  element.setAttribute('data-resize-edge', type);
  const content = doc.createElement('div');
  content.className = 'area-resizable__content';
  while (element.firstChild) content.append(element.firstChild);
  element.append(content);
  const handle = doc.createElement('div');
  handle.dataset.id = 'area-resize-handle';
  handle.setAttribute('role', 'separator');
  handle.setAttribute('aria-orientation', row ? 'horizontal' : 'vertical');
  handle.setAttribute('aria-label', `Resize from ${type}`);
  handle.tabIndex = 0;
  handle.className = 'area-resizable__handle';
  element.append(handle);
  let gesture = null;
  let disposed = false;
  const metrics = () => {
    const style = win.getComputedStyle(element);
    const extras = row
      ? parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth)
      : parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
    return { style, extras: Number.isFinite(extras) ? extras : 0 };
  };
  const handleChange = (size) => {
    if (!Number.isFinite(size)) return;
    element.style[property] = `${Math.max(0, size)}px`;
    handle.setAttribute('aria-valuenow', String(Math.round(row ? element.getBoundingClientRect().height : element.getBoundingClientRect().width)));
  };
  const currentSize = () => {
    const { style, extras } = metrics();
    const rect = element.getBoundingClientRect();
    return (row ? rect.height : rect.width) - (style.boxSizing === 'border-box' ? 0 : extras);
  };
  const handlePointerDown = (data, type) => {
    if (!data || data.button !== 0 || gesture) return;
    data.preventDefault(); data.stopPropagation();
    gesture = { id: data.pointerId, position: row ? data.clientY : data.clientX, size: currentSize() };
    handle.focus({ preventScroll: true });
    handle.setPointerCapture(data.pointerId);
    handle.setAttribute('data-dragging', '');
  };
  const handleDrag = (data, type) => {
    if (!data || !gesture || gesture.id !== data.pointerId) return;
    handleChange(gesture.size + ((row ? data.clientY : data.clientX) - gesture.position) * direction);
  };
  const handlePointerMove = handleDrag;
  const handlePointerUp = (data, type) => {
    if (!data || !gesture || gesture.id !== data.pointerId) return;
    gesture = null;
    if (handle.hasPointerCapture(data.pointerId)) handle.releasePointerCapture(data.pointerId);
    handle.removeAttribute('data-dragging');
  };
  const handlePointerCancel = handlePointerUp;
  const handleKeyDown = (data, type) => {
    if (!data) return;
    const decrease = row ? 'ArrowUp' : 'ArrowLeft';
    const increase = row ? 'ArrowDown' : 'ArrowRight';
    if (data.key !== decrease && data.key !== increase) return;
    data.preventDefault(); data.stopPropagation();
    handleChange(currentSize() + (data.key === increase ? 1 : -1) * direction * (data.shiftKey ? 1 : 10));
  };
  const listeners = [['pointerdown', handlePointerDown], ['pointermove', handlePointerMove], ['pointerup', handlePointerUp], ['pointercancel', handlePointerCancel], ['lostpointercapture', handlePointerUp], ['keydown', handleKeyDown]];
  listeners.forEach(([name, handler]) => handle.addEventListener(name, handler));
  handle.setAttribute('aria-valuenow', String(Math.round(row ? element.getBoundingClientRect().height : element.getBoundingClientRect().width)));
  instances.set(element, () => {
    if (disposed) return;
    disposed = true;
    listeners.forEach(([name, handler]) => handle.removeEventListener(name, handler));
    handle.remove();
    while (content.firstChild) element.insertBefore(content.firstChild, content);
    content.remove();
    if (originalEdge === null) element.removeAttribute('data-resize-edge');
    else element.setAttribute('data-resize-edge', originalEdge);
    instances.delete(element);
  });
}

/** Remove the enhancement; retain the size chosen by the user. */
export function handleRemove(ref) {
  const element = resolveElement(ref);
  if (element && typeof element === 'object') instances.get(element)?.();
}
export default makeAreaResizable;
