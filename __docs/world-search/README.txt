WORLD SEARCH - DETAILS, FUNCTIONS AND LOGIC
==========================================

USAGE UPDATE: read USAGE.txt beside this file for current ID maintenance and
shown/used counters. Search now writes counters and repairs missing source IDs
with backups; earlier read-only statements below describe the original version.

PURPOSE AND OWNER
-----------------
World Search searches existing beacon indexes. It does not scan source
folders, create indexes, start a watcher, or execute the items it finds.

Implementation owner:
  RAB.Toolkits/rab-world/tools/world/world-search/world-search.mjs
Input definitions and tool identity live in the adjacent settings.json.
The adjacent contract.json and README.txt describe the callable contract.
The tool was created using Box's base/stamp-new-tool, then implemented.
Use those source files as authority rather than treating this document as
a second tool registry.

Callable Box key: world/world-search
Authority: read

INPUTS AND CALLING
------------------
query
  Required nonempty text. Example: react scaffold

manifest_path
  Required absolute path to the selected world's beacon manifest.json.
  Normally: [user home]/.rab/worlds/[world]/beacons/manifest.json
  This location is explicit, not inferred or restricted to .rab. No world
  is silently selected and no search across all world registries occurs.

Through Box's Tool House:
  house.runTool({
    key: 'world/world-search',
    options: {
      query: 'react scaffold',
      manifest_path: 'C:/Users/gauge/.rab/worlds/example/beacons/manifest.json'
    }
  })

The example path must be replaced with an existing world manifest.
Box wraps the search payload in its usual execution result under result.

Directly through the World Hands MCP connection (preferred):
  search_world({"query":"react scaffold"})

The connection supplies manifest_path from RAB_WORLD_BEACON_MANIFEST,
configured once by the host. No tool-list request or path lookup is needed.
This direct action returns the search payload as JSON text, without a Box
execution envelope. See ../world-hands/README.txt for connection setup,
registry lookup and array-based beacon manifest retrieval.

Through the generic World Hands dispatcher (explicit-path workflow):
  Call list_world_hands to discover current inputs and available keys.
  Then call invoke_world_hand with:
  {
    "key": "world/world-search",
    "options": {
      "query": "react scaffold",
      "manifest_path": "C:/Users/gauge/.rab/worlds/example/beacons/manifest.json"
    }
  }
No writing confirmation is required for this read-authority hand. The MCP
adapter returns its normal tool/result/execution envelope as JSON text.

INDEX RELATIONSHIP
------------------
Central beacon manifest
  items[] contains beacon records in search-priority order.
  Each enabled record's absolute path identifies a beacon folder.

Beacon folder/manifest.json
  items[] contains that folder's indexed records, including searchable
  metadata and paths. Search does not reread their settings.json files.

Both manifests must have version: "manifest/v1" and an items array.
The central manifest directs search; it does not duplicate all local items.
The current reader validates this shape, not every House Key or ID.

SEARCH LOGIC
------------
1. Validate query and the absolute central manifest path.
2. Read the central manifest and split the trimmed, lowercased query into
   whitespace-separated terms.
3. Assign each beacon its original array position plus one as priority.
4. Keep only records with beacon exactly "on" and indexed not false.
   Missing state, "off", and any other state are excluded. Disabled entries
   leave gaps in priority numbers; the original ordering is preserved.
5. Start at most three asynchronous workers. Each takes the next enabled
   beacon from the queue. More than three beacons are queued, not dropped.
6. Require an absolute beacon path, resolve its real filesystem location,
   and read manifest.json there. Skip a local manifest marked indexed:false.
7. Skip null/non-object items and items marked indexed:false. Combine string
   values from name, title, description, kind and path into lowercase text.
8. Match when EVERY query term occurs somewhere in that combined text.
   Matching is substring-based, case-insensitive and independent of term
   order. It is not phrase matching, fuzzy matching, semantic search, or
   relevance scoring. Non-string field values are not searched.
9. For each matching item, require a nonempty path and resolve it against
   the beacon root. Reject paths lexically outside that root. Relative paths
   are normal; absolute paths are accepted only when inside the root.
10. Preserve the item's fields and add source_beacon_id, beacon_priority,
    and resolved_path. These provenance fields describe this search result.
11. Wait for all workers, then flatten results in central beacon order and
    original local item order. Completion speed never changes priority.

Search processes all enabled beacons. There is no first-hit stop, global
limit, pagination, cross-beacon deduplication, or persistent search cache.
Parallelism is overlapping asynchronous filesystem reads, not separate
processes or CPU worker threads. Matching within each manifest is sequential.

FUNCTIONS
---------
run({ options }) - exported tool entry point
  Validates inputs, chooses enabled beacons, coordinates workers, assembles
  the result, and reports per-beacon errors. This is what Box invokes.

readManifest(file) - exported shared reader
  Uses lstat to require a regular, non-symlink manifest file no larger than
  8 MiB. Reads/parses JSON and requires manifest/v1 plus an items array.

inside(root, target) - private helper
  Uses path.relative to reject parent traversal and paths on another root.
  This is a lexical containment check, not a filesystem sandbox.

worker() - private function inside run
  Claims queue positions, reads each beacon index, matches items, records
  errors, and puts results into their assigned priority slots.

OUTPUT AND ERRORS
-----------------
The search payload contains:
  status         "completed" or "partial"
  query          original input query
  manifest_path  original central manifest path
  items          ordered matching records with source provenance
  errors         ordered diagnostics with beacon ID, path and priority

"completed" can mean no matches or no enabled beacons. An empty successful
search returns items: [] and errors: [].

Invalid inputs or an unreadable/invalid central manifest throw an error:
search cannot proceed without its directory of beacons.

A missing beacon folder, unreadable/malformed local manifest, or invalid
matching item path adds an error while healthy beacon results are retained.
Any such error makes status "partial". Filesystem error codes are preserved
where available; other beacon-level errors use BAD_MANIFEST. Item-path
diagnostics carry a message and item ID where supplied.

CURRENT BOUNDARIES AND UNFINISHED CONNECTIONS
-------------------------------------------
Search is read-only. Box's surrounding runner can still allocate execution
identity and perform its normal tracking; that is separate from index writes.

Search trusts the indexed metadata. It does not verify that each result
still exists, resolve symlinks in item paths, or check for changed settings.
The resolved_path field is a location, not permission to execute or modify it.
Index refreshes occurring during a search are not one atomic global snapshot.

The intended watcher detects source changes and asks the scanner to refresh
manifests. That persistent watching is not implemented by World Search.
The current scanner skips off beacons instead of retaining off registrations.
Box's direct toolkit discovery is separate from beacon-based search; creating
this tool does not automatically index every React scaffold or replace Box's
existing discovery mechanism.

VERIFICATION
------------
From RAB.Box:
  node --test tests/world-search.test.mjs tests/world-hands-mcp.test.mjs

Search tests cover priority order, disabled entries, missing indexes,
case-insensitive matching, escaping paths, empty queries and empty registries.
MCP tests exercise direct registry reads, array-based manifest retrieval,
direct search, transport discovery and invocation boundaries. They read the
local server-world registry and require that configuration and toolkit link.
Search fixtures are created below .rab/tests and removed after the test.
These checks do not prove a persistent watcher or live index refresh exists.
