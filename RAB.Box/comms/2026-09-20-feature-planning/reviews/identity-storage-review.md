# Cross-review from identity/storage

Date: 2026-09-20. Reviewed: `lanes/ui-routing.md` independent draft and updated `questions.md`. Pipeline draft not yet available at time of this first review. No product changes.

## Agreements with explicit acceptance boundaries

- Preview and activation must be separate. Existing openProject writes, so a new read-only inspection path is necessary, not simply hiding the Resume button.
- One request lifecycle with typed views fits the common descriptor. Retain FR/TR identifiers as provenance labels; new record IDs are numeric and are not allocated by the browser.
- Running jobs pin context, windows select context. Add expected-revision checks for concurrent edits to the same session: locks alone do not prevent stale snapshots overwriting newer work.
- Plan-only support must be declared and use the actual renderer. A temporary output directory is not a sandbox and cannot neutralize arbitrary absolute writes or external effects.
- UI child rendering can be shared while typed runtime payloads differ. Repeating settings.json must not mean copying histories or forcing task folders.

## Conflicts / revisions needed for synthesis

1. **Disposable project recommendation superseded by user answer.** Prefer supported code preview and `.rab/temp/test/<numeric-id>` template artifacts. Do not register temporary output as a normal project by default. My initial apps/<id>/tests path is also superseded and has been updated. Same memory owner handles transient scope.
2. **Prompt section is historical research, not active scope.** User has deferred further prompt design/research. Exclude it from execution phases and outstanding user questions for this round.
3. **Identity selection needs an adapter boundary.** Stable existing project keys may contain a source-path hash. Preserve those for v1 access; new numeric project IDs must not acquire a new identity after source relocation. A dropdown selection key is an address to a record, not permission to use stale source settings.
4. **Request type is not project type or tool domain.** Common descriptor + typed validator preserves meanings. `meta.kind` (proposed role) distinguishes request/project/tool/category; request type=feature does not rewrite type=react semantics. Unknown fields/roles should fail validation rather than dispatch via UI labels.
5. **First milestone must not swallow global migration.** Project inspect/switch and requests need common core, allocator, activation and v1 readers. They do not require mapper, streaming, every evidence-ID conversion, or task folders. New-session/action paths need a coherent version boundary before being advertised as numeric v2.

## Additional tests for UI lane

- Save a request, retry the same submission after a lost response: return the original record, not a second ID. Use a bounded operation reservation handled by the same owner; never deduplicate solely by equal title/description because two intentional requests can match.
- Two windows edit one session from the same revision: one save succeeds, the stale one reports conflict. Switching a window does not resolve that conflict by rebinding the run.
- Preview unavailable/corrupt source settings: show unavailable and historical snapshot separately; do not manufacture live metadata or create missing folders.
- Inspect a category with settings.json and inherited executor: viewer renders it but no Run action or execution is permitted.
- Clear scratch output with a referenced durable receipt: explicit lifecycle policy retains receipt/provenance and marks deleted artifact unavailable; do not let Clear erase arbitrary external output.

## Primary-source connection

