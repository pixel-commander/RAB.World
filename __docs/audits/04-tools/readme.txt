TOOLS AND ENTRY POINTS
All paths below are under RAB.Toolkits/world-audit unless stated otherwise.

scaffolds/add-audit-db/add-audit-db.mjs
run({options:{world,path?},context:{rab_home?}})
path is destination DIRECTORY, filename is audits.sqlite.
Requires existing world settings. Creates schema v2 or checks exact existing schema/world/integrity without overwriting it. No automatic migrations.

find-and-list/folder-list/folder-list.mjs
run({options:{path,world,recursive?,max_depth?,exclude?,save_file?},context:{rab_home}})
path is required. recursive defaults false. Root depth 0, immediate children depth 1.
Nonrecursive honors max_depth capped at 1. Recursive omitted max_depth is unlimited.
Breadth-first directory reads; no symlink/junction descent. Read failures and skipped paths recorded.
Default exclusions from its settings.json:
C:\Program Files (x86), C:\Program Files, C:\Users, C:\ProgramData,
C:\Recovery, C:\Windows, C:\$Recycle.Bin, C:\System Volume Information.
Explicit exclude=[] overrides those defaults, but persisted DB ignored paths are added independently.
Ignored paths come from the selected world's audits.sqlite if available.
Report items use {id,parent_id,type:'folder',path}; importer translates parent_id to DB parent.
Runtime still imports RAB.Box/bridge/rab-memory.mjs for ID allocation. It is NOT yet completely standalone.

find-and-list/file-types/file-types.mjs
Required path/world/types. types accepts extensions (.tsx,.css) as comma-separated text or array; normalized and matched case-insensitively. Direct files only. No recursive details or shared persisted ignore policy yet.

AUDIT RUNNER
audit-runner/audit-runner.mjs exports run({options,context}).
Required world and audit_type; project_name optional; path, save_path and options supported.
Discover matching signal-enabled tool settings, merge defaults without losing false, return input-required plus missing field definitions when needed.
This does not itself display an interactive prompt.
Executor path constrained to the tool folder. Tool names must resolve unambiguously.
Runner now defaults report output to world/audits/report.json and appends world/audits/history.jsonl.
Standalone tools still have older tool-name/report.json defaults when invoked directly; runner supplies save_file to override them.

DETAILS / IGNORE
Currently updateFolders(dbFile,ids,action) in audit-runner/audit-store.mjs.
UI endpoint calls this through trackExecution, NOT through registered-tool discovery.
folder-details and folder-ignore are history action names, not newly registered standalone tool packages.
Details sequentially reads direct entries, skips symlinks, stats regular files, stores counts/size/date/errors and child IDs.
Ignore stores meta.ignored=true. No unignore UI yet.

LEARN ALL (added 2026-09-27)
learnAll(dbFile,ids) uses the existing audit runner and folder-list with recursive:true.
Persisted ignored paths and tool default exclusions apply; links are not followed.
Overlapping selected descendants are removed from the work list.
mergeFolderBranch preserves the selected root's parent, stable IDs and enrichment,
adds discovered members to the current map, and stores meta.map {date,errors,folders?}.
Missing branches are not deleted from historical storage. A successful scan's folders
array describes its latest discovered direct children.
Learn all maps folders only; it does not recursively calculate file sizes or descriptions.
Each branch tool execution and outer Learn all action records history.

QUEUE UPDATE (2026-09-27)
folder-details/folder-details.mjs is now a registered stamped tool, with settings.json
and original stamp-receipt.json. It accepts world/ids and calls updateFolders.
Queued Learn more now runs through audit-runner. Learn all uses folder-list through
the same runner. Earlier notes about the unregistered helper describe the prior wiring.
Progress callbacks travel in context.onProgress; they are not serialized into history.

TOOL / RUNNER SEPARATION UPDATE
folder-file-counts is a stamped standalone operation. run({options:{path,
recursive:false,exclude:[]},context:{onProgress}}) returns {path,items,errors}.
Each item has path, files:[{type,count,size}], folders (direct paths), size, errors.
recursive:true applies the operation to descendants. No-extension type is empty string;
extensions are lowercase; symbolic links are skipped. No DB/world/save path is required.
The operation returns data; it does not write a report or database.
folder-details remains the database adapter and reuses this operation.

runBatch in audit-runner owns batch execution, timing, status and saveRun reporter calls.
The queue schedules jobs and displays their progress. Missing fields pause a batch with
input-required; job panel accepts inputs and returns that job to pending for Run jobs.
Existing folder-list/file-types retain their legacy report persistence; the new pure
operation does not imply every older tool has been migrated.

Checks: work/test-count-tool.mjs covers direct/recursive counts, extension casing,
no-extension files, exclusions and missing-input pause. Queue/details/typecheck/build
checks were rerun successfully after extraction.
