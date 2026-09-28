WORLD AUDIT UI
Sources in RAB.React:
src/pages/WorldAudit/WorldAudit.tsx
src/pages/WorldAudit/WorldAudit.types.ts
src/pages/WorldAudit/hooks/useDashboard.ts
src/pages/WorldAudit/css/world-audit.css
server/audit-map.mjs; server/audit-tools.mjs; vite.config.mjs

LAYOUT
Root header-main grid; header container-machine contains disabled search placeholder.
Main side-left grid: audit tool forms left/container-metal; folder table main/container-cell.
scroll-y lives inside a grid cell, not on the grid cell itself.
Previous tree/inspector columns removed.
ViewFoldersTable is an exported component in WorldAudit.tsx, not a separate component folder.

TABLE
Checkbox | Name | Path | ID | Folders | Files | Size | Last scan | Described.
Top-level children only; text filter/name-path sort.
Row name click changes #folder=<DB ID>; checkbox selection is separate local state.
Select-all affects visible rows, includes indeterminate state; hidden checked rows remain selected.
Ignore/Learn more operate on checked IDs; clear selection available.
Successful action refreshes returned data and clears checked IDs.
Unknown metrics display dash. Size displayed in bytes; errorful scans marked partial.

ENDPOINTS
GET /api/audit-tools?path=... discovers settings under allowed server Toolkits root.
Tool forms are currently scaffolds, do not execute on submission.
GET /api/audit-map returns latest map plus details for laptop world only.
POST /api/audit-map JSON {ids:[2,3],action:'details'|'ignore'} runs the bulk action.
Server validates IDs/actions/body size/content type, checks supplied Origin, prevents overlapping actions in this server process.
Not a production authentication boundary; current preview binds 127.0.0.1.
POST records history through trackExecution. Read requests do not log runs.
The DB path is currently hardcoded from executing user's home and world 'laptop'.

Learn all button: POST action 'learn-all'; recursively maps checked branches.
Table remains top-level, while descendants are returned in the map API and stored in SQLite.
Learn more retains direct file-count/size behavior. No automatic deep scan on page load.

JOB PANEL (2026-09-27)
Learn more/Learn all now enqueue instead of executing immediately.
Right panel shows pending/running/completed/partial/failed jobs and elapsed time.
Run jobs drains sequentially; pending rows can be removed. Duplicate pending/running
jobs of the same folder/action are suppressed. Failed jobs do not stop later jobs.
GET /api/audit-jobs returns queue; POST action details/learn-all enqueues ids,
run starts the queue, remove with id removes a pending job.
The browser polls once per second; direct scans show files/bytes/current path,
recursive folder maps show folders visited/current path. No guessed percentages.
Queue is owned by server/audit-jobs.mjs in memory: survives browser refresh,
but not server restart. Completed tool execution history remains on disk.
Ignore remains immediate and is blocked while queue runs.
