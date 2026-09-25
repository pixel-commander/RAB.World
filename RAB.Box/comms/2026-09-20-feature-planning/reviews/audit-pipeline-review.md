# Audit pipeline cross-review

Date: 2026-09-20. Reviewer: Review audit stamps.
Reviewed: `../lanes/ui-routing.md`, `../lanes/identity-storage.md`, `../questions.md`, current canonical request logs, and the source owners named below. Research only; no product code, installs, service actions or real-drive scans.

## Current user decisions govern synthesis

The initial lane drafts were independent. The later recorded answers choose project switching + request page first, code preview with template artifacts under proposed `.rab/temp/test/<numeric-id>/`, and complete deferral of FR-0003. Each executing computer initializes its current user's `.rab` on first run; local windows/processes cooperate, while other computers keep independent histories. These answers are now folded into the pipeline report's live recommendations. No additional question about preview or writer topology should be sent.

## Review findings that affect the plan

### 1. Identity: legacy reads and new-ID creation need a sharper boundary

**Resolve before lifecycle implementation.** The identity draft correctly preserves original reports and describes numeric v2 continuation. Its later option to retain a v1 writer can conflict with the rule that new identities are numeric: existing planner/memory code will generate timestamp-random or prefixed-counter IDs on new turns/actions/attempts.

Proposed resolution: keep v1 history read-only and unchanged; use a numeric-aware versioned continuation/write adapter for new work. If that adapter is not yet safe, the UI can offer read-only history and a new numeric session, labeling the limitation. Do not expose a claimed complete Resume/New action path that silently generates more old-format IDs. The exact cutover remains the identity owner, with end-to-end session/endpoint tests.

Evidence: [memory session creation](C:/Users/pixelcommander/Desktop/RRAABBIITT_v0.9.3/bridge/rab-memory.mjs:161), [execution IDs](C:/Users/pixelcommander/Desktop/RRAABBIITT_v0.9.3/bridge/tool-tracking.mjs:18), and the identity lane's planner references. Existing evidence IDs add another later migration seam, not a requirement to rewrite old receipts now.

### 2. Preview: temporary destination does not neutralize tool side effects

**Resolve before FR-0001/2 implementation, not a blocker for the first project/request screen.** UI lane's explicit warning that a disposable target is not an OS sandbox is correct. The latest user chose preview, so the initial general disposable-project recommendation must be marked superseded in the compared plan.

A specific source example strengthens this: [runProjectStamp](C:/Users/pixelcommander/Desktop/RRAABBIITT_v0.9.3/tools/_stamp-engines.mjs:19) registers project memory after writing; [audit new-project stamp](C:/Users/pixelcommander/Desktop/RRAABBIITT_v0.9.3/tools/audit/stamp-new-project/stamp-new-project.mjs:17) chooses its own project destination and saves a default path. Redirecting only a declared output input would not prove preview isolation.

Recommendation: reuse canonical render/copy/rename owners through a declared preview/materialization contract that covers registration, resources, children and seats. Unsupported tools do not execute speculatively. Runner still records the actual work. Input preparation/fingerprint and authority remain in [workbench](C:/Users/pixelcommander/Desktop/RRAABBIITT_v0.9.3/bridge/tool-workbench.mjs:36)/service; direct `/api/tools/run` is not a universal Test implementation. Use a typed scratch scope, not an accidental known-project registry entry.

### 3. Project browsing must stay nonmutating all the way through the service

**Required in the chosen first milestone.** Both drafts correctly separate preview from activation. Preserve that at every layer: project discovery/inspection cannot invoke `openProject`, `loadSession` initialization or host-config reconciliation merely to render the dropdown. Selecting a preview cannot create a session or change last-opened metadata.

The existing [service config](C:/Users/pixelcommander/Desktop/RRAABBIITT_v0.9.3/bridge/service.mjs:43) resolves host/selected project and can reconcile telemetry; [memory openProject](C:/Users/pixelcommander/Desktop/RRAABBIITT_v0.9.3/bridge/rab-memory.mjs:65) updates saved metadata. Make a read-only inspection owner explicit and test filesystem snapshots before/after browse. Commands that activate or save requests retain their normal deliberate writes.

### 4. Mixed project work needs an explicit result storage policy

