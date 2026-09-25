makeDragScrollable(element, options)
===================================
Enhances the element in place: a narrow custom scrollbar plus background
mouse/pen drag scrolling with momentum. Touch uses native scrolling.
No result payload. handleRemove(element) detaches and restores owned styles.

Interaction ownership:
- Only the nearest enhanced scroll area handles a content gesture.
- The caller decides which targets allow dragging through handleDragStart.
  The helper does not hardcode controls, tiles, or reorder selectors.
- options.handleDragStart(data, type) receives the pointer event and 'scroll';
  return false when a caller's drag/reorder/drop system owns that gesture.
- defaultPrevented yields ownership; native dragstart/dragenter/drop cancel
  content scrolling. This helper does not prevent dragover/drop.
- A five-pixel threshold separates clicks from background scrolling.
- Wheel input and keyboard input stop momentum. Reduced motion disables coasting.

Example:
makeDragScrollable(element, {
  size: 4,
  handleDragStart: (data, type) => !reorderIsActive
});

Pointer-based reorder systems must use the guard and can check their own
data-scroll-drag="off" marker in that guard. The helper does not guess their private state.
