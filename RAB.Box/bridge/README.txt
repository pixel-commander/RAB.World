BRIDGE CONTRACT
===============

WORLD HANDS MCP
---------------
Direct read actions use RAB_WORLD_BEACON_MANIFEST, configured once in the
MCP host environment with an absolute central beacon manifest path.
get_world_beacons takes no arguments and returns the ordered registry.
get_beacon_manifests takes {"beacons":["actions","containers"]}; even one
selection uses an array. Entries may be exact names or numeric IDs. Returns
an array in request order, with per-entry errors instead of losing healthy
results. Empty input returns []; duplicate names require a numeric ID.
Reads at most three local indexes concurrently; the array is capped at 100.
search_world takes {"query":"atom"} and reuses World Search with the
configured manifest path. No discovery round-trip is needed for these calls.
The direct reads use toolkit-owned implementations without a Box execution
record or source-tree scan. Each call rereads current disk indexes, not a
cached snapshot. Reconnect the MCP host after changing exposed actions.

world-hands.mjs exposes the linked sibling rab-world toolkit over MCP stdio.
It reuses Tool House discovery, validation and execution. No HTTP listener,
model loop, duplicate toolkit implementation or independent watcher is started.
The MCP host launches it with Node and owns its process lifetime.

Run: node bridge/world-hands.mjs
Connect in Codex (replace the absolute path for another machine):
  codex mcp add world-hands -- node L:\RAB.World\RAB.Box\bridge\world-hands.mjs
Disable by setting enabled=false in the world-hands MCP configuration;
disconnect or restart the host to stop an existing connection. Remove with:
  codex mcp remove world-hands

List World hands before invoking their exact returned keys. Invocation is
limited to available world-domain tools from the linked sibling rab-world.
Writing hands require confirm=true after user authorization. This flag is
an explicit caller assertion, not authentication or a filesystem sandbox.
Tools retain their existing filesystem authority and Box storage behavior.
No selected project context is injected; supply the catalog's explicit inputs.
Unavailable discovery records are reported, not silently made executable.
React tools are not exposed by this World-only adapter.

Verification: node --test tests/world-hands-mcp.test.mjs
The integration test needs the local rab-world toolkit link in TOOLKITS.json.
It checks the MCP handshake, discovery, read call, and rejection boundaries.
It does not execute a writing hand. Box identity allocation uses home .rab.

ROLE AND LAYOUT
---------------

bridge/ is RAB.Box's coordination layer between the UI/chat, selected project,
saved session state, and executable tools. It plans turns, gathers required
inputs and confirmation, resolves toolkits, invokes tools, and records the
result in the executing user's .rab directory.

Keep bridge/ flat for now: its modules are direct collaborators in one
coordination boundary, rather than separate feature-owned tool folders.

The generic new-project chooser remains here in project-conversation.mjs. It
chooses among React, HTML, Audit, and Magic Box project types, then delegates
to the selected type's creator. React-specific scaffolds belong in
RAB.Toolkits/rab-react-kit/ui/scaffolds; moving the generic chooser there
would incorrectly make shared project selection React-owned.

service.mjs owns saved run records and calls the existing engine:
prepare -> box.prepare
answer -> box.answer
answer-text -> box.answerText
resume -> box.resume
execute -> box.execute
inspect -> box.inspect

The client sends run ID + revision, never an execution ticket it constructed.
A stale revision (for example another browser tab answered first) returns 409.
Run writes use a temp file and rename. This is not an fsync durability guarantee.
An execution-started record is saved before running the engine. If execution is
interrupted, it is not automatically retried; the operator must inspect the files.
Only files named by the completed receipt can be read in the output viewer.
A completed run cannot execute again through this adapter.

Timestamp IDs follow the original engine. A collision stops; it is not silently
salted or retried. Same-millisecond independent preparations can therefore fail.

language.mjs reads language/PATHS.json and its declared imports directory.
It validates data-only JSON resources, saves imports create-only by content hash,
and performs exact-form lookup. It never edits a project manifest or invokes stamps.
Duplicate identical imports return already-present. Invalid files remain visible
as warnings. Deleting an imported file removes it from the next lookup.

HTTP SURFACE (see server.mjs)
GET  /api/session                 obtain a per-server session token
GET  /api/project                 current project and stamp settings
GET  /api/stamp?name=...          current normalized settings and path binding
GET  /api/runs                    up to the 100 newest run records
POST /api/runs                    {text} OR {request: canonical_request}
GET  /api/runs/:id                persisted run
POST /api/runs/:id/answer         {revision,stamp,key,value}
POST /api/runs/:id/answer-text    {revision,stamp,key,text}
POST /api/runs/:id/resume         {revision}
POST /api/runs/:id/execute        {revision,confirm:true}
GET  /api/runs/:id/file?path=...  file from a completed receipt
GET  /api/language               source metadata and installed exports
GET  /api/language/search?q=...   exact word/form matches
GET  /api/language/grammar        original .fcfg example as text
POST /api/language/import         a validated language-resource/v1 JSON object
POST /api/turn-check              {text}; shared-language input-only diagnostics
POST /api/language/teach          explicit vocabulary training and project repair

Turn Checker reads the shared language and house PATHS only. It rejects session,
project, and Bag fields, does not require HOST.project to exist, and does not
create or update project memory. Its output has scope=input-only and no project.
The former /api/turn-check/teach route has moved to /api/language/teach. Training
retains its explicit project-only/house-proposed scopes and existing saved data;
it is separate from Turn Checker. The shared compiler formats both results.

All /api calls except /api/session need X-Magic-Token. No CORS is enabled.
Local Host and Origin are checked. No arbitrary shell/file endpoint exists.
These controls are not multi-user authentication or an untrusted-code sandbox.
Project scripts and optional executable settings must be trusted.