**Define in foundation; implement where mixed execution is enabled.** A development project performing an audit must retain its platform/type. [saveToolResult](C:/Users/pixelcommander/Desktop/RRAABBIITT_v0.9.3/bridge/rab-memory.mjs:167) currently rejects non-audit project storage, and [investigation facade](C:/Users/pixelcommander/Desktop/RRAABBIITT_v0.9.3/bridge/audit-investigations.mjs:19) enforces audit type separately. UI-only switching of current branch would not fix either.

A shared resolved storage scope/result policy should govern persistence across project read results and temporary previews. Keep result writing in rab-memory; do not compensate by writing reports from the new UI or copying them into docs/app request records. Foundation should expose this seam without requiring high-volume streaming in the first milestone.

### 5. Descriptor self-similarity should not duplicate relationship truth

**Resolve shared field projections once.** I support the identity lane's common core, typed role, derived child views, and distinct meaning for tool input `settings` versus runtime state. A category descriptor must not become an executable merely because a parent executor exists. Tests must protect existing discovery while role-aware descriptors arrive.

My earlier mapper examples used `parent_id`; the identity lane proposes `meta.parent`. Treat small map/page records as projections of the canonical relationship, not two independently writable fields. Source folder observations stay in `.rab`, never as injected settings.json files in the audited tree. Historical numeric identity assignments and migration aliases are durable facts; derived current indexes alone cannot replace them.

### 6. Scratch cleanup must preserve provenance or explicitly revoke it

**Required before any Clear test deletion.** Identity lane correctly separates Clear view and Clear artifacts, quiesces writers and avoids TTL. Add a reference rule: do not delete a preview artifact still referenced by a durable report or declared evidence. Promote/copy through the canonical owner with explicit provenance, retain it, or refuse the deletion. If unreferenced content is deliberately cleared, keep a minimal accurate outcome/tombstone where tracking retention requires it; never imply its bytes can still be verified.

No automatic deletion/recovery logic is authorized in this research round. Existing source files remain outside owned scratch cleanup.

### 7. Routing probes are useful evidence; avoid expanding the selected milestone

The UI lane carefully labels its `findTools` probes as search results, not executed mistakes. That distinction is sound. Hard operation/platform/authority compatibility followed by bounded contextual ranking is preferable to more raw path weight. Record explicit platform, current-context defaults and why a candidate wins; ties are uncertainty, not permission to use lexical order as intent.

For the first project viewer and request form, canonical typed controls can invoke shared base owners directly. A broad language-routing rewrite is not necessary to list/inspect/select/save those records. Put the discovered parsing/ranking concerns in a bounded subsequent work package unless an existing Chat activation regression makes a specific fix prerequisite. Retain both valid-positive and contrast fixtures.

### 8. Existing receipt viewer is a reusable primitive, not the requested React component

I independently found [service.file](C:/Users/pixelcommander/Desktop/RRAABBIITT_v0.9.3/bridge/service.mjs:156): allowlisted completed-receipt files, <=512 KiB, expected/actual hash checks and text/binary behavior. It currently binds host project/workbench state. Reuse its authorization and containment logic with explicit selected scope and paged artifacts.

I have no verified location for the user's intended React CodeViewer. The coordinator's negative finding is properly bounded. Avoid claiming a vanilla `<pre>` is that component or adding an editor dependency by default. This lookup can wait for FR-0002 and does not block first-milestone foundations.

## Agreements worth retaining

- One allocator, one persistence owner, one execution owner; optional engine adapters remain replaceable.
- Numeric IDs are safe integers allocated once. Stream positions/cursors and hashes are separate concepts. Batch reservations matter for mapping, but high-volume tuning is not required for the first request form.
- State revisions reject stale whole-session writes; locks alone do not prevent a stale client from overwriting newer state.
- Selected window context and immutable execution context are separate. Switching project never retargets an accepted run.
- Source configuration and memory snapshots have explicit authority; preview must not manufacture a second writable settings owner.
- Local cooperating-process guarantees do not imply safe distributed writes on UNC/mapped network storage.
- Read adapters preserve historical bytes/IDs; no dual-write migration or silent suffix stripping.
- Whole-dataset serialization must be removed end to end before claiming streaming. This remains later work under the chosen milestone order.

## Recommended comparison-plan sequence

