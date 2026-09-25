useClickOutside
===============

PURPOSE
  Calls a house handler when pointerdown lands outside one owned DOM root.

SHAPE
  const rootRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = () => {
    rootRef.current?.classList.remove('is-open');
  };

  useClickOutside(rootRef, handleClickOutside);

CONTRACT
  useClickOutside(rootRef?, handleClickOutside?)
  handleClickOutside(event?, 'outside')

  Both inputs may be absent. A missing root, missing handler, non-Node target,
  or pointerdown inside the root is a no-op.

HOUSE FIT
  - The caller supplies its one owned DOM ref.
  - Visibility changes through the DOM; no visibility state hook.
  - The hook keeps one stable document listener. Its internal non-DOM ref owns
    the latest handler lifetime and prevents listener churn across renders.
  - pointerdown covers mouse and touch and runs before click.
  - Cleanup always removes the document listener.
