# Project workspace and folder runner

Implemented 2026-09-20 in RRAABBIITT v0.9.3. This describes the current slice,
not every later item in the feature roadmap.

## Project and application records

Normal startup creates `%USERPROFILE%/.rab` using the executing user's home.
All Box-owned state, sessions, requests, results, logs and temporary test data
belong beneath that home. Project source edits use the selected project folder.
The ordinary launcher ignores preview `RAB_HOME` overrides. Programmatic tests
may supply isolated homes beneath the user's `.rab/temp/test/<numeric-id>`.
Never choose the installation directory or Desktop as a replacement home.

One computer owns each home. Cooperating processes allocate observed `Date.now()`
numbers under the same lock and persist exact reservations in `rab-ids/v2`.
Repeated occupied milliseconds are waited out with a bounded failure; the
allocator never fabricates future timestamps. Catalog IDs are reserved exactly
and do not advance the clock. Existing IDs are preserved. Legacy v1 ledgers
require explicit backed-up conversion; missing reservation history cannot be
reconstructed. IDs have no name/hash suffix and are never reclaimed.

```text
.rab/
  id-state.json
  project-roots.json
  apps/<app-id>/
    settings.json
  feature-requests/
    <request-id>/settings.json
    .submissions/<submission-hash>.json
  projects/<project-name>/
    settings.json
    feature-requests/
      <request-id>/settings.json
      .submissions/<submission-hash>.json
    sessions/<session-id>/
      settings.json
      state.json
    runs/<session-id>/<execution-id>.json
    runs/workbench/<run-id>/run.json
    audit-results/<session-id>/<execution-id>.json
    indexes/<index-id>/
      settings.json
      state.json
      records.jsonl
      pending.jsonl
    batches/<batch-id>/
      settings.json
      state.json
      records.jsonl
```

App/request/project/session descriptors share `id`, `name`, `title`,
`description`, `settings`, `meta`, plus `version: rab-node/v1`. `settings` keeps
its house meaning: input declarations. `meta.kind` identifies the record role;
child descriptors include a typed numeric parent. Steps/groups/turns currently
remain embedded in session state, with numeric IDs. Index/batch descriptors use
the execution kind plus a folder-index/folder-batch role.

Updated 2026-09-21: new project directories use the exact project name, such as
`projects/magic/`. Names must be valid single folder names; spaces and case are
preserved. A duplicate folder name (including case-only differences) is rejected
without overwriting the existing project. Numeric project IDs remain in settings,
session parents, receipts and API addresses. The existing `project-roots.json`
owns both source-root-to-ID lookup and an optional `directories` map from ID to
folder name. New project stamps reserve their name through this owner before
writing source files. Session/index/batch folders and scratch paths stay numeric.

Already registered numeric project directories remain at their original paths;
they are readable without migration. Changing a display label does not move a
registered directory. Historical duplicates still produce an ambiguous name
lookup; numeric ID loading is exact. Older unsupported named/hash record formats
remain excluded, with no migration or automatic deletion.
Existing external source manifests may have text IDs;
registration gives their new local memory record a numeric identity without
rewriting that source manifest.

Audit project settings, sessions and reports stay in the owning memory folder.
`paths.folder` remains the default source directory. Development-project source
stays at its selected location; memory is separately owned under `.rab`.

## Projects and Requests

Projects offers a dropdown and read-only settings/session preview. Resume selects
saved work with automatic execution off. New action keeps history and resets
transient context. New session keeps project knowledge and starts fresh session
history. Selection is per browser window/tab; stale revisions and stale responses
cannot silently replace current work. A persisted unfinished execution becomes
interrupted on resume and cannot be replayed as a ready step.

Requests has Save for (Global / shared or Selected project), Name, Title,
Description and Type (tool/feature/ui/stamp). Global requests work without a
selected project; project requests require a valid registered project. The form
shows the server's exact destination before saving and the saved file afterward.

Updated 2026-09-21: new requests save only under the configured home's
`feature-requests/<request-id>/settings.json` or the owning project memory
directory's `feature-requests/<request-id>/settings.json`. The numeric project ID
resolves its existing registered directory, including older numeric directories.
Project source folders, this repository's docs, and caller-supplied output paths
are not request destinations. This preserves the existing `projects/` layout;
it does not introduce a competing `.rab/<project-name>/` directory.

Request records carry `scope: global | project` and, for project scope,
`project_id` and a project parent. API/tool responses add the absolute
`settings_path`; list responses include the destination `directory`. Requests
reuse `bridge/rab-memory.mjs` as their single writer.

A submission nonce preserves the exact accepted record on retry within its
scope. Changed fields under the same nonce conflict. Pending UI submissions pin
both their values and destination across retries. New request is a deliberate
separate submission. The nonce is transport metadata, not a record ID; its
reservation stays inside that destination's `.submissions/` folder.