The JSON Schema default distinction is correctly used in the UI draft: annotations can drive forms but do not establish house inheritance or authority. Keep the binder as the owner. [Official annotations reference](https://json-schema.org/understanding-json-schema/reference/annotations)

## Pending

Cross-review `lanes/audit-pipeline.md` when available, specifically ID/sequence boundaries, pinned map references, short lock duration and v1 evidence compatibility. One consequential deployment question remains for coordinator: one writer host vs independent concurrent hosts sharing .rab; this changes allocation/locking guarantees and cannot be inferred from a UNC source path.

## Pipeline cross-review completed

Read `lanes/audit-pipeline.md` independent draft after publication. Also directly checked `tools/audit/_evidence/records.mjs:13` and `workflow.mjs:60-66`: the reported hash-derived identity and identity-inclusive fact re-derivation are real compatibility seams. Existing validator must remain versioned rather than simply replacing identity() with allocation.

### Strong agreements

- Root execution owns a serialized bundle, child records carry actual producer identity, stream sequence is position, mapped folder ID is identity, checksum is integrity. This cleanly separates the questions the UI needs to answer.
- Short admission/metadata locks and per-run append ownership preserve responsiveness without bypassing rab-memory. No long project lock around a whole scan.
- Persist identity assignment observations. Rebuilding a derived path lookup must recover assigned IDs, not mint new ones. Pin old audit references to map version and folder ID.
- Bounded records are insufficient if the reducer, trace, seat promotion, JSON stringify or HTTP response still accumulates everything. The pipeline draft correctly covers these hidden paths.
- Preview versus written output are different evidence states. Clear display, scratch artifacts and source removal require distinct semantics even if the UI stays simple.

### Changes/clarifications before implementation

1. **Scheduling:** the pipeline's stages 0–2 are a later vertical slice, not the user's selected first milestone. Put project switching/request page first. Preserve the streaming work as a concrete follow-on rather than making it a foundational prerequisite.
2. **Sequence namespace:** make source locators explicit about root bundle ownership and producer. Proposed locator `{scope, root_execution_id, producer_execution_id, sequence}` uses sequence unique within root bundle; consumers validate that the addressed row's producer agrees. Alternatively make sequence per child and declare that choice consistently. Current prose could be read either way. Do not resolve child execution plus bare sequence against whichever root is active.
3. **Terminal publication recovery:** sealed manifest and execution state are separate writes. If crash occurs between them, expose finalizing/interrupted until the owner reconciles; a sealed file alone must not override a failed/unknown run. Store one completion decision or idempotent commit receipt linking both. This is a recovery protocol, not two independent lifecycle authorities.
4. **Root lineage:** do not infer a root move from identical content, title, or coincidentally equal relative paths. Reuse a root-folder numeric identity only with verified/explicit relocation; retarget to a different source starts a new root lineage. Old map references retain their observed root, not today's binding. A missing drive/share is unavailable, not proof all folders were deleted.
5. **Scratch retention versus retained evidence:** durable reports cannot safely point to disposable content that Clear test is allowed to remove. Either promote referenced content through the same owner with immutable provenance, or retain it and make cleanup say why. Test the race where a durable reference is added during cleanup: both operations must serialize via the storage owner. Tombstones are acceptable only when evidence loss is explicitly allowed, never proof of retained verifiability.
6. **Numeric evidence validation:** compare canonical semantic facts independently of allocated IDs, but also validate the immutable ID-to-fact association and relation endpoints. Ignoring all IDs in the digest alone would allow swapping an entity ID while changing the interpretation of declarations/plans. Preserve v1 exactly; v2 needs both association integrity and source verification.
7. **Allocator claim wording:** safe-integer high-water allocation is an agreed proposed interface, not a tested implementation yet. Durable acknowledgement, corrupt-state handling, imported-ID admission and lock ordering are part of its acceptance criteria. Root reservation must not call the allocator while holding a project lock in conflict with the global lock order.

### Additional falsifiable scenarios

- Child A and child B each emit a first row: every reference resolves the intended row, including after browser project switch and reopening by old reference.
- Kill after segment seal but before execution terminal update: reopen cannot claim success until reconciliation validates the completion decision.
- Delete only a derived folder lookup and rebuild: all historical folder IDs and old map references remain unchanged.
- Retarget source root to a different folder with identical relative paths: old audit links do not silently reinterpret their source.
- Scratch cleanup races with durable evidence promotion: retained evidence is valid or operation explicitly refuses; never dangling proof presented as verified.
- Swap numeric entity IDs without changing textual facts: v2 relation/declaration binding validation rejects it, while legacy hash-ID reports still load unchanged.

No additional user question is required for these engineering choices. The single-writer deployment assumption remains the only identity/storage question needing the coordinator's decision or user confirmation before rollout.

## Coordinator follow-up: narrowest coherent first-milestone seam

Recommendation: **read old sessions in place; fork their mutable continuation once into the new numeric session format on the first explicit Resume-for-work operation.** Do not keep writing legacy sessions from the new UI. Project inspection and history reading remain write-free. Existing project storage/key/source settings are not renamed or regenerated. Category discovery, tool descriptor rollout, mapper and global generator migration are not prerequisites.

### Three operations, not one overloaded load

1. `inspectProject` / `readSession`: read current source metadata and saved v1/v2 records without calling openProject, ensureHome or any updater. Return an explicit unavailable/snapshot distinction. These APIs need no new ID.
2. `activateProject(..., mode=resume)`: select an existing v2 session, or create one numeric continuation for the chosen legacy session under a short owner transaction. Return selected context and its revision. Resume is explicitly a state-changing control; simply viewing history is not.
3. `newSession` / `newAction`: create numeric identities through the allocator. New session retains project defaults only. New action operates in a v2 session and clears action-specific state. When invoked from a legacy view it first uses the same continuation owner, never a parallel legacy writer.

A v2 session under a legacy project does not require changing the project's historical ID. References need a tagged legacy arm, for example (PROPOSED):

```json
{
  "version": "rab-session-state/v2",
  "id": 1789920825355,
  "project_ref": {
    "version": "legacy-project-ref/v1",
    "key": "<existing verified memory key>",
    "id": "<original project id>"
  },
  "continued_from": {
    "version": "legacy-session-ref/v1",
    "project_key": "<existing verified memory key>",
    "id": "<complete original session id>"
  },
  "revision": 1,
  "groups": [],
  "steps": [],
  "turns": []
}
```

Strings here are explicitly references to existing v1 identities, NOT newly allocated v2 IDs. Descriptor parent uses the same tagged reference union. The memory adapter verifies project_key/id correspondence; no browser path is trusted. Keep existing project meta.id when invoking current tools that expect it. A later explicit project adoption can add a numeric identity mapping without changing this original reference. Do not call the old project numeric-v2 just because its new session is numeric.

### Carry work forward, not rewritten history

- Historical turns/results stay in the original file; the continuation links them for the timeline. Do not copy all old turns and pretend they were created with new IDs.
- For an unfinished selected group, allocate a new numeric group and only the live unresolved steps needed to continue it. Record each imported step's scoped legacy origin. Rebuild links to the newly allocated group/steps; references to completed historical outputs remain tagged legacy references through the existing bounded reader.
- Carry user-entered answers only when their field contracts still match. Re-resolve tool/path/config and invalidate old prepared approval. Do not carry executable/approved status forward. In-flight or uncertain attempts stay attached to old context and require outcome reconciliation; continuation does not replay them.
- If a pending shape cannot be converted safely, show its old context and offer a new action, rather than drop it silently or claim seamless resume. Completion of the milestone requires a representative pending-step continuation test.
- Store one durable continuation/cutover record keyed by the full legacy project/session identity with source revision/hash. Duplicate Resume requests return the same continuation. After cutover, this application refuses mutation of the old session and returns the continuation reference. If an older process changes it externally, detect fingerprint mismatch and stop continuation import/reconciliation; do not merge silently.
- Read source config again on activation. Project defaults may refresh; old action targets and approvals do not become defaults. Window selection is separate from the durable cutover mapping.

### Minimum integrated mutation surface

The shared integration owner must update these as one bounded vertical slice, not necessarily every tool generator:

- `rab-memory`: version-dispatched read/find/list/save; numeric folder sessions; continuation transaction; expectedRevision; new-session and lifecycle allocation. Keep read inspection separate from current mutating load helpers. Numeric paths are decimal strings at filesystem boundary only.
- `service`: session ID validation at turn/yolo/execute/toolsRun and other adopted routes, including strict parsing of URL query text into safe numeric IDs. Legacy session strings accepted only by the legacy resolver; do not indiscriminately Number() all strings. No automatic old-session mutation from config lookup.
- `session-planner` and `project-conversation`: all group/step/turn creation branches in the adopted lifecycle use the injected ID owner, including copied project-load turns and language-repair turns. Updating only planner.newSession leaves known string-generating paths behind.
- `tool-house` / `tool-tracking`: allocate numeric attempt before dispatch; nested children reuse the same allocation owner. Numeric tracking schema version records scope and parent attempt. Retained trace task IDs should reuse the attempt ID if that trace row is the same attempt, or get a distinct numeric allocation if semantically separate; no persisted task-N string in the new lifecycle contract.
- Receipts/failures emitted by that lifecycle: replace planner's `tool-${execution_id}` and timestamp-hex failure identities with numeric values through their owner; preserve old readers. Report artifact filenames may reuse their owning execution ID when one-to-one, rather than become another identity generator.
- UI/presenters/readers: accept versioned number/string references without coercion-based equality; sorting uses timestamps plus numeric ID for v2, not universal lexical sorting. Selected session and operation revision accompany requests.

Direct source check identified string-only gates in `service.mjs:185,201,206,239`, `rab-memory.mjs:282`, and `audit-investigations.mjs:17`. The latter can remain a legacy-only feature in this first slice only if unavailable from v2 sessions with a truthful compatibility message; otherwise its session gate must be adapted. Do not widen a regex and call the integration done.

The original evidence tools may still return their explicitly v1 hash-identified payloads. That is a legacy artifact protocol boundary, not permission to mark the entire audit/evidence subsystem numeric-v2-ready. New lifecycle identities around it are numeric. If full numeric identity for all newly generated evidence is required before any audit can run, gate those tools in v2 until their separate adapter is delivered; do not silently mutate v1 evidence or invent numeric IDs inside a generic result serializer. No category/tool-stamp migration is required to list/select an existing tool by its already numeric ID.

### Delivery gates

First UI increment can expose read-only project preview/history plus numeric request creation. Enable Resume-for-work/New session/New action only when the above lifecycle seam passes: resume same legacy session twice yields one numeric continuation; original bytes unchanged; pending step retained with approval reset; all new lifecycle IDs (including nested attempts, receipt and failure) are numbers; old refs resolve; conflicting/stale saves fail; no in-flight run retargets on project switch.

This keeps the dependency real but bounded. It does not pretend a request form needs a complete house migration, and does not label a mixed, partly converted active session as complete v2. Root owns eventual source integration. New pure contract modules remain unimplemented until explicitly assigned.

## Deployment question resolved by user

Coordinator relayed explicit answer: .rab is created on first run in the executing Windows user's profile, `C:/Users/<current-user>/.rab`; one computer owns each .rab for now. This resolves the earlier writer-host question. Cooperating local processes/windows are in scope, independent cross-host shared writes are not. Preserve explicit test RAB_HOME override without silently changing production location. First-run initialization is an intentional startup operation; ordinary preview on an initialized app still must not mutate project/session state. No identity/storage user-blocking questions remain for this planning round.

Direct follow-up clarification from user: this is a local audit tool; each computer's work/history is independent. Do not plan server/shared storage or cross-computer synchronization yet. Prior distributed-storage discussion is comparison context, not a delivery dependency. Coordinator notified.

## Controlling scope correction and implementation handoff

Later user direction relayed by coordinator: discard legacy saved-project/session compatibility and migration work; old test data is disposable. Do not implement continuation adapters. Code reviewer/viewer is deferred completely. This supersedes the legacy-continuation recommendations above, which remain historical planning text. No historical data was deleted by this lane.

Authorized bounded implementation completed in:

- `bridge/rab-id.mjs`: `assertNumericId(value)`, `reserveIdRange({highWater,count=1,now=Date.now()})`, `MAX_ID_BATCH=10000`. Returns `{ids,start,end,highWater}`. Requires explicit nonnegative safe highWater; ID values are positive safe integers. Handles repeated/backward clocks and exhaustion without coercion. Pure math only: calling twice with unchanged highWater deliberately yields the same result; caller must serialize/persist before acknowledgement.
- `bridge/rab-node.mjs`: `NODE_VERSION`, `NODE_KINDS`, `assertNode(node)`, `makeNode(input)`. Common house keys, meta.kind, typed project/request extension checks, numeric parent refs, unique input declarations. Fills undefined construction defaults only; preserves false/0/empty-string/null values where valid. Detached JSON-safe output, rejects lossy values/accessors/cycles/unsafe keys. No filesystem, allocation side effects, legacy refs or execution authority.
- `tests/identity-storage/rab-id.test.mjs` and `rab-node.test.mjs`: 14 tests, all passed via `node --test tests/identity-storage/*.test.mjs` on 2026-09-20. Tests cover deterministic range math, boundaries, JSON numeric round trip, descriptor construction/validation, defaults, extensions, declaration uniqueness and invalid data.

Root accepted this API before handoff. No shared source edited, no data deleted, no dependencies/services started. Integration still must test durable reservation, process concurrency/crash behavior, memory ownership and adopted lifecycle. Isolated pure-module tests do not establish those guarantees. Standard npm test currently lists top-level test globs; coordinator must explicitly include this nested suite in integration verification (this lane does not own package.json). Available for next explicit assignment; UI not started.

## Independent integration review after UI handoff

Review-only inspection of current memory/service/planner source on 2026-09-20. Source is being integrated concurrently by root; findings refer to the inspected state and require root retest after fixes. No source edits in this review pass.

### Material findings sent to coordinator

1. **P1 — Persist an attempt-start state before tool write effects.** In `bridge/session-planner.mjs` execute loads ready steps, calls runTool, and saves the session only on final group completion or caught error. No persisted running marker precedes the effect, and successful intermediate steps are not saved before the next executes. A process crash after effects leaves the disk step ready. After controlled stale-lock recovery, resume merely resets yolo/refreshes settings; confirm can execute it again. Numeric attempt tracking elsewhere is not consulted to prevent this replay. Required fix: durable attempt-start/uncertain state before effects, per-step completion persistence, and explicit recovery rather than re-running uncertain work. Inject failure after a tool writes and before session save; reopen must not present the operation as safely ready. Source-reviewed; no destructive crash test run by this lane.

2. **P1 — Chat project load bypasses the target session operation lock.** `service.sessionTurn` locks the originating session through mutateSession, but `project-conversation.mjs` load obtains another project's last session, appends a turn and calls memory.saveSession on that target without its session operation lock. Meanwhile that target can be executing under its own lock. The appended turn can advance the revision while the execution has already produced effects; its final save then conflicts. CAS catches the late write but does not prevent effects. Route cross-project Chat activation through the shared activation owner or coordinate the target lock with a defined lock order; do not simply acquire A then B in both directions and introduce deadlock. Prefer not adding a synthetic turn to another session merely to record a switch. Test simultaneous A->B load and execution in B with an instrumented pause before the side effect.

3. **P2 — Cold session GET is not read-only.** `service.sessionRead` calls sessions(id), which creates a planner on first access. Planner construction calls memory.openProject and refresh; refresh scans entities and saves RESOURCES. Thus GET /api/sessions/:id can mutate memory and scan the source on a fresh process. The Projects UI restores a per-window selected session using that GET. `memory.inspectProject` itself is read-only, but the combined cold Projects entry is not. Use memory.findSession plus a pure presenter for session reads; construct the mutable planner only for actual work. Test file hashes/mtimes and traversal instrumentation before/after a cold session GET, not only warm projectInspect.

### Confirmed alignment / positive boundaries

- New projectInspect reads source settings and sessions without openProject; project listing does not initialize missing storage.
- UI route bodies agree with numeric IDs, activation modes and expected_revision. Request retry body and submission_key are preserved exactly until successful response; server serializes by app request lock, fingerprints fields and reserves ID before record publication.
- Service normal turn/execute/yolo and project-activation mutation paths take a cross-process session operation lock and check supplied expected_revision before the operation. saveSession checks its own revision under a project operation lock. This protects cooperating routes that consistently use the session lock, not bypass paths described above.
- Numeric project/session folders, typed descriptor and app request scope match the assignment. No legacy adapters or code viewer were implemented by this lane.

### Additional identity alignment observation

For registered external source projects whose existing PATHS project.id is text, initialBag exposes the new numeric memory project ID but service.config/inspect and planner meta retain the source manifest ID. Chat settings and Investigation UI compare those IDs strictly, so they can show no matching current project even though its session loaded. Fresh stamped projects use numeric source IDs and do not have that mismatch. Root should either make the registered numeric identity the service context identity with source identity separate, or explicitly bound unsupported external registration; not label this a request for legacy saved-data migration. Verify the built-in bootstrap/mock source path too. This was source-inspected, not separately reproduced here.

### Verification already handed off

UI/helper focused run: 33/33 passed (`workspace-ui`, existing Investigation UI, identity-storage suites). This includes executing shipped helper/controller slices to prove strict ID parsing, window storage, request retry stability and stale project preview/session response rejection. It is not browser/API integration proof. Broader output-shape tests during concurrent integration exposed numeric execution rejection in class-investigation and string-only report preview expectations; root was notified and owns those fixes.

## Recovery fix verification

Root implemented the reported fixes; this lane independently reread the changed paths and added only the explicitly granted `tests/project-lifecycle/recovery.test.mjs`.

`node --test tests/project-lifecycle/recovery.test.mjs`: **4/4 passed**, approximately 27 seconds, using disposable isolated local homes and source fixtures:

1. A newly constructed service reads an existing session without changing any fixture file bytes or modification times.
2. A deliberately seeded persisted running attempt becomes execution-interrupted on Resume, retains its numeric attempt ID, and execute rejects it with PLAN_GAPS without further file changes.
3. A real count-css-classes execution persists completion with the same reserved numeric ID in step/receipt/execution; reusing the old expected revision is rejected before further file changes.
4. Chat loads another project's saved session without changing that target's state file or revision; switch_message reports the selection.

Source inspection also confirms a running marker is saved before runTool, each successful step is saved before the next, session GET uses pure findSession/presentation, and cross-project Chat load no longer appends to the target. The interrupted test seeds the crash-state fixture; it does not claim an OS process-kill or power-loss experiment. No shared source edited. These address the three material findings from this review; no remaining blocker identified in these fixes.

Nonblocking UI integration note sent to root: new switch_message should take precedence over target last_turn.reply in sessionReply, otherwise the switch can display an old reply or a generic gap message. UI ownership remains released to root.

## Final assigned regression-test lane

Updated only the four granted test files: tests/audit-tracking.test.mjs, tests/rab-memory-concurrency.test.mjs, tests/fixtures/rab-memory-concurrency/worker.mjs, and tests/turn-checker-v085.test.mjs. Production files were not edited.

Fixtures now reserve numeric project/execution/step IDs, include the canonical project ID in source settings, use tool-execution/v2 and sessions/<id>/state.json plus settings.json, and compare nested parent task IDs against the real numeric parent. The cross-process test asserts 72 distinct positive safe numeric session/execution IDs across 24 records. Previously unscoped grid/import runs now explicitly use the fixture-local rab_home.

Retained compact byte limits, full result-reference resolution, timing assertions, untouched source bytes/mtime, concurrent writes, replacement semantics, corrupt-metadata refusal, interrupted-lock behavior, and report-reader containment/size/envelope checks. Because ID reservation creates the lock directory, the cold reader now asserts unchanged home/project entries and allocator bytes, no PROJECT.json, and an empty lock directory instead of asserting that directory never existed.

First run: 23/27, with four fixture setup failures (numeric folders created without allocator state). Corrected fixture reservation and stamped settings IDs; final command `node --test tests/audit-tracking.test.mjs tests/rab-memory-concurrency.test.mjs tests/turn-checker-v085.test.mjs`: **27/27 passed**, approximately 44 seconds. No production failure identified. All execution used isolated temporary homes; no shared services or external cleanup. Ownership of these test files is released to coordinator.

## Additional approved regression lane: project labels and audit fixtures

Updated only tests/audit-project-names.test.mjs, tests/class-index.test.mjs, and tests/audit-expansion-v085.test.mjs. Project-name tests now assert numeric storage with human labels; concurrent duplicates have distinct IDs, ambiguous name-load, and exact ID-load. Previously normalized-colliding names remain distinct labels. Filesystem-unsafe display names cannot escape numeric storage. Seeded legacy named/hash directories and session files remain unlisted, unloadable by name, and byte-for-byte untouched; no migration or continuation is requested. Turn/step references and session directory segments are numeric. Empty-home listing does not create the projects directory.

Class-index fixtures reserve IDs and use memory.paths for saved output locations, retaining bounded tracking records and untouched source bytes/mtime. Nested stamp fixture copies its bridge and engine dependencies alongside tools/language into its isolated temporary root. All previously unscoped tool runs in these files now explicitly pass a fixture-local rab_home. Existing parsing, unresolved evidence, deterministic audit, composition and discovery assertions remain.

First run: 20/21, solely the obsolete assertion that empty-home listing initializes a projects folder. Updated to require ENOENT. Final command `node --test tests/audit-project-names.test.mjs tests/class-index.test.mjs tests/audit-expansion-v085.test.mjs`: **21/21 passed**, approximately 19 seconds. No production files edited or production failures identified. Ownership released to coordinator.