1. Agree shared descriptor/role, numeric allocator reservation, storage scopes, versioned reader/continuation semantics and optimistic session revision API.
2. Deliver nonmutating project list/inspect, explicit activation/resume/new action/new session through one owner, and application request create/list through the same descriptor/persistence conventions. Verify two windows and original history preservation.
3. Keep generated-code preview, streamed audits and indexed mapper/batching as separate scoped follow-ons. Their contracts reuse these foundations. Prompt button is excluded entirely from this round.

No additional user-blocking question from this lane for the selected first milestone. The user explicitly resolved deployment: local per-user `.rab`, one computer per home. Shared multi-host storage and synchronization are outside this plan; a UNC audit source does not change storage ownership.

Review limitation: source inspection and primary-source research only. No implementation test or performance measurement has been performed for these proposals. Counterexamples and thresholds in the pipeline lane are proposed acceptance checks, not reported passes.

## Final compared-plan review

Read [comparison-plan.md](../comparison-plan.md), [coordinator review](coordinator.md), [identity review](identity-storage-review.md) and the completed [user answers](../questions.md). **No material contradiction or blocker found for the proposed first milestone.** This is a planning verdict, not authorization to edit shared source or a claim that implementation passes.

The compared plan resolves the earlier legacy-writer concern: explicit Resume-for-work creates one numeric continuation linked to unchanged original history, with idempotent mapping and reset approval. Numeric lifecycle adoption must be coherent through actions, steps, turns, nested attempts, receipts, failures, endpoints and UI references. Historical evidence retains its explicit v1 protocol; representative existing audit compatibility is a first-milestone test, while numeric evidence v2 remains later work. Work controls wait for that integrated slice.

The chosen order is consistent with the user's answers: foundation, project/request storage and read-only inspection, coherent continuation/selection, UI/canonical wrappers, then independent acceptance review. The mapper, process pool, streaming engine, broad taxonomy, prompt feature and code-viewer search are not prerequisites for the selected first milestone. Mixed-project result policy is an explicit foundation seam; its full expanded behavior belongs to the scheduled follow-on unless enabled earlier.

Accepted and incorporated identity-review corrections into the live pipeline draft:

- Root-bundle-wide sequence and explicit scope/root/producer locators, with producer validation.
- One reconciled completion decision across artifact sealing and terminal execution persistence; a crash between them cannot become false success.
- Verified/explicit root relocation; coincidentally equal paths/content do not prove lineage. Unavailable source is not deletion.
- Reference promotion and scratch cleanup serialize through the memory owner, preserving retained evidence.
- Numeric evidence validates immutable ID-to-fact bindings and relation endpoints as well as semantic content; ignoring IDs in hashes alone is insufficient.
- Allocator durability is a proposed contract requiring tests, with explicit allocator -> project -> run lock order.

Future role remains independent acceptance review. Source writes are not currently dispatched. If tests are later assigned, use exact dedicated filenames under the agreed test scope; do not edit shared owners or another author's tests. Remaining schema/address decisions are engineering work against current rules, not unanswered user questions.

## Implementation dispatch after user GO — numeric runner

The coordinator relayed explicit GO and later corrections: no legacy saved-project/session adapters or migration; old test data may be ignored without deleting it. Code review/viewer is fully deferred. These instructions supersede the earlier proposed continuation work; the research above is retained as the decision record rather than silently rewritten.

Assigned write scope: `bridge/tool-house.mjs`, `bridge/tool-tracking.mjs`, `tests/project-lifecycle/numeric-runner.test.mjs`, and this review. Coordinator owns memory, planner, service, UI, contract sidecars and existing tests. Identity lane owns pure ID/descriptor helpers. No service restarts or existing test-folder deletion.

Accepted seam: `memory.allocateId()` / `memory.allocateIds(count)` are async and share the local owner. The runner creates allocation memory even without a selected project; project operations remain separately guarded. Children share `__rab_run.memory`. `newExecution({id,key,parentExecutionId})` requires an already allocated positive safe integer and produces `tool-execution/v2`; task identity reuses that same attempt ID. Tracking timestamps, parent relations, result references and error handling retain their existing roles. No secondary allocator, legacy adapter or streaming change is included in this patch.

