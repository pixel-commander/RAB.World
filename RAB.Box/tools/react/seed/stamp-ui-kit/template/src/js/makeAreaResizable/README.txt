makeAreaResizable(ref, type)
=============================
makeAreaResizable(element); // column: trailing handle sets inline width
makeAreaResizable(element, 'bottom');  // bottom handle sets inline height

Edges: left, right, top, bottom. Default: right. Left/top reverse drag direction.

Accepts a DOM element or a ref with .current. Missing elements are ignored.
Creates its own handle. Uses house handlePointerDown/handleDrag/handlePointerMove,
handlePointerUp/handlePointerCancel, handleChange, handleKeyDown and focus handlers.
Pointer capture keeps dragging working outside the handle. Arrow keys resize;
Shift + arrow makes a one-pixel adjustment. Existing CSS min/max sizing applies.
Call handleRemove(ref) to detach. The last inline size is retained.
Repeated initialization replaces the existing handle and listeners.
No React dependency and no returned data.

The element becomes a two-track grid. Its existing children are moved into
area-resizable__content; the handle occupies the other, 5px track.
Right/bottom: auto 5px. Left/top: 5px auto.
Global styles in src/css/global.css own the track layout, handle color and hover.
Cleanup unwraps the original content and removes the handle and listeners.
