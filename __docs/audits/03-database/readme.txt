DATABASE — CURRENT SCHEMA v2
Owner: RAB.Toolkits/world-audit/scaffolds/add-audit-db/template/schema.sql
SQLite remains local to its executing host; scaffold rejects UNC destinations.

TABLES
 audit_meta: key/value, world and date_added.
 folders: id INTEGER PRIMARY KEY, path UNIQUE, parent FK -> folders.id.
 folder: id PK/FK -> folders.id; name,title,description,type,added_by,date_added,date,settings JSON array,meta JSON object.
 runs: id,name,title,description,world,project_name,options JSON,date_start,date_end,duration_ms,status,errors JSON.
 run_folders: run_id + folder_id composite key and foreign keys.
Indexes cover parent, run date and folder links. PRAGMA user_version=2.
Exact SQL remains in the schema file; do not duplicate migrations based only on this summary.

CURRENT DETAIL STORAGE
folder.meta.ignored = true for user-ignored folders.
folder.meta.scan = { files, size, date, errors, folders? }
files is count; size is bytes; date is epoch milliseconds.
folders is populated with child DB IDs only when the detail pass has no errors.
These keys describe existing implementation; they are not a claim of finalized house-wide vocabulary.
The helper updates meta without overwriting description/title/settings.

READ MODEL
readFolderMap in audit-runner/audit-store.mjs selects latest completed folder-list run.
Only folders linked to that run are returned. Details are LEFT JOINed.
Coverage and tri-state arrays are derived from depth/options/errors, then detail scan overlays metrics.
UI hides ignored rows. API currently returns them too, with ignored=true.
New children discovered by details are stored but not linked to the latest map run; they do not automatically become API rows.

WRITE MODEL
importFolderReport requires completed report, world match, items, execution_id.
It normalizes Windows paths, maps report IDs to stable DB IDs, writes parent links and run membership transactionally.
Importing again is idempotent for run membership.
updateFolders writes each selected folder separately; bulk request is not all-or-nothing.
No schema migration was added for history. Legacy runs/run_folders remain needed for map selection.

Learn all adds branch members to the current run_folders map membership without
replacing the original root. meta.map stores folder traversal results separately
from meta.scan direct file metrics. These overlays preserve descriptions.
