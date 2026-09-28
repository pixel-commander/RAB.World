CONTRACTS AND DECISIONS
Read RAB.React/RULES.txt before UI edits; source-specific rules outrank general assumptions.
Reuse HouseKeys vocabulary. Components own structure; atoms own skin. Keep mutable state in its owning hook. Preserve props bags and supplied false/zero/empty strings. Do not add arbitrary DOM data attributes; registered grid/area attributes are intentional.

FOLDER IDENTITY
folders = broad map: id, path, parent.
folder = optional enrichment: same id references folders.id.
LEFT JOIN folder ON folder.id=folders.id keeps undescribed folders visible.
Top-level folders are children of the root record (C:\), NOT rows with parent=null.
The root itself has parent=null.
Descriptions belong to enrichment and survive scans.
Described is derived from nonblank description; it is not a stored flag.

TRI-STATE folders ON API RECORDS
Missing/undefined: not successfully scanned for children.
[]: scanned, no child folders found.
[id, id]: scanned with child folders.
JSON omits undefined. Never default unknown to [] or show unknown as zero.
folders holds immediate children, not every descendant in depth order.
The database stores relationships with parent; arrays are projections/snapshots.

IDENTITY CAVEAT
folder-list report IDs use shared Box allocation.
SQLite importer uses local integer primary keys and normalizes Windows paths to reuse them.
These are distinct ID spaces today; do not interchange report IDs and DB IDs.
UI selection and history options.ids use DB IDs.

COUNTS
Current detail counts are direct files/children, not recursive totals.
Size = logical sum of direct regular-file bytes, not allocated disk space.
Partial scans carry errors; zero during a failed scan is not proof of emptiness.