Changes staged: numeric execution/task creation and six dedicated tests covering validation, projectless nested/concurrent/input-resolver calls, separate runner instances, terminal failures, project report persistence and partial failed composites. The constructor validation test passed. Integration tests await the shared memory API; no complete-pass claim yet.

Verification update: after the coordinator's memory API landed, `node --test tests/project-lifecycle/numeric-runner.test.mjs` passed **6/6** in approximately 4.3 seconds. All three changed/new JavaScript files passed `node --check`. The integration suite confirmed numeric sessions/attempts, shared parent/task references, retained failure evidence, one composite report and unchanged source content/mtime. No allocator collision/durability guarantees beyond the tested runner integration are claimed; the identity owner's tests cover that protocol.

An optional existing seat-scope regression invocation using an isolated temporary RAB_HOME and guarded shell cleanup was rejected before execution by automatic approval review: "blocked by policy", with no more specific reason supplied. It did not run; no alternative route was attempted. This is a recorded verification limitation, not a failing product test or a request for another agent to bypass the rejection. The six dedicated integration tests above already exercised nested seat behavior successfully. Numeric runner files are ready for handoff; no broader test pass is claimed.

Nonblocking findings sent to the coordinator for its ownership:

- Existing `newExecution` test callers without allocated IDs: `tests/audit-tracking.test.mjs:154` and `tests/fixtures/rab-memory-concurrency/worker.mjs:23,26`.
- Old expectations: tracking v1 at `tests/audit-tracking.test.mjs:58`, and literal `parentTaskId === 'task-1'` at `tests/turn-checker-v085.test.mjs:169`.
- `bridge/tool-tracking.contract.json` still describes string execution/session IDs and v1; coordinator accepted the sidecar update.
- The package's current test glob includes only top-level test files, so the dedicated nested suite must be invoked explicitly until its owner adds the intended suite command.

### User emphasis: folder index and bounded folder-loop runner

The coordinator relayed the user's request to put extra effort into a folder indexer whose numeric folder IDs drive result recording, specifically to reduce memory use, oversized strings and hung processes. Finish the numeric runner handoff first. No indexer filenames or memory sink implementation are assigned to this lane yet; the following is a proposed interface for coordination.

Keep metadata/identity/result ownership in rab-memory and actual tool invocation in Tool House. A minimal memory-owned sink should reserve a bundle by numeric execution ID, expose `await append(record)` with byte/field/depth limits and backpressure, publish committed offsets plus a bounded status, read bounded pages/cursors, and finalize once with terminal status. Root-bundle sequence and producer IDs distinguish record location from entity identity. Final output is a small bundle reference, never collected rows. The sink's underlying writer is not a second report writer; it is the result owner's incremental implementation.

The mapper yields folder observations `{id,parent_id,path,status}` as a documented projection and stores root scope/version in the manifest. Use `fs.opendir` incremental entries and a disk-backed pending-folder queue: enqueue discovered directories without retaining the entire frontier or opening all descendant handles. The queue reader follows committed offsets with a bounded line buffer. Reserve folder IDs in bounded batches through the same allocator. Empty, denied and excluded folders remain distinguishable; link policy is explicit and audited input stays unchanged. Initial complete map versions may be immutable; stable identity reconciliation across refreshes is a separate declared capability, not implied by numeric IDs alone.

The batch coordinator consumes the sealed folder iterator as `for await` with bounded concurrency (initially one), resolves each numeric ID against that pinned map, invokes a declared direct-folder adapter through the runner, and appends bounded per-folder outcomes. A ordinary recursive folder tool is incompatible with this mode; do not invoke it at every parent. Whole-project tools run once. Support direct-file enumeration or a pinned file-inventory cursor so filename/extension counts need no full-file parsing. High-cardinality counters spill through bounded reducers; no unbounded object keyed by every extension/class is hidden in a summary.

Cancellation/time limits need a checked signal between entries and awaited writes, plus a supervisor for uncooperative parsing. `Promise.race` alone does not stop work or release resources. A cooperative iterator timeout records interrupted/partial status; arbitrary synchronous tools require an isolated worker/process that the existing runner can supervise before any hard timeout guarantee. Distinguish heartbeat from actual progress and keep status reads responsive. Persist completed folder units before advancing the recovery cursor; uncertain unit outcomes remain explicit, with retry restricted to declared safe reads.

