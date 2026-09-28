CURRENT CONTRACT UPDATE — 2026-09-27
Schema v3 is live. One folders table keyed by normalized full path; parent and
child references are paths. File inventory is a JSON files array on its folder:
[{id,name,type,size}]. No separate files table. IDs are UUID references only.
Rescans preserve a file ID when its name matches in the same folder. They do not
track moves or trigger analysis. Deeper file tracking is explicitly on demand.
API computes branch totals and type summaries from saved data; frontend formats.
Old summaries are preserved in metadata but cannot reconstruct individual names;
rerun Learn all to populate file arrays. Learn all now maps then inventories files.
Migration preserved 10765 folder records. Pre-migration SQLite backup:
C:/Users/pixelcommander/.rab/worlds/laptop/audits/audits.sqlite.before-paths-1790537152146.sqlite
Earlier numbered notes describe the v2 implementation where they conflict with
this update. Historical report/history files were not rewritten.

WORLD AUDITS â€” START HERE
Updated: 2026-09-27. This handoff describes the implemented audit system and its current behavior.

PURPOSE
Map, inspect, describe, tag, search, and eventually refactor/consolidate entire systems. Build a structural retrieval system: a broad folder map first, then intentional deeper inspection of selected branches. Preserve human/model descriptions across scans. Current slice is Map -> Inspect.

READ IN ORDER
01-locations/readme.txt â€” which machine owns code/data; how preview currently runs.
02-contracts/readme.txt â€” house conventions, identities, tri-state folders.
03-database/readme.txt â€” actual schema and current enrichment representation.
04-tools/readme.txt â€” scaffold, runner, folder-list, file-types, detail helper.
05-ui/readme.txt â€” table, selection, endpoints and actions.
06-history/readme.txt â€” append-only execution records and compatibility reports.
07-verification/readme.txt â€” checks, fixtures, safe continuation.
08-next-work/readme.txt â€” known limitations and recommended next steps.

CURRENT IMPLEMENTATION
Server-hosted source; execution and SQLite on laptop PIXEL.
WorldAudit has audit tools on the left and ViewFoldersTable in the main area.
Table shows root's immediate children; checkboxes select multiple folders.
Ignore persists a per-folder flag; Learn more scans direct contents sequentially.
Descriptions drive Described=true; scanning does not generate descriptions.
History writer is shared by runner and UI actions. Records append after execution.

IMPORTANT
Read source before changing behavior: this document may become stale.
Do not rebuild registries, change anchors, start remote services, or run a full scan just to orient.
Do not delete old reports/history as cleanup. Historical files were deliberately preserved.
No fake historical runs were added to the laptop history during tests.
