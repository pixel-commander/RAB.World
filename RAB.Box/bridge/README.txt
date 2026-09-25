BRIDGE CONTRACT
===============

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
