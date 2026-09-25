# Audit pipeline: independent research and first proposal

Date: 2026-09-20. Owner: **Review audit stamps**.
Status: researched proposal revised after user decisions and cross-review; research only, no implementation or benchmark claims. Live recommendations below match the compared plan; superseded choices are identified as comparison history.
Write scope: this file and `../reviews/audit-pipeline-review.md` only. No source edits in flight.

## Recommendation and boundaries

Deliver project switching and the request page first, after agreeing the small shared descriptor, identity, storage and continuation foundation. Keep execution scope fixed when the user switches projects. This first milestone does not require the mapper, process pool or streaming conversion.

In the later audit-reliability milestone, extend the existing runner and memory owner with bounded result emission, reference-based returns, supervised background execution and paged reads. Deliver one working scan through that entire path before extending every audit family. Make the mapper a reusable result producer and indexed batching a coordinator over the same runner. Toolbox write tests show supported code previews; canonical template copies may be generated under `.rab/temp/test/<numeric-id>/` without registering a fake project or modifying active project source.

The user resolved storage topology: normal first run creates `C:/Users/<current-user>/.rab` on the executing computer. One computer owns each home; its local windows/processes cooperate through the same owner. The house registry and audited source are separate locations. A UNC audit input does not move result storage. Independent computers keep independent histories; shared multi-host storage and synchronization are outside this plan. Preserve the explicit isolated test-home seam.

Research supports separating **execution identity**, **stable folder identity**, **observed map version**, **record position**, and **content integrity**. These answer different questions. Do not encode them all in paths or reuse an integrity hash as a durable identity.

This draft corrects the earlier mapper report's opaque-string-ID recommendation: the newer user requirement is numeric timestamp-derived IDs, without descriptive/random/hash suffixes. New examples follow that rule. The earlier report and saved receipts remain historical and unchanged. Content hashes remain useful evidence; they are not record IDs.

Confirmed scope: FR-0001/2, TR-0004/5 and streaming/progress, with dependencies on FR-0004/5 storage/lifecycle. Request logs and brief are authoritative for user intent. All keys, thresholds and new paths below are proposals unless identified as existing. This document does not claim all tools support the proposal already.

## Observed owners and gaps

Source reviewed on 2026-09-20; Node on this seat reports v24.15.0, while package.json allows >=22. Implementation must verify the supported runtime range rather than assume the newest Node APIs.

| Current owner | Observation and implication |
| --- | --- |
| [audit shared traversal](C:/Users/pixelcommander/Desktop/RRAABBIITT_v0.9.3/tools/audit/_shared.mjs:12) | `walkFiles` accumulates all file paths, sorts, and omits empty folders. Extension filtering occurs after traversal. Exclusions and link/read errors have callbacks. Reuse/refactor this owner; it is not yet an incremental folder mapper. |
| [theme engine](C:/Users/pixelcommander/Desktop/RRAABBIITT_v0.9.3/tools/audit/_engines/theme.mjs:11) | Full file reads, arrays of rows/skips/source hashes, final sorting/counting. Record streaming alone will not bound a giant individual file or its parser. Source hashes cover captured bytes and must survive migration. |
| [class parser/reducer](C:/Users/pixelcommander/Desktop/RRAABBIITT_v0.9.3/tools/audit/_engines/class-search.mjs:148) and [count composite](C:/Users/pixelcommander/Desktop/RRAABBIITT_v0.9.3/tools/audit/count/count.mjs:13) | Two recursive children produce full datasets, spread into another collection; each class retains every location. Need bounded reduction and streamed occurrence references, not just a writable output stream. |
| [class investigation](C:/Users/pixelcommander/Desktop/RRAABBIITT_v0.9.3/tools/audit/inspect/class-impact/class-impact.mjs:18) | Full class-count child executes before class token validation. Validate at the entry before walking. Exact original allocation failure still lacks a captured stack. |
| [tracking](C:/Users/pixelcommander/Desktop/RRAABBIITT_v0.9.3/bridge/tool-tracking.mjs:4) | `jsonBytes`/`compactValue` stringify the full value before checking its size; IDs are UUIDs; `packToolReport` recursively indexes results and preserves complete root/child values. New bounded data must never enter these whole-value operations. |
| [runner](C:/Users/pixelcommander/Desktop/RRAABBIITT_v0.9.3/bridge/tool-house.mjs:361) | Owns binding, nested execution, identity, timing and saving. `trace`, local seats, `task.result`, transition canonicalization and final output retain/copy results. Many tiny children can still make the trace unbounded. Extend this owner; do not add another executor. |
| [result persistence](C:/Users/pixelcommander/Desktop/RRAABBIITT_v0.9.3/bridge/rab-memory.mjs:167) | Existing writer saves only read results in projects with `type === 'audit'`, as one `audit-result/v1` JSON. Preserve containment and path binding. Mixed development/inspection needs a storage policy independent of project platform/type. |
| [report reader](C:/Users/pixelcommander/Desktop/RRAABBIITT_v0.9.3/bridge/rab-memory.mjs:190) | Envelope reader bounds a whole read to 32 MiB; `resolveToolValue` below it separately reads full JSON and expands references. A v2 descriptor must not trigger hidden full materialization through seats or consumers. |
| [memory locking](C:/Users/pixelcommander/Desktop/RRAABBIITT_v0.9.3/bridge/rab-memory-lock.mjs:9) | Cooperating process locks surround complete memory operations. A long stream must not hold the project operation lock for its whole lifetime. Preserve existing locking work; add run-scoped writer ownership through that owner. |
| [evidence identity](C:/Users/pixelcommander/Desktop/RRAABBIITT_v0.9.3/tools/audit/_evidence/records.mjs:12) and [verification](C:/Users/pixelcommander/Desktop/RRAABBIITT_v0.9.3/tools/audit/_evidence/workflow.mjs:17) | Evidence IDs use prefixed hashes; revisions hash entire canonical objects. Load re-derives IDs/facts from full results; freshness walks and hashes the input again. Numeric ID migration and streamed evidence require a versioned reader/validator, not renaming IDs in files. |
| [investigation facade](C:/Users/pixelcommander/Desktop/RRAABBIITT_v0.9.3/bridge/audit-investigations.mjs:17) | Requires string session IDs and an audit project, executes synchronously, returns full evidence, and lists by opening every JSON under results. New bundle companions must not be mistaken for legacy report envelopes. |
| [HTTP server](C:/Users/pixelcommander/Desktop/RRAABBIITT_v0.9.3/server.mjs:37) and [UI controller](C:/Users/pixelcommander/Desktop/RRAABBIITT_v0.9.3/magic-box/index.html:540) | JSON serialization/parsing of whole returns, synchronous scan request and subsequent full read/list. Progress needs responsive service execution, small status and bounded pages. |
| [workbench tickets](C:/Users/pixelcommander/Desktop/RRAABBIITT_v0.9.3/bridge/tool-workbench.mjs:36) and [service](C:/Users/pixelcommander/Desktop/RRAABBIITT_v0.9.3/bridge/service.mjs:100) | Existing prepare/answer/fingerprint/confirm flow can serve Toolbox testing. `toolsRun` at line 236 calls the runner directly; wiring a test button there alone bypasses the ticket confirmation flow. Ticket/run state is currently host-project based, distinct from selected-session result storage. |
| [artifact planning](C:/Users/pixelcommander/Desktop/RRAABBIITT_v0.9.3/tools/_artifact-plan.mjs:23) and [receipt file view](C:/Users/pixelcommander/Desktop/RRAABBIITT_v0.9.3/bridge/service.mjs:156) | Template rendering and guarded writing are already separate functions. Existing file view reads only receipt-approved regular files <=512 KiB and compares hashes. Useful reuse points for FR-0002; neither proves every write tool supports pure preview. |

