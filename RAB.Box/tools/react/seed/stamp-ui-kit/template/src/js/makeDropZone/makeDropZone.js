const instances = new WeakMap();
const resolveElement = (ref) => ref?.current ?? ref;

/** Own drop-zone events; the caller decides acceptance and what a drop does. */
export function makeDropZone(ref, props = {}) {
  const element = resolveElement(ref);
  if (!element || element.nodeType !== 1) return;
  instances.get(element)?.();
  let depth = 0;
  const oldZone = element.getAttribute('data-drop-zone');
  const oldActive = element.getAttribute('data-drop-active');
  element.setAttribute('data-drop-zone', '');
  const owns = data => data?.target?.closest?.('[data-drop-zone]') === element;
  const handleClear = () => { depth = 0; element.removeAttribute('data-drop-active'); };
  const handleDragEnter = (data, type) => {
    if (!owns(data)) return;
    depth += 1;
    props?.handleDragEnter?.(data, type);
  };
  const accepts = (data, type) => props?.handleDrag?.(data, type) !== false;
  const handleDragOver = (data, type) => {
    if (!owns(data)) return;
    if (!accepts(data, type) || props?.handleDragOver?.(data, type) === false) { element.removeAttribute('data-drop-active'); return; }
    data.preventDefault(); data.stopPropagation();
    element.setAttribute('data-drop-active', '');
  };
  const handleDragLeave = (data, type) => {
    if (!owns(data)) return;
    depth = Math.max(0, depth - 1);
    if (!depth) element.removeAttribute('data-drop-active');
    props?.handleDragLeave?.(data, type);
  };
  const handleDrop = (data, type) => {
    if (!owns(data)) return;
    handleClear();
    if (!accepts(data, type) || props?.handleDragOver?.(data, type) === false) return;
    data.preventDefault(); data.stopPropagation();
    props?.handleDrop?.(data, type);
  };
  const listeners = [['dragenter', handleDragEnter], ['dragover', handleDragOver], ['dragleave', handleDragLeave], ['drop', handleDrop]];
  listeners.forEach(([name, handler]) => element.addEventListener(name, handler));
  element.ownerDocument.addEventListener('dragend', handleClear);
  instances.set(element, () => {
    listeners.forEach(([name, handler]) => element.removeEventListener(name, handler));
    element.ownerDocument.removeEventListener('dragend', handleClear);
    if (oldZone === null) element.removeAttribute('data-drop-zone'); else element.setAttribute('data-drop-zone', oldZone);
    if (oldActive === null) element.removeAttribute('data-drop-active'); else element.setAttribute('data-drop-active', oldActive);
    instances.delete(element);
  });
}
export function handleRemove(ref) {
  const element = resolveElement(ref);
  if (element && typeof element === 'object') instances.get(element)?.();
}
export default makeDropZone;
