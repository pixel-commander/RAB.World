WORLD SEARCH
============

Search now fills missing source IDs with backups and increments shown counters
by item ID in .rab/usage/world-search.json. Actual use is reported separately
by report_search_feedback({"id": item_id}). See __docs/world-search/USAGE.txt
at the workspace root. The original no-write description below is superseded.

Created through Box's base/stamp-new-tool. Callable key: world/world-search.
Supply query and an absolute manifest_path pointing to the chosen world's
beacons/manifest.json, normally below the user's .rab/worlds/[world].
The explicit input avoids guessing which world the caller wants.

The central manifest's items array defines beacon priority. Only beacon:on
entries not marked indexed:false are searched. Each beacon path points to
its own manifest.json. Search reads these indexes, not the source tree.
Up to three manifests are searched concurrently; output follows central
beacon order and then each local items order, never completion order.

Matching is case-insensitive and requires every whitespace-separated query
term somewhere in name, title, description, kind or path. Disabled manifests
and items are excluded. Results preserve item fields and add source_beacon_id,
beacon_priority and resolved_path. Paths escaping the beacon root are rejected.
This is metadata search, not fuzzy ranking or file-content search.

Missing or invalid beacon indexes produce partial results plus errors; they
do not hide results from healthy beacons. An invalid central manifest fails.
No files are written, watchers started, or source files executed. Stale index
records remain stale until the scanner refreshes them; this tool is not the
unimplemented background watcher. Box's direct toolkit discovery remains a
separate mechanism and is not replaced by this tool.
