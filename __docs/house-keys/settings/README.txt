SETTINGS HOUSE KEYS
==================

Settings describe an identified item and the inputs its owner accepts. The
shared Box item descriptor uses the following vocabulary; this contract is
implemented in rab-node.mjs, not exported as a SettingsKeys type from the
root HouseKeys.types.ts.

  id             Positive numeric identity, retained when an item moves.
  name           Stable short name; a public tool uses its leaf folder name.
  title          Nonblank display label.
  description    String explaining the item; an empty string is permitted.
  settings       Array of input declarations; [] means no declared inputs.
  meta           Object containing owner-specific metadata.
  indexed        Optional boolean; absent defaults to true for item indexing.

Every input declaration has name and type. If required is supplied it must
be boolean, and declaration names must be unique. Further fields and allowed
type names come from the consuming tool's input contract. The settings array
describes inputs; it is not the values supplied for one execution.

EXAMPLE: ITEM DESCRIPTOR

  {
    "id": 1790029669459,
    "name": "react",
    "title": "React UI Toolkit",
    "description": "Tools for React UI work.",
    "settings": [],
    "meta": { "kind": "toolkit", "project_type": "react" }
  }

This uses the existing React toolkit identity as an illustration. A new item
receives a new identity from the owner's shared allocator; never copy this ID.
An item descriptor is not automatically a runtime node. Box nodes add their
own version, role and parent rules, described in ../project/rab-box/README.txt.

DEFAULTS AND OWNERSHIP

Keep supplied valid false, zero and empty-string values. Default only absent
keys; do not merge with value || fallback. Validate malformed supplied values
rather than silently changing their meaning. indexed:false excludes that
item from inventory; it does not hide its descendants or stop the listener.

An owner's settings.json describes that item. Registered project paths are
resolved from saved project settings by the Box memory owner. Neither a
copied template nor a README replaces that current configuration.

SOURCES
  ../../../RAB.Box/bridge/rab-node.mjs -- assertItemSettings, makeItemSettings
  ../../../RAB.Box/docs/process/project-inventory.md
  ../../../RAB.Toolkits/rab-react-kit/settings.json
  ../../../RAB.Toolkits/rab-react-kit/RULES.txt
