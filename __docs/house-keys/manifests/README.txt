MANIFEST HOUSE KEYS
==================

A manifest describes a collection of identified items. In Box's project
inventory, each configured collection uses the same shape. Its name and
location identify the collection; the child key remains items rather than
changing to components, pages or atoms at each level.

THE SHAPE

  id, name, title, description   The collection's own identity and labels.
  settings                      Input declarations, currently [] on a manifest.
  meta                          Kind, version, collection and scan provenance.
  items                         Object keyed by each child's numeric ID as text.

Each child retains its source descriptor's identity, labels, settings and
meta, plus its project-relative path and folder kind. Each child also has
items: {} for a leaf or the source-supplied child map. A map key must equal
String(child.id); the id stored inside the record remains numeric.

STRUCTURE EXAMPLE (abbreviated; labels stand for real allocated IDs)

  collection
    id: collectionId
    name: "components"
    items:
      "<itemId>":
        id: itemId
        name: "Button"
        path: "src/components/Button"
        items: {}

The scanner records discovered folders in the collection map. Nested items
come from their source descriptors; do not infer that folder nesting alone
creates a nested manifest tree.

WHERE THE DATA COMES FROM

Source settings.json owns item identity. The scanner preserves IDs across
moves and renames; it does not manufacture IDs for bare files or folders.
indexed:false opts out the owning item without pruning its descendants.
Invalid settings, duplicate IDs or an incomplete scan preserve the prior
manifest and report the problem.

The saved location is:
  <user-home>/.rab/projects/<project>/manifests/<collection>/manifest.json

Box's memory owner resolves <project>; do not derive it from a remembered
folder convention. The current inventory writer stores meta.kind: "manifest"
and meta.version: "project-inventory/v3". meta also carries collection,
project_id, path, conditions, scanned_at and count. scanned_at is currently an
ISO string, distinct from the numeric DataKeys date fields.

Lookup reads the saved map. An unavailable or unindexed collection is not an
empty collection. Older formats need an explicitly scoped rebuild; this
documentation does not migrate saved records or start listeners.

SOURCES
  ../../../RAB.Box/tools/base/_inventory.mjs -- itemRecord and updateInventory
  ../../../RAB.Box/docs/process/project-inventory.md
  ../../../RAB.Box/bridge/rab-node.mjs -- shared item validation