Required bounded tests: huge sibling directory and deep tree without retained frontier/handles; synthetic 100k/1M records under configured record/queue/page limits; no duplicate descendant reads; invalid recursive capability rejected; empty/denied/link coverage; cancellation, blocked sink and worker timeout; partial results readable after interruption; two child producers and root-wide sequence; unchanged audited source. Byte growth, queue peaks and memory need measurements, not an assertion that folder IDs alone solve long strings.

## Folder index / folder-ID batch implementation and handoff

The coordinator subsequently assigned a real bounded implementation under these exact paths:

- `bridge/rab-folder-records.mjs`: private persistence adapter composed by rab-memory, not a separate root/registry or public writer.
- `tools/audit/_folder-index.mjs`: incremental folder traversal using the disk queue.
- `tools/audit/_folder-batch.mjs`: sequential folder-ID coordinator and supervised child execution.
- `tools/audit/_folder-batch-worker.mjs`: bounded private protocol invoking the existing Tool House runner.
- `tests/folder-index/folder-pipeline.test.mjs`: isolated integration/failure/scale fixtures.

No additional edits to tool-house, rab-memory, registries, public stamp folders, services or UI were made in this lane. The coordinator composed the adapter into rab-memory and owns the canonical public wrappers. It also added `reservedExecutionMemory` to tool-tracking; the worker now reuses that consume-once reservation helper instead of duplicating its logic.

### Current implementation contract

`createFolderRecords({rabHome,allocateId,allocateIds,projectDirectory})` exposes `createFolderIndex`, `createFolderBatch`, `readFolderRecordPage`, `getFolderRecordStatus` and `iterateFolderIndex`. The supplied project-directory resolver validates the numeric project through the existing memory owner. Results stay under `.rab/projects/<project-id>/indexes/<index-id>/` and `batches/<batch-id>/`. Each has a common house settings descriptor using `meta.kind: execution`, an explicit folder-index/folder-batch role and numeric project parent, plus separate mutable state and JSONL records. Indexes also keep `pending.jsonl` as their disk queue.

The source is walked with `opendir`/incremental reads, one open directory at a time. Pending descendants are appended to disk, not collected in an array or retained directory-handle stack. Folder IDs come from bounded batches of 32 shared reservations; gaps are allowed. Records retain relative paths and numeric parent IDs. Empty/scanned, excluded, unavailable and unsupported/link entries have distinct outcomes. Default excluded directory names are `.rab`, `node_modules` and `.git`; the resolved memory directory is excluded too. Source paths are checked for links/junctions, containment and current directory availability. This is observed filesystem state over an interval, not an atomic source snapshot.

The record encoder checks depth, node count and string sizes before JSON serialization. Maximum encoded record is 64 KiB; page limit is 100 rows and 256 KiB. Reads maintain a fixed 16 KiB block cache and a bounded record buffer. The sink permits one awaited operation at a time and rejects concurrent append attempts rather than building a hidden promise queue. Checkpoints sync records/queue before atomically publishing committed offsets; readers ignore an uncommitted tail. A failed storage append is not converted into a source-coverage skip. Failed metadata publication propagates and cannot claim successful completion.

`buildFolderIndex({memory,projectId,folder,signal,maxDurationMs})` returns a small `{reference,state}`. Index status/progress updates after each folder and every 128 entries inside a large folder. Inaccessible queued folders produce explicit partial coverage. Cancellation/time-limit states remain readable and are not eligible for a new batch as if the index had completed.

`runFolderBatch({memory,projectId,indexId,root,toolsRoot,toolKey,options,signal,timeoutMs,maxDurationMs})` accepts only a sealed completed/partial index and a declared `meta.input_scope: direct-folder` read/pure tool with a folder input. Its first supported form is a leaf direct-folder tool. Ordinary recursive tools are rejected. Each eligible folder runs once at concurrency one; skipped/unavailable folder outcomes remain visible. Input options cannot override the folder chosen by the pinned index. A source path replaced with a junction is rejected before that folder's tool invocation.

The coordinator allocates a numeric attempt before spawning its private worker, publishes that ID in progress, and the existing Tool House runner consumes the reservation once. Each committed folder result includes actual execution statistics where available. If the worker dies before returning those statistics, the numeric attempt remains interrupted with unknown runner timestamps; separately named process timing describes the measured supervisor interval. This avoids inventing a successful end time.

