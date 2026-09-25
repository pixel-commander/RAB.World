WORLD HANDS - DIRECT MCP ACTIONS
===============================

USAGE UPDATE: search_world now maintains missing item IDs and shown counters.
report_search_feedback takes {"id": numeric_item_id} to increment used.
See ../world-search/USAGE.txt. Earlier read-only statements here now apply
only to manifest retrieval, not search. No query or event history is stored.

PURPOSE
-------
World Hands makes common world requests directly callable. The model does
not need to list tools, find a file path, or construct a generic invocation
before reading the configured world's registry or searching its indexes.

Box owns the MCP transport at RAB.Box/bridge/world-hands.mjs. Toolkit-owned
index reads live in RAB.Toolkits/rab-world/tools/world/world-hands/indexes.mjs.
Search reuses world/world-search; there is no second search implementation.
The MCP tools/list response is the authoritative available action catalog.

CONFIGURE ONCE
--------------
The MCP host launches the Box entry point with Node over stdio. It passes
RAB_WORLD_BEACON_MANIFEST as an absolute path to the chosen central manifest.
On this machine the configured value is:
  C:\Users\gauge\.rab\worlds\server\beacons\manifest.json

The source entry point on this machine is:
  L:\RAB.World\RAB.Box\bridge\world-hands.mjs

These are machine-specific configuration values, not portable defaults.
There is no implicit world selection when the variable is missing. Configure
the desired path in the host, then reconnect. Reconnect after action/schema
changes too; an existing conversation may retain its old tool catalog.
The host owns process lifetime. No HTTP port or continuous AI loop is needed.

DIRECT REQUESTS
---------------
To see the configured world's beacon registry:
  get_world_beacons({})

This returns the full central manifest, including items in their stored
priority order, paths and on/off state. It does not filter disabled entries.

To inspect one beacon's index, still pass an array:
  get_beacon_manifests({"beacons":["actions"]})

To inspect several:
  get_beacon_manifests({"beacons":["actions","containers","effects"]})

Each selector is an exact beacon name or positive numeric ID. Names must
resolve uniquely; use an ID when names are ambiguous. Arbitrary folder paths
are not accepted. The action reads only selections registered in this world.
Disabled beacons can be inspected explicitly; inspection is not search.

The response is always an array in REQUEST order, even for one selection:
  [
    {"beacon": {"...": "full registered beacon"},
     "manifest": {"...": "full local manifest"}},
    {"requested": "missing-name",
     "error": {"code": "BEACON_ERROR", "message": "..."}}
  ]
This abbreviated response illustrates structure, not literal stored records.

An empty beacons array returns an empty array after validating the registry.
The input permits up to 100 selectors. At most three local manifest reads
run concurrently; extra requests queue. Repeated selectors remain repeated.
One missing or invalid beacon does not discard other successful results.
An unreadable central registry or malformed request fails the whole call.
MCP replies carry the JSON payload in content text. Whole-call failures set
isError; individual array-entry errors stay inside the successful batch reply.

To search without supplying a registry path:
  search_world({"query":"container metal"})

Search reads enabled beacon indexes with at most three concurrent workers.
Unlike explicit retrieval, search output follows REGISTRY priority order,
then local item order. Matching and error details live in:
  ../world-search/README.txt

FUNCTIONS AND LOGIC
-------------------
getWorldBeacons(manifestPath) validates the configured absolute location and
uses the shared readManifest reader to return the central registry.

getBeaconManifests(manifestPath, beacons) reads the registry once, resolves
each selector, reads each selected folder's manifest.json, and stores results
in their original request slots. Individual errors occupy those same slots.

The adapter validates MCP input and routes these direct read actions before
generic Box tool discovery. search_world calls the existing search entry
point with the configured path. These direct reads neither write execution
records nor run a source-tree scan. They read current disk indexes each call;
"ready" means callable, not a permanently cached copy of all manifest data.

The generic list_world_hands and invoke_world_hand actions remain available
for other toolkit tasks. They use Box discovery and its execution runner.
Non-read generic invocations require confirm:true after user authorization.
This assertion is not authentication or an independent filesystem sandbox.

BOUNDARIES
----------
The shared reader requires regular, non-symlink manifest files no larger
than 8 MiB, with version manifest/v1 and an items array. It does not validate
every House Key, provide an atomic snapshot across manifests, or establish
that indexed source files still exist. Returned paths are data, not permission
to execute them. The host must trust its registry and configured local code.

These actions do not implement the missing persistent watcher. Index freshness
still depends on the scanner being run. Toolkit discovery and beacon search
remain separate: a discoverable scaffold is not automatically beacon-indexed.

VERIFY
------
From RAB.Box:
  node --test tests/world-hands-mcp.test.mjs

The integration test needs the local server-world manifest and rab-world link.
It checks the MCP handshake, direct actions, one/many/empty array requests,
partial retrieval errors, invalid scalar input and generic write boundaries.