Observed failure: two saved drive-root class investigations report `Invalid string length` in the class-definition child; one child lasted about 73 seconds. This locates the failing child, not the allocation. Do not claim final JSON serialization caused that specific exception until a bounded stack reproduction establishes it. The architecture has independently observed unbounded allocations at multiple stages.

## Primary-source mechanisms worth borrowing

1. **Node streams:** writable backpressure requires respecting `write() === false` and waiting for drain. `highWaterMark` is a threshold, not a hard memory ceiling. Our design still needs bounded records, queues and producer behavior. [Stream buffering](https://nodejs.org/api/stream.html#buffering), [drain](https://nodejs.org/api/stream.html#event-drain).
2. **JSON Lines:** UTF-8, one valid JSON value per line, newline-delimited. This gives incremental framing, not transactions, recovery, identity or an index. We must define those separately. [Format](https://jsonlines.org/).
3. **SARIF:** analysis results can reference artifacts and externalized properties, leaving tool/run information readable separately from large payloads. Borrow the separation and provenance; do not adopt SARIF's GUID vocabulary as our ID contract. A later export adapter could be useful. [OASIS SARIF 2.1.0, sections 3.4 and 3.15–3.16](https://docs.oasis-open.org/sarif/sarif/v2.1.0/os/sarif-v2.1.0-os.html).
4. **Watchman:** its ordinary watcher has an in-memory tree/recency index; saved JSON records watched roots/triggers. Path queries distinguish direct depth from recursive scans and provide deduplication. Borrow scope/cursor ideas; it does not provide our persistent folder-ID/history contract. Normal synchronized queries may create cookie files, relevant to the requirement that audited input remains untouched. [Source](https://github.com/facebook/watchman/blob/main/watchman/state.cpp), [in-memory view](https://github.com/facebook/watchman/blob/main/watchman/InMemoryView.h), [queries](https://facebook.github.io/watchman/docs/file-query), [query synchronization](https://facebook.github.io/watchman/docs/cmd/query).
5. **Filesystem identity:** Windows pairs volume serial and file ID to identify a file on one computer; network APIs can fail or provide incomplete information. Treat native identity as optional rename evidence, not the portable public ID. [FILE_ID_INFO](https://learn.microsoft.com/en-us/windows/win32/api/winbase/ns-winbase-file_id_info), [GetFileInformationByHandle](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getfileinformationbyhandle).
6. **SQLite WAL:** transactions and indexed queries are a serious alternative; there is one concurrent writer and WAL is not supported across a network filesystem. It cannot be silently treated as a general shared `.rab` solution. [SQLite WAL](https://sqlite.org/wal.html).
7. **Background processes:** Node workers suit CPU-heavy JavaScript and can share memory; child processes provide a separate process/memory boundary. Either still needs bounded messaging. [Workers](https://nodejs.org/api/worker_threads.html), [child processes](https://nodejs.org/api/child_process.html).
8. **Progress transport:** EventSource reconnects and uses event IDs, but does not itself provide durable application replay. Browser storage is string-based and can reject writes for quota/policy reasons. Borrow reconnect semantics; keep canonical scan output on disk. [EventSource standard](https://html.spec.whatwg.org/multipage/server-sent-events.html), [Web Storage standard](https://html.spec.whatwg.org/multipage/webstorage.html).
9. **Durability:** a stream's successful write/drain is not a power-loss durability promise. Explicit file sync requests flushing, with OS/device-specific guarantees. [Node filehandle.sync](https://nodejs.org/docs/latest-v24.x/api/fs.html#filehandlesync). Document what is durable on the supported filesystem and test failure boundaries.

## Consequential alternatives

| Decision | Serious alternatives | Preferred first implementation / reversal condition |
| --- | --- | --- |
| Result storage | Bounded JSONL segments + small manifests; SQLite-backed records; one JSON file per folder | JSONL owned by rab-memory, with disposable derived lookup indexes. Per-folder JSON has a huge-folder failure and filesystem overhead. Revisit SQLite as a replaceable local query accelerator if measured join/page cost justifies it; avoid two writable authorities. |
| Process model | Cooperative work in HTTP process; worker-thread pool; supervised child process invoking Tool House | A small bounded child-process pool for heavy audits protects UI service from synchronous parser/OOM failures. Reuse exact runner modules. Worker threads can be chosen after measurement if process startup/RSS dominates. Same-event-loop scanning cannot guarantee responsive progress. |
| Progress delivery | Polling bounded status/pages; SSE notifications backed by the same state | Poll first (proposed 500–1000 ms active cadence), with revision-based no-change responses. Add SSE when needed; it must use the same status owner and auth rather than becoming a second event store. |
| Folder identity | Path hash; native filesystem ID; persisted numeric IDs reconciled across map versions | Persisted house IDs. Native IDs can substantiate moves; ambiguous matches remain explicit. Path/hash/native identifiers alone do not meet both portability and durable history. |
| Refresh | Explicit recrawl; native watcher plus reconciliation; external watcher adapter | Explicit incremental traversal/refresh first. Add replaceable watcher hints only after coverage/freshness semantics work. A missed notification must trigger reconciliation, not a false “current.” |
| Aggregate computation | One in-memory Map; bounded sorted runs and merge; SQLite temp/query index | Bounded sort/merge fallback for exact high-cardinality reductions; small data may stay within an explicit memory budget. Do not quietly approximate exact counts. Measured complexity/cost can justify a replaceable SQLite accelerator. |
| Batch granularity | Runner invocation per folder; one composite run consuming indexed entries in bounded chunks | Composite defaults to chunks/direct entry scope, with per-folder progress and runner children where there is an actual tool invocation. Recursive whole-project tools run once. A million folder entries must not imply a million retained task objects. |
| Toolbox write testing | Render-only preview; template materialization in owned scratch; execute against selected real target | User chose code preview, with canonical template output allowed under `.rab/temp/test/<numeric-id>/`. Support only declared compatible render/materialize paths. Ordinary project writes remain normal execution, not Test. No default fake project or unanswered preview choice. |

## Preferred pipeline

```text
Chat / Toolbox / CLI / batch request
  -> existing prepare + compatibility + authority checks
  -> durable execution reservation and immutable scope
  -> supervised job invoking the existing Tool House runner
       -> incremental traversal / indexed input
       -> bounded parser / reducer
       -> memory-owned bounded emit with backpressure
       -> small result reference
  -> bounded tracking + report manifest
  -> status / page readers -> UI or another tool
```

### Execution and emission

The shared service reserves a numeric execution identity and records acceptance before background work. The existing runner adopts that reservation through an internal trusted contract; public callers cannot supply an arbitrary existing execution ID. Duplicate submit/reconnect resolves the same accepted request. Retrying a terminal attempt creates a new attempt with an explicit link; it never overwrites earlier evidence.

Freeze selected project/session/group/step, input root, result storage scope, tool ID/current path/fingerprint and resolved options at dispatch. Record resolution evidence from the existing matching owner, including relevant path weight; ranking never grants execution authority. Switching project/action changes observation context, not the destination of in-flight writes.

Proposed runner helper: `await helpers.results.emit(record)`; `helpers.results.progress(delta)`; bounded `helpers.results.read(reference, cursor)` for composite consumers; shared cancellation signal. Names remain subject to the shared contract review. Read/write/validation are implemented by the memory owner; helpers pass its capabilities rather than opening arbitrary result paths. Tool settings remain declared user inputs; operational controls are separate runner context. Descriptive `contract.json` output shapes are not runtime permission validators.

Each root execution owns one result bundle and serialized append owner. Child records carry the actual producer execution identity; children return references into that bundle. Record sequence is unique within the root bundle, not restarted for each child. A locator carries `{scope, root_execution_id, producer_execution_id, sequence}`; the reader checks that the addressed record belongs to both that bundle and producer. Never resolve a bare child sequence against the currently selected root. This preserves one composite report without embedding all child payloads. Independent concurrent roots have separate bundles. A batch can reference older completed child artifacts without copying their content. A storage schema must not force shared concurrent append by unrelated processes.

No growing payload may survive in results, options, seats, transitions, telemetry, task traces, diagnostic errors or HTTP responses. Store references and bounded summaries. Spill finished child trace metadata and release closed local seat state; retain only active ancestors and bounded windows in memory. Child task tables must be paged too. Track input/form limits before any whole-value hashing.

### Artifact framing, bounds and durability

Use one JSONL record per finding, file observation, skip/error, folder observation/completion or bounded scalar aggregate. Do not serialize an entire large folder as one line. Source hashes and zero-result coverage are first-class records. A file observation is committed after its captured bytes, observations and relevant errors are accounted for.

Proposed initial engineering limits: 64 KiB encoded record; 1 MiB pending writer queue; 1 MiB/200-row response page (whichever comes first); small manifest/status <=64 KiB. Validate fields/arrays/depth before serializing; finding excerpts are bounded and explicitly marked when clipped. Loss of semantic data becomes a separate artifact reference or explicit partial/unsupported outcome, never silent truncation. These are measurable defaults to tune, not existing limits or user requirements.

Bound individual input as well: parsers that require whole text get a declared byte budget and classified unsupported-size coverage until made incremental. Streaming regex input naively breaks matches across chunk boundaries; test Unicode, escapes, comments, templates, CRLF and long lines before claiming parser equivalence. The large-input policy must not turn “not parsed” into “no finding.”

Proposed segmented storage caps each segment (for example 16 MiB). Segment numbers and record sequences are positions, not house identities. Segmentation keeps sealed portions immutable, bounds restart repair, and enables per-segment checksums. The list of segments is itself streamed/paged rather than an unbounded array in summary.json. Derived sequence/folder/class lookup indexes are reconstructable from the authoritative records and never updated independently by audits.

Persistence order: append complete records -> flush checkpoint data -> atomically publish the committed byte/sequence boundary -> expose it to readers/progress. A final success is published only after sealing artifacts and storing terminal execution state. Those are separate writes: retain one completion decision or idempotent commit receipt linking them, reconciled by the memory owner. A crash between them remains finalizing/interrupted until reconciliation; a sealed file alone cannot override failed or unknown execution state. Distinguish observed work from committed results. Progress loss must not invalidate already committed data; reconstruct it or display the last known point. Do not promise that drain/rename alone survives power loss.

Only one writer owns a root bundle. Acquire short project locks for admission/metadata, and a run-scoped ownership mechanism for append. Do not hold the project lock during parsing or idle time. Proposed lock ordering is allocator -> project -> run; never acquire the allocator while holding a conflicting project/run lock. Preserve existing stale-lock rules; no age-only lock stealing. Fsync batching and recovery must be measured on the supported local filesystem. Shared UNC multi-host result writing is outside the user-selected deployment.

After crash, retain complete committed records. An unfinished tail is classified and preserved as interrupted evidence; do not silently repair a corrupted completed segment. Resume should create a linked attempt by default, reuse only verified completed units, and append a fresh segment. Exactly-once arbitrary tool effects are not promised. Initial automatic retry is limited to idempotent reads, if enabled at all; write effects remain uncertain until verified.

### Progress and paging

The accepted start response is small and prompt. Status reports execution state, phase, current folder/file, observed/scanned/completed counts, matches, skips/errors, elapsed time, last real progress, worker liveness and committed sequence. Heartbeat and real progress are distinct. Percentages require a fixed known denominator and name it (files/folders, not predicted runtime).

Keep the service responsive while the child parses. IPC carries bounded control/status, not giant result arrays. Cancellation requests are cooperative first; an unresponsive read worker can be terminated by its supervisor with interrupted evidence preserved. Killing a worker is not confirmation that a partly executed write rolled back. General write-job cancellation is outside the first read-scan milestone.

Page cursors bind to selected scope, root execution, artifact/segment, filter, committed sequence ceiling and position. Treat a cursor as a locator, not authority. Validate project ownership and containment server-side. A missing derived index gives bounded scan/rebuild progress, not one unbounded HTTP request. Growing-run readers see only committed records; completed-run pages use immutable manifests. Reload/reconnect observes the same run and never starts another scan.

Listing investigations must read small summaries through the memory owner and explicitly distinguish v1 files from v2 bundles/companions. It must not recursively parse every JSON file in a result tree or return unlimited lists.

## Numeric contracts and map semantics

Agreed proposed interface with Activate rraabbiitt: shared numeric safe-integer allocator uses a durable high-water mark, `max(Date.now(), last + 1)`, with batched reservations for folder IDs. This is not a tested implementation. Durable acknowledgement, corrupt-state handling, imported-ID admission and lock ordering need acceptance tests. The user-selected uniqueness realm is one local per-user home with cooperating processes; no uncoordinated cross-host/offline uniqueness claim. Do not infer creation time from allocated IDs; preserve actual `start_date`/`end_date`. Allocation gaps are valid. Folder IDs must not be traversal positions. Details of reservation/descriptor migration remain owned by the identity lane.

Flat incremental observation records are preferable to one giant nested map document. They do not replace nested owned project/session entity folders and their settings.json descriptors. The shared descriptor owns relationships through proposed `meta.parent`; a compact map row's `parent_id` is a projection, not a second independently writable relationship. JSON object keys are strings even when they look numeric; use rows with numeric fields instead of making object keys the identity contract. Generate nested displays or lookup maps as derived views. Nothing adds settings files inside the audited source tree.

Proposed pipeline projection for a newly numeric project (not the complete shared descriptor):

```json
{
  "version": "audit-result/v2",
  "project_id": 1789930000000,
  "session_id": 1789930000001,
  "execution_id": 1789930000100,
  "tool": { "id": 1830000000007, "address": "<resolved existing address>" },
  "input": { "folder": "C:/sample", "index_id": 1789930000050 },
  "result": {
    "version": "audit-records/v1",
    "file": "segments.jsonl",
    "totals": { "folders_scanned": 12, "findings": 37 },
    "coverage": { "status": "partial", "skipped": 1 }
  }
}
```

The sample tool ID/address pair is illustrative and must be filled from actual discovery, not registered or assumed valid. `input`, stream reference and coverage fields above are proposals; keep existing outer `tool`, `options`, `result`, `seats`, `authority`, transition/task references in the complete envelope. This projection omits them only for readability. `result_file` remains an absolute path returned by the owner; persisted companion references resolve relative to the owning bundle with containment checks. Integrity hashes live in named checksum fields; `index_id` can equal the mapper execution ID.

Individual map and result records, abbreviated:

```jsonl
{"sequence":1,"kind":"folder","id":1789930000051,"parent_id":null,"path":"."}
{"sequence":2,"kind":"folder","id":1789930000052,"parent_id":1789930000051,"path":"src"}
{"sequence":42,"kind":"finding","producer_execution_id":1789930000100,"index_id":1789930000050,"folder_id":1789930000052,"file":"README.md","result":{"status":"found"}}
{"sequence":43,"kind":"count","producer_execution_id":1789930000100,"index_id":1789930000050,"folder_id":1789930000052,"result":{"extension":"tsx","count":20,"scope":"direct-files"}}
```

A source reference explicitly carries scope + root execution + producer execution + root-wide record sequence, with index/folder for the observed address and checksum for integrity when sealed. The example lines abbreviate bundle scope/root; actual records and their envelope must establish them unambiguously. They do not require a fresh timestamp ID for every immutable line. Entity records that need independent identity get numeric IDs from the allocator. Sequence is local ordering; it must not be treated as a reusable entity ID.

Map versions are immutable observations taken over an interval, not atomic snapshots. Keep empty/inaccessible/excluded folders and link boundaries visible. Preserve path spelling; apply filesystem case rules deliberately. Resolve source root from canonical `folder`/saved binding; distinguish it from `.rab` project.root. Neither the mapper nor watcher synchronization may modify the audited folder.

Stable identity first means the same reconciled logical folder in the same root lineage. Confirmed moves preserve its numeric ID and append new observed paths in the next version. Ambiguous delete/add is not silently labeled a move. Directory disappearance behind an unreadable parent, or an unavailable drive/share, is unknown rather than proof of deletion. Root retargeting starts a new lineage unless relocation is explicit or verified; equal titles, contents or relative paths do not establish relocation. Old audit references still resolve their original observed root/map, not today's binding. Native identity can improve matching but cannot become a mandatory platform dependency.

Persist authoritative identity assignment observations so replay can recover the same IDs. A disposable current path-to-ID lookup alone is insufficient: deleting it must not allocate new identities for all old folders. Retain referenced map versions; cleanup must follow references. A derived index may be replaced/rebuilt; identity history may not be silently regenerated with different IDs.

Include lightweight file observations during mapping to support filename/extension queries without another traversal. File content reads/hashes remain opt-in to audit semantics. The mapped filename inventory does not prove current content or uninterrupted existence. Source-sensitive plans still need verified freshness and complete relevant coverage.

## Indexed batching without repeat work

Runtime capability metadata must distinguish `project`, `direct-folder`, and `indexed-files` input support (names proposed). Ordinary `folder` inputs do not establish direct-folder semantics. A batch rejects unsupported scope; it must not silently run a recursive scan on every indexed parent.

Example: README-name discovery and direct file-type counts can consume one sealed file inventory; a dependency graph audit runs once with project context. A class finder can consume bounded indexed file groups once, while its global reducer combines them. Parent/child relationships let the viewer compute subtree totals without re-reading descendants for every ancestor.

Bind each unit to the map version, tool fingerprint/options and selected direct inputs. Save completion/failure/skipped records per unit and actual runner attempt references. Distinguish scheduled folders from files actually read; project-root results are not a fabricated per-folder success. Derived deterministic selection keys may be checksums, but never masquerade as the numeric execution ID.

A restart compares requested units with verified completions and schedules only unresolved safe read units. A changed input invalidates reuse; a changed tool/options fingerprint starts another result lineage. Do not advertise universal resumability until the tool declares checkpointable boundaries. Avoid unlimited Promise.all, mutable shared bag promotion across children, and arrays of every child output.

## FR-0001/2: temporary output, real tracking

Keep Toolbox discovery independent of project settings. Choosing **Test** opens declared input fields and an explicit execution/storage context; it must not silently inherit the last Chat project's folder. Read tests with all inputs supplied can use an application-owned scratch context. Project-aware tests may explicitly select a project/session and reuse its saved defaults. Use the shared typed descriptor/session owner rather than inventing a fake project solely to satisfy current runner assumptions.

The user-selected temporary output home is `.rab/temp/test/<numeric-id>/`, replacing the initial app/tests alternative. It uses the same memory API and execution/result schema as durable project work. Application request records remain in their separate app scope. Browser storage keeps bounded run/view references, never the canonical result. The browser may forget a view while the server finishes a run; that must not delete or hide its evidence accidentally.

Temporary means a retention policy, not missing accountability. Track tool, source fingerprint, options, actual execution IDs, start/end/duration, success/error, source scope, output references and storage purpose. History/telemetry can distinguish test versus normal execution through a proposed context field rather than separate logs/writers. Never promote test seats or scratch generated paths into the active project bag.

Write-tool Test means code preview. Generated-code view has two distinct truthful states: **planned content** from a declared pure render plan, and **written preview content** generated in its owned temporary tree and verified against a receipt. Reuse renderTemplateTree/writeArtifactPlan separation for compatible stamps; add a plan-producing adapter in the actual tool owner where needed. Capturing stdout, setting an unknown dry_run flag, or running a writer and hiding its files does not make preview safe. A temporary destination is not an OS sandbox: compatibility must cover project registration, resources, child calls, seats and external effects too. Unsupported tools should say so until adapted. Do not register a fake project by default.

The UI code viewer loads manifest-listed files in bounded pages, marks binaries, and shows expected/current hash mismatch. Render text as text, not executable HTML. Reuse the existing receipt-file endpoint's allowlist/containment checks while removing its host-only context assumption. Both preview and actual run have provenance; a preview is not counted as a successful write verification.

Separate **Clear view** (local UI state), **Clear test artifacts** (owned scratch after quiescence), and any explicitly requested removal of generated project files. No automatic deletion TTL proposed. Clearing scratch must not delete artifacts retained by another report, cross into the source/project, or race an active writer. Reference addition/promotion and cleanup serialize through the same memory owner: retained evidence remains valid or cleanup refuses. Tombstones cannot substitute for retained verifiable bytes; any evidence loss needs explicit authorization. These distinctions do not require three buttons; the coordinator owns UI wording and confirmation scope.

## Compatibility and implementation sequence

The selected project/request milestone comes first. The following table describes later pipeline work packages, not competing first-delivery priorities; the compared plan controls ordering across lanes. Within that later work, do not block streaming on a wholesale hierarchy rewrite or every mapper feature. Depend on the small shared identity/storage API, support existing projects through versioned adapters, and keep physical layout behind the memory owner. Existing string IDs and v1 evidence remain readable with their original bytes and meaning; do not cast legacy IDs to numbers or strip suffixes.

| Stage | Proposed source owners/files after authorization | Deliverable and prerequisite |
| --- | --- | --- |
| 0: controlled diagnosis | `class-impact.mjs`, class parser, dedicated scan tests | Capture original allocation stack using bounded/disposable fixtures; validate selector input before walking; classify oversized/unreadable sources visibly. No claim that a limit alone completes streaming. |
| 1: common contracts | identity/storage lane; `rab-memory.mjs`, tracking contract, tool-house lifecycle | Numeric allocation/adoption, scope descriptor, v1/v2 reader boundary, byte/coverage semantics and single-writer bundle. Allocate IDs once; avoid a second job registry. |
| 2: first vertical slice | `tool-house.mjs`, `tool-tracking.mjs`, `rab-memory.mjs`, `_shared.mjs`, theme/class-definition engine, service/server/UI owners | One existing class-definition tool emits bounded records in a supervised job; paged output/live progress, errors/cancel retained, same source unchanged. Proposed private job helper may live in bridge but invokes the existing runner only. Old callers remain bounded and explicit about unsupported modes. |
| 3: class chain | count/class-search, `_evidence/records.mjs`, class-investigation/workflow, facade + UI | Stream reduction/provenance/freshness through count and class impact; numeric evidence v2; preserve approval gates. No whole-data compatibility adapter. Existing small v1 reads remain supported; huge v1 reports keep an explicit limit/conversion outcome. |
| 4: mapper and batch | shared traversal, one new mapper tool owner, one batch composite owner, memory derived indexes | Numeric folder IDs and immutable versions, file inventory, direct-scope batching, recovery/retention. Final public paths follow coordinator's approved semantic taxonomy; no guessed IDs/handwritten registry. |
| 5: Toolbox tests/code | tool-workbench/service + actual artifact-producing tool owners + shared code-viewer owner | Scratch/project context, typed forms, supported code preview, verified temporary output and safe clear. Use the answered preview semantics. The compared plan may schedule this independent package before the mapper. |
| 6: broaden | discovered engine owners, descriptive contract sidecars and output guide generator | Convert remaining audit families by actual owner discovery, not a hard-coded stamp count. Each tool declares supported input/result modes only after end-to-end tests. |

Versioned references replace giant values through transitions/seats, but small normal tool results can remain inline under a declared bound. Preserve `start_date`, `end_date`, monotonic measured duration and existing report ownership. Define `result_bytes` for v2 as committed artifact bytes (separate from descriptor bytes), leaving v1's meaning unchanged. Session/step directories and shared settings.json placement are the identity lane's contract, not a second physical layout invented here.

Terminal/report migration must also update tool-tracking and rab-memory contract sidecars, evidence schema/readers, investigation listing, and the generated Toolbox shape documentation. Do not hand-edit embedded output guide data. Expand read-result persistence based on explicit selected storage/result policy so a development project can inspect itself without changing its project type.

Numeric evidence v2 must validate semantic facts independently of allocated IDs and also validate each immutable ID-to-fact association and relation endpoint. Dropping IDs from a digest alone permits swapped identities to alter declaration/plan meaning. Preserve the existing v1 validator unchanged; new lifecycle IDs around a v1 evidence payload do not make that payload v2.

## Falsifiable acceptance criteria

These are proposed targets to measure on a recorded local fixture/runtime, not results already obtained. Existing 496/499 checks belong to earlier work and prove none of this migration.

| Check | Required observation |
| --- | --- |
| Output equivalence | For small fixtures, v2 normalized rows/counts/locations and captured-byte hashes equal v1, excluding storage IDs/order where explicitly versioned. Cover CSS escapes, templates, dynamic class gaps, UTF-8 boundaries and zero-match files. |
| Bounded output growth | Emit 100,000 then 1,000,000 fixed-size synthetic records without building matching source trees. Combined parent+child RSS growth should stay within a proposed 64 MiB delta after warm-up; record queue peaks and ensure <=1 MiB configured queue. Test unique-key reducers separately so they cannot hide an O(unique classes) map. |
| Individual-file behavior | Very long/minified file and oversized source yield bounded parsing or explicit partial/unsupported-size coverage; no Invalid string length, silent success, or UI stall. |
| Responsiveness | Proposed local p95 start acknowledgment <=500 ms after context validation; status/page <=250 ms while a parser is busy. Display committed progress within 2 seconds when records advance. Measure background/idle baseline too. |
| Paging | Every encoded page <=1 MiB and <=200 rows; malformed/cross-project cursor rejected; pages contain no duplicates/omissions at a fixed committed boundary. Listing is bounded and skips companion JSON correctly. |
| Locator namespace | Two children emit their first rows into one root bundle; each locator resolves its intended producer/row after project switch and reopening. Another root's equal sequence cannot resolve by accident. |
| Crash/disk failure | Inject failure after append, checkpoint, segment seal and before terminal state; all advertised committed records remain readable, terminal outcome cannot falsely become completed, and disk-full errors retain prior evidence. Torn active tail and sealed-segment corruption produce different outcomes. |
| IDs/concurrency | Existing numeric allocator concurrency tests plus a large reservation batch: no duplicate/new prefixed IDs, no overwrites, holes allowed, restart high-water safe. All source hashes separate from IDs. |
| Identity/coverage | Empty, renamed, removed/recreated, case-sensitive, inaccessible and linked folders; unchanged logical folders retain IDs; unreadable subtrees are not treated as deleted; old index/folder references resolve original paths. |
| Identity reconstruction | Delete only a derived folder lookup and rebuild: assigned IDs remain unchanged. Retarget to another root with identical relative paths: historical links still resolve the original root. Missing drive/share is unavailable, not mass deletion. |
| Batch efficiency | Nested fixture proves each eligible file is visited once for direct-scope batching; recursive/project tools run once; accurate scheduled/completed/failed totals. Attempts stay distinguishable after interruption. |
| Evidence trust | Changing a captured file, adding a relevant file, corrupting records, changing tool code, or omitting coverage blocks a source-sensitive plan until verified. Numeric identity itself is never accepted as proof. |
| Evidence association | Swap numeric entity IDs while preserving textual facts: v2 rejects altered relation/declaration bindings. Original v1 hash-ID reports still load under their unchanged validator. |
| Context | Start in project A, switch to B/new action, reload browser: original run/results remain in A, no auto-retry; valid false/0/empty inputs follow their actual declared contract. Mixed creation/inspection keeps project identity/platform intact. |
| Toolbox | Read test stays out of project bag; pure preview creates no target files; template materialization writes only owned temporary output without project registration; clear-view preserves output. Race scratch cleanup with durable reference promotion: evidence stays valid or deletion refuses. Ordinary source writes keep existing authority/receipts. |
| Compatibility | Original v1 reports/sessions unchanged byte-for-byte; old references resolve through bounded legacy reader; version mismatch and over-limit legacy data produce visible outcomes, never silent reserialization. |

For the later large-audit milestone, the first bounded delivery is stages 0–2 for one existing class-definition tool, with numeric reservation, project-owned result streaming, scratch-capable read testing, progress and recovery measurements. Stage 3 is required before claiming the user's full class investigation issue is solved. No drive-root trial before these fixtures and an explicitly selected normal project pass. The user's initial milestone remains project switching and the request page.

## User-blocking decisions and cross-lane notes

No unanswered user decision blocks this first-milestone plan. Write-tool Test means supported code preview, with canonical template copies under `.rab/temp/test/<numeric-id>/`. Normal storage belongs to the executing user's local home, one host per home. Prompt-button work is deferred. Do not reopen these choices.

Engineering choices (queue sizes, pooling, segment/cursor encoding) are ours to test, not a questionnaire for the user. Cross-host `.rab` writes and synchronization are outside the selected local deployment, not pending prerequisites.

Identity lane handoff accepted: proposed numeric allocator with batch reservations, map execution IDs as versions, user-selected temp/test scratch, explicit clearing without TTL, and versioned preservation of old identities. Independent concerns sent back: evidence ID re-derivation, string-only session APIs, and project-lock lifetime during streams. UI integration must implement the answered preview semantics, selected-context binding, non-audit persistence and bounded code/progress views through existing services.

Cross-review is recorded in [audit-pipeline-review.md](../reviews/audit-pipeline-review.md); final coordination is in [comparison-plan.md](../comparison-plan.md). No source scope is reserved by this proposal; coordinator assigns exact implementation ownership later.

## Decision provenance and cross-review details — 2026-09-20

The coordinator's [recorded answers](../questions.md) arrived after the independent draft and are now folded into the live recommendations above. They changed the original milestone recommendation and settled the preview question:

- **First visible milestone is project switching and the request page after the shared foundation.** Streaming/mapper stages above are a later work package, not prerequisites for shipping those screens. First-milestone pipeline requirements are immutable execution scope, references in saved state, numeric creation seams and a persistence API that does not assume all storage is an audit project. Do not force a stream engine, mapper, full historic migration or process pool into this milestone.
- **Write-tool Test means code preview.** Template copy/rename tools may materialize their canonical generated files under a proposed `.rab/temp/test/<numeric-id>/` area. This replaces the older app/tests scratch path and the proposal to ask the user to choose preview versus execution. Application request records/preferences stay in their distinct app scope. No new clarification on this decision is needed.
- **FR-0003 prompt button is deferred from the entire round.** No pipeline design/research/implementation for that feature is included. It remains only a request-log entry.
- **Local ownership is resolved.** Each executing computer creates the current user's `.rab` on first run. Cooperating local windows/processes share that home; another computer's history is independent. No server/shared-storage or synchronization requirement is inferred.

### Preview-specific integration

Keep one canonical generation operation behind plan/render and materialize variants. A pure plan preview returns bounded manifest/file references without modifying target source. A template preview may perform real writes only in its owned temporary output tree and is labeled generated preview, not verified modification of the user's project. The viewer must show the exact bytes produced by the canonical render/copy/rename logic.

Redirecting an output folder is not an OS sandbox and does not confine arbitrary Node code. In particular, `tools/_stamp-engines.mjs:19` calls `memory.openProject(meta)` after generation, and the audit project stamp calls `newProjectPath`/`setProjectPath`. Such side effects cannot be assumed to obey a destination argument. Preview compatibility must cover registration, resources/facts/seats, paths, child calls and external effects; plan/render adapters must avoid project activation/registration. A plain `context.preview = true` flag ignored by an executor is insufficient. Use known compatible canonical owners; visibly decline preview until unsupported writers are adapted.

Tool House still owns invocation and tracking, workbench/service still owns input/fingerprint/authority checks, and rab-memory owns scratch result persistence. The Test action can authorize the reviewed temporary preview operation; do not invent an extra confirmation loop solely because `.rab` files are written. Actual writes to a user's project remain a separate normal execution request. A temporary preview consumes no active-project defaults unless the user explicitly chooses that context; project source and session bag remain unchanged.

The existing service receipt viewer is a backend reuse point only. The requested React CodeViewer component has not been located by the bounded searches reported by the UI lane. Do not claim it is the current vanilla `<pre>`, install an editor as a substitute, or block the first project/request milestone on locating it.

### Shared descriptor alignment and remaining engineering corrections

Accept the identity lane's common descriptor core (`id`, `name`, `title`, `description`, `settings`, `meta`) and proposed role/relationship owner as the leading shared contract. The mapper's short `id`/`parent_id`/`path` records above are projections, not a second node descriptor convention. If persisted folder entities use the core, their authoritative relationship is the agreed `meta.parent`; derive `parent_id` for a query/view rather than dual-writing both. A folder observed in the audited source does not get a settings.json written inside that source; its representation is stored in the project-owned result bundle.

Stable ID refresh also needs bounded joining: do not load the previous entire path-to-ID map into RAM. Use a derived disk lookup, or bounded external sort/merge of old/new observations. Authoritative assignment observations survive cache deletion; confirmed rename handling can update the derived lookup without changing prior snapshots.

I agree with shallow adopted storage levels, versioned readers, local single-realm allocation and source-sensitive validation. Cross-review identified a conflict between an optional legacy writer and the rule that new lifecycle records be numeric. The compared plan resolves it: explicit Resume-for-work creates one numeric continuation, with a durable mapping and scoped links to unchanged original history. New actions, steps, turns, attempts, receipts and failures in that adopted flow use the same numeric owner. Historical evidence keeps its declared v1 protocol until its separate versioned migration; the first milestone verifies a representative existing audit through the new lifecycle. Read-only preview never creates a continuation. No legacy writer remains the default new-work path.

Future scratch clearing must account for references. Clear view is cheap local state; deleting a preview bundle requires quiescence and an ownership/reference check. If a durable investigation/report references it, retain/promote the referenced artifact through the same memory owner or decline destructive cleanup. Serialize promotion/reference addition against deletion through that owner. A tombstone may retain the minimal tracking outcome after explicitly deleting unreferenced temporary content; do not leave dangling evidence that appears verified.

Cross-review is in [audit-pipeline-review.md](../reviews/audit-pipeline-review.md). Identity review also sharpened root/producer locator scope, recovery between segment seal and terminal publication, ID-to-fact association validation, root relocation evidence and lock ordering; these are integrated above with falsifiable scenarios. Final read-only review of [comparison-plan.md](../comparison-plan.md) found no material contradiction or blocker for the selected first milestone. Implementation and acceptance review still require explicit file assignments; this research does not report product tests as passed.