The worker has a 96 MiB V8 old-space limit, a per-folder deadline, cancellation termination and a separate whole-batch deadline. This heap limit is not a promise that total process RSS stays below 96 MiB. stdout/stderr are ignored rather than buffered. IPC requests are <=16 KiB and responses <=48 KiB. Oversized returned data becomes a bounded recorded failure. The parent waits for child closure, so a timer left open by a tool cannot keep the batch hung after a result. A private shared fingerprint function pins the tool's settings and executor; it does not claim to fingerprint an entire transitive import graph.

### Verification on the final implementation

`node --test tests/folder-index/folder-pipeline.test.mjs`: **15/15 passed**, about **16.54 seconds** total. All five assigned JavaScript files passed syntax checks. The tests use the production memory facade, isolated temporary projects, synthetic rows and fixture tools; no real-drive scan or service restart was performed.

The final scale check streamed and paged **100,000 records / 32,077,785 committed bytes**, measured **34,410,496 bytes RSS growth** after the configured warm-up (below the test's 64 MiB bound), and observed a **32,268-byte largest page**. That test took about **10.12 seconds**. These are one local-run measurements, not universal performance guarantees. A million-record run was not performed.

Behavior checks covered: numeric parent relationships; empty and excluded folders; symlink/junction boundaries; direct-file exactly-once totals; 141 folders across a wide/deep fixture; vanished queued folder as partial coverage; rejection of recursive/unscoped tools; oversized child output; real child heap exhaustion; a CPU-stalled worker; cancellation; process crash; lingering timers; per-folder versus whole-batch deadlines; tool-settings changes; storage-error classification; explicit backpressure; scoped cursors; committed boundaries and uncommitted crash tails; unchanged source/outside-marker content and source mtime.

An earlier version passed 11 tests and then 15 tests, but review caught repeated reads of the same disk blocks. The fixed-size read cache removed that avoidable I/O while retaining bounded memory. The final command above reran all tests after that change and after adopting the shared reservation helper.

### Deliberate limits and follow-up work

This is a new bounded folder pipeline, not a conversion of every existing audit engine. Stable folder identity reconciliation across refreshed indexes, rename inference, incremental watchers, arbitrary composite/direct-file streaming adapters, high-cardinality exact reducers, an import-graph fingerprint, and automatic crash resume remain later work. Each current index is a separate pinned observation/version. Child heap/time limits protect the parent but do not turn arbitrary Node tools into an OS security sandbox; declaration and source ownership still matter.

Index traversal cancellation is cooperative around filesystem operations; an unresponsive OS/network filesystem call has no hard-cancellation guarantee in this implementation. Hard termination is implemented for batch child workers. Unexpected death of the whole coordinator leaves the last committed state/tail for inspection; automatic owner-liveness reconciliation/replay is not implemented or claimed. Current rows do not provide arbitrary random access by folder ID; the batch consumes a bounded sequential cursor.

Public wrappers and UI exposure are coordinator-owned. At this handoff, their final behavior is not established by these engine tests; the coordinator must inspect generated wrappers and run its isolated end-to-end path. No code viewer, saved-state migration, broad engine rewrite, or automatic cleanup was added.

## Public wrapper review and evidence regression follow-up

The coordinator assigned read-only review of `audit/count/folder-entries`, `audit/index/folders` and `audit/run/folder-index`, plus numeric/fresh-storage fixture updates only in `tests/audit-evidence/**/*.test.mjs` and `tests/audit-evidence.test.mjs`.

Wrapper review found no protocol blocker: the entry counter reads one directory with opendir and returns scalar counts; the index/batch wrappers validate numeric IDs through the memory owner and return small references/states. The wrappers use the canonical tool catalog. They do not currently pass an AbortSignal, so tested engine cancellation is not a claim that public UI/API cancellation has shipped. The coordinator owns its public/API end-to-end tests and contracts.

Updated evidence fixtures use numeric project/session/execution identities and fresh numeric storage paths from the allocator/owner. UI harness selection and stale-session cases now exercise numeric IDs too. Evidence entity and plan IDs remain their v1 strings; deterministic identity, relation integrity, immutable evidence, stale-source refusal, approval gates and verification assertions remain intact. Added a narrow check that invalid execution references fail while v1 entity identity stays valid. The top-level evidence entry creates an isolated temporary RAB_HOME and restores/removes only that verified test home on completion.

First focused run, before the additional narrow reference check: `node --test tests/audit-evidence.test.mjs` passed **32/33**, about **47.5 seconds**. The remaining failure is a source integration mismatch, not a weakened/removed test: `tools/audit/inspect/class-impact/settings.json` still declares `writer_execution_id` as text while `bridge/audit-investigations.mjs:64` passes the numeric writer attempt to verification. Failure is `INVALID_INPUT: writer_execution_id must be text` in the full approved-write/verify workflow. Reported to the coordinator, preserving the failing assertion and staying out of shared source. Final verification follows its source correction.

Resolved: the coordinator changed that setting to number. The exact failing workflow rerun, `node --test --test-name-pattern='saved investigation, declaration' tests/audit-evidence.test.mjs`, then passed **1/1** in about **8.44 seconds**, including actual approved fixture write, verification, retained history and handoff. The records/verification subset also passed **11/11**, including the new invalid-execution-reference check. The complete evidence suite now registers 34 tests; the coordinator owns the next combined run, so this handoff does not invent a fresh 34/34 full-run result. No source edits were made by this regression lane. Assigned test files are released for integration.

## Windows active-security verifier follow-up

Assigned sole source owner: `tools/security/_verify.mjs`, plus this note. No test files, lock helper, service, server, registry or other production tool changed in this follow-up.

The Windows project-override probe now creates a directory junction; other platforms retain their directory-symlink probe. The Windows DOM-write probe reaches the same outside `Outside.tsx` through a parent-directory junction. Other platforms retain the file-symlink variant. Both original containment codes remain required (`INVALID_PATH` for override, `BAD_REQUEST` for DOM); DOM also verifies the external file's exact bytes remain unchanged. Report details explicitly name the variant/link type and set `file_symlink_exercised: false` on Windows. No privileged file-symlink test is skipped and relabeled as passed. The HTTP verifier's server now uses `.rab` inside its owned disposable fixture.

Initial assigned-suite run: `node --test tests/dom-edit-security-v085.test.mjs tests/full-house-v085.test.mjs`, with a distinct temporary RAB_HOME, passed **8/10**. The junction probes executed successfully. Both failed top-level cases reported the same four HTTP subchecks receiving 404 instead of stale/replay 409 and receipt 403. Inspection found obsolete fixture setup: manual workbench prepare now requires a canonical command, but the verifier still posted text and answered the retired `react-project` stamp. A failed answer replaced the run with an error object, producing subsequent `/api/runs/undefined/...` requests.

Within the assigned verifier file, replaced that setup with a canonical `react/stamp-new-component` request in a newly allocated fixture-local output folder, answered its actual missing name, retained a constant run ID, and added explicit prepared/ready/completed prerequisite rows. The original stale revision, replay and receipt-containment expectations are unchanged. If setup fails in future, it is reported directly instead of being mistaken for a security-boundary result. The coordinator confirmed this repair scope.

Second combined run: **9/10**, about **58.8 seconds**. **Both active security-verifier tests passed all their probes.** The separate generated-component editing test encountered `EPERM` creating the shared isolated home's `.memory-locks/home`, at `bridge/rab-memory-lock.mjs:14`, via registration/usage-ledger finalization. That case had passed the previous combined run. It subsequently passed **1/1** when run alone in a new isolated home (about **5.2 seconds**). Windows lock-directory contention is a plausible explanation, not a proven root cause. The failure was reported to the coordinator; no lock-source edit, assertion weakening or claimed clean combined pass was made here.

The isolated suite homes were retained for inspection rather than adding shell cleanup: `rab-security-suite-dd2ef9c6ec534de0aaeded55bf906551`, `rab-security-suite-c79dc6df1ff44ccaa0fb55610e9de41a` and `rab-security-case-63edc794bcf648fe94ac866a0504ebc2` under this user's temporary directory. Verifier-owned fixtures still use their existing cleanup. Syntax check passed. The source file is released back to the coordinator for integration; the shared-lock finding remains recorded for its owner.