Existing records under `apps/<app-id>/requests/` remain readable in Global /
shared. Retrying an already accepted old submission returns its original record.
There is no migration or new request write to that legacy location.

The list/read HTTP routes accept `scope` and `project_id` query parameters;
creation accepts them in the request body. The three public request tools use
the same fields. In project scope only, tools can bind an omitted `project_id`
from the runner's selected project. Missing, unknown or mismatched project
identities are rejected instead of falling back to global storage.

Updated 2026-09-21: new manual Workbench records use the memory owner's project
directory at `runs/workbench/<run-id>/run.json`. This separate branch avoids the
session execution-record layout. Preparation and later answers/updates use that
same destination; `HOST.runs` is no longer a write destination. Existing records
there remain available for project-checked, read-only history inspection. They
cannot be resumed or executed from the compatibility reader, and are not
automatically copied or rewritten. Reads alone do not enroll another project.

Public request tools, made through the canonical new-tool stamp:

- `base/create/request`
- `base/list/requests`
- `base/read/request`

## Folder index and supervised runner

```text
source directories -> disk-backed folder queue -> committed folder-ID index
                                                     |
                                   bounded cursor, one folder at a time
                                                     |
                                existing Tool House runner in child process
                                                     |
                                   committed result + timing + folder ID
```

`audit/index/folders` accepts the selected project (or explicit numeric
`project_id`), `folder`, and `max_duration_ms`. Its result is a small reference
and state, not a giant array. Each scanned directory has a numeric ID, numeric
parent ID and relative path. Empty folders, exclusions and inaccessible folders
are visible coverage. `.rab`, `.git`, `node_modules` and links are excluded.

`audit/run/folder-index` accepts `index_id`, optional `project_id`, `tool`,
`options`, `timeout_ms` and `max_duration_ms`. It reads a sealed index through a
bounded cursor, reserves each execution ID before starting its worker, runs one
folder, commits its result, then continues. Default tool:
`audit/count/folder-entries`, which counts immediate files/directories/links
without recursive rescans. A batch refuses tools without the direct-folder
contract and read/pure authority; current adapters require a leaf tool.

Limits: one worker, 96 MiB V8 old-space, 48 KiB IPC response, 64 KiB record,
100 rows/256 KiB maximum page. The heap limit is not a hard total-process RSS
limit or an OS security sandbox. Per-folder and whole-batch deadlines are
supervised; exited, stalled, oversized or cancelled workers produce explicit
outcomes. Partial batches retain completed results. Options cannot replace the
index-owned folder. Tools changing settings/executor or sources becoming
junctions are rejected.

Small result example (IDs here are illustrative):

```json
{"reference":{"kind":"batch","project_id":1789934000000,"id":1789934000100},"state":{"status":"partial","counts":{"completed":3,"skipped":1}}}
```

Authenticated read-only APIs:

- `GET /api/projects/<project-id>/indexes/<index-id>`
- `GET /api/projects/<project-id>/batches/<batch-id>`
- Either URL plus `/records?limit=100`; subsequent requests pass the returned
  cursor as URL-encoded JSON. Cursors bind to the owning stream and committed
  snapshot boundary. Status remains readable during processing.

## Evidence and limits

The dedicated pipeline suite passed 15/15. Its 100,000 synthetic-record test
committed 32,077,785 bytes, observed 34,410,496 bytes of RSS growth after warm-up,
and a largest page of 32,268 bytes, in about 10.12 seconds on this machine.
This tests record streaming/paging, not 100,000 forked audit executions or a
million-folder drive scan. The public-tool/API integration also generated an
index, ran the real default worker, paged results, checked numeric IDs and timing,
and verified untouched fixture source.

Known follow-ups, deliberately not claimed as complete:

- No automatic batch recovery/replay after the entire coordinator dies. Last
  committed status may still say running; records and committed cursor remain
  inspectable. No index identity reconciliation across fresh scans/renames.
- Index filesystem cancellation is cooperative; a hung OS/network filesystem
  call is not forcibly terminated. Batch child workers have hard termination.
- Engine cancellation is tested; no public UI/API Cancel action is wired yet.
- Existing whole-project audit engines have not all been converted. Unbounded
  parser/reducer/trace behavior needs its own adapters; arbitrary composite tools
  are not supported by this folder-worker protocol.
- Worker startup/catalog loading per folder trades speed for isolation. Profile
  before introducing a pool. Fingerprints cover settings and executor, not the
  whole import graph. Sequential paging is supported, arbitrary ID lookup is not.
- Saved-report policy for mixed development/audit projects, path-context ranking,
  and deeper task folders remain later work. Manual Workbench records now use
  project memory; migration of historical HOST run records is a separate action.
- Code preview/reviewer and context prompt buttons are explicitly deferred.

See [execution record](../../comms/2026-09-20-feature-planning/execution.md) and
[pipeline review](../../comms/2026-09-20-feature-planning/reviews/audit-pipeline-review.md)
for commands, outcomes and cross-review provenance.
