RRAABBIITT TOOL HOUSE
=====================

`tools/` is the active house-key registry.

PUBLIC TOOL LAW
---------------
Any folder under tools/ becomes a public Tool when it owns settings.json.
Depth is semantic and unrestricted:

  tools/react/count/hooks/use-effect/settings.json

The scanner derives:

  path = react/count/hooks/use-effect
  tags = [react, count, hooks, use-effect]

Universal settings.json:
  { id, name, title, description, settings, meta }

`id`       permanent identity; never regenerate merely because a Tool moved
`name`     current leaf folder name
`settings` run-form inputs only
`meta`     additional capability information

PATH TAG LAW
------------
Path tags are inherited truth. `meta` may add meaning but may not contradict meaning
already stated by the path.

EXECUTOR LAW
------------
A public leaf can own `<leaf>.mjs` or inherit the nearest parent `<folder>.mjs`.

Example:
  react/count/count.mjs
  react/count/hooks/state-hooks/settings.json
  react/count/hooks/use-effect/settings.json

Both leaves execute count.mjs.

A .mjs file with no sibling/public settings.json is implementation machinery, not a
public Tool.

STAMP LAW
---------
A public Tool containing `template/` has the internal Stamp kind.
Its public leaf name is semantic; a `stamp-` prefix is not required.
A `stamp-*` public leaf MUST own template/.

`template/` is the mold. It may eventually be as large as a complete component system or
project. Manufactured output does not need to carry the Tool House runtime.

NAMING
------
Deep paths can carry operation meaning without repeating it in the leaf:

  react/count/hooks/use-effect
  react/find/hooks/use-effect

Flat legacy Tools may still use functional leaf names while migration continues.

DOMAIN LAW
----------
`base/` is shared house plumbing. Other first-level folders are direct discovery
boundaries. A request in audit mode searches base + audit; it does not directly leak
React keys. Explicit composition/delegation may cross domains.

INTERNAL HELPERS
----------------
Internal files/folders may exist anywhere without settings.json. They are not public
Tools. `template/`, node_modules, .git and .rab subtrees are excluded from Tool discovery.
