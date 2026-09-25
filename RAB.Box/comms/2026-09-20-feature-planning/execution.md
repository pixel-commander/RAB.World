# Execution record

User said go after reviewing the proposal. This record governs implementation
where the earlier research proposal differs.

- Fresh records only. No saved-project/session legacy adapters, migrations or
  continuation work. Exclude obsolete test storage from fresh discovery; delete
  only specifically identified obsolete data if needed, never unrelated folders.
- Keep the approved per-user local `.rab` hierarchy and house-shaped descriptors.
- Deliver project switching and the Requests page first.
- Code review/viewer and prompt-button work are deferred. The user will choose
  one code-viewer UI owner separately.
- Give extra attention to a disk-backed folder index and a runner that iterates
  folder IDs and commits bounded results. Include memory and stall tests; indexing
  alone cannot fix an unbounded parser, result object or retained trace.
- Record nonblocking issues here or in linked evidence and continue. Ask the user
  only for an actual blocker.

## Active ownership

- Inspect RRAABBIITT v0.9.3: memory, registration, projects/requests API,
  session/planner integration, UI integration, stamp project identity and tests.
- Activate rraabbiitt: `bridge/rab-node.mjs`, `bridge/rab-id.mjs`,
  `tests/identity-storage/` only until another explicit assignment.
- Review audit stamps: `bridge/tool-house.mjs`, `bridge/tool-tracking.mjs`,
  `tests/project-lifecycle/numeric-runner.test.mjs` only until another assignment.

## Notes and follow-ups

- Existing config/stamp fixtures use textual project references. Fresh persisted
  project records get numeric identities; source configuration identity and storage
  registration must not be confused with saved-state migration.
- Old browser localStorage selection is global across windows. Use per-window
  session selection and reject outdated responses when switching.
- Existing code-viewer location remains deliberately unresolved and nonblocking.
- Full streaming of every audit engine is larger than folder indexing. Any engine
  that still materializes whole-file/whole-project results must be identified,
  bounded or explicitly excluded from claims about memory safety.

Implementation and validation results will be appended as they are observed.

## Implemented and reviewed

The three tasks coordinated file ownership, passed the user's thanks along, and
released their completed lanes. No new cloud service/database, source-tree
cleanup, dependency upgrade or shared-service restart was performed.

- Memory owner: durable numeric ID reservations, common node descriptors,
  numeric projects/sessions, read-only preview, optimistic session revisions and
  serialized operations. Invalid editable project settings remain inspectable
  through the owner's pinned registration instead of hiding saved sessions.
- Requests: app-owned records and public create/list/read tools, input-driven
  form, retry-safe accepted records and no required project selection.
- Project switching: per-window selection, Resume/New action/New session,
  stale-response guards, live settings and selected-session routing. Pending
  execution identity is saved before effects; each completion is saved before
  another step starts. Cold GET does not initialize a planner or write a session.
- Runner: numeric v2 execution/session/task references, shared reserved-attempt
  helper, compact receipt/result references, timing preserved. Class-impact's
  writer execution field was corrected to numeric after a real end-to-end failure.
- Folder pipeline: owner-composed disk queue/JSONL records, numeric folder/parent
  IDs, coverage, bounded pages, isolated direct-folder workers and saved results.
  Three canonical tools: count/folder-entries, index/folders, run/folder-index in
  audit/. Generated public tools were inspected and exercised, not left as stubs.
- Existing manual Workbench now targets the selected project/session and permits
  non-host submission. Its new ticket IDs use the same allocator. Its existing
  HOST-configured prepared-run collection remains a documented follow-on.

Current shape and deliberate limits are documented in
[Project workspace and folder runner](../../docs/vision/PROJECT_WORKSPACE_AND_FOLDER_RUNNER.md).

## Validation evidence

- Identity/node helpers: 14/14. Numeric runner integration: 6/6.
- Fresh workspace + initial UI suite: 14/14. Recovery regressions: 4/4 (seeded
  persisted interruption, not an OS-kill/power-loss test).
- Folder pipeline: 15/15; 100,000 synthetic records / 32,077,785 committed bytes;
  measured RSS growth 34,410,496 bytes after warm-up; largest page 32,268 bytes;
  approximately 10.12 seconds for that scale test. See the pipeline review for
  source/sink faults, heap exhaustion, timeout, backpressure and junction checks.
- Public folder tool/API integration passed: real worker, paged output,
  contracts, numeric IDs, timing, source unchanged, recursive tool refused.
- Agent regression lanes: tracking/concurrency/checker 27/27; project labels,
  class index and stamp discovery 21/21. Evidence writer mismatch was corrected
  and its exact previously failing write/verify/handoff workflow passed.
- Root fresh integration regression: 68/69 initially; remaining stale same-session
  reply assertion corrected. Selected-scope/receipt/path/containment/cancellation
  focused rerun passed 4/4. Additional full and changed-boundary results follow.
- [Browser checks and exact input strings](../../verification/project-workspace-2026-09-20/browser-checks.md)
  cover request save/reload, read-only preview, switching, real Chat audit,
  retained history and independent tabs across owned-preview restart.

The original diagnostic full log is retained, including failures. It accidentally
collected the existing audit-evidence entry and its nested files twice; package
test globs now include the new nested suites explicitly and retain only the
existing evidence entry. Old string-ID/named-folder fixture assertions were
updated to the approved fresh-record contract; real behavioral assertions were
preserved. No failing behavior was made a skip to achieve a green count.

## Problems found and follow-ons saved

- Folder-worker public cancellation UI, whole-coordinator liveness/recovery,
  index refresh/rename identity reconciliation, import-graph fingerprinting and
  arbitrary ID lookup are deferred. A killed coordinator can leave `running`
  status alongside valid committed records. No automatic replay is claimed.
- Streaming every existing parser/reducer/composite remains unimplemented. The
  index scale result is not a 100k-worker throughput or all-audit memory claim.
- Existing manual Workbench history still takes its newest global 100 HOST runs
  before project filtering; heavy activity in another project can hide older
  history. Full storage/paging unification is a later task.
- Windows active security fixtures required junction-based probes without
  administrator symlink permission. Their result explicitly says file symlinks
  were not exercised on Windows. Canonical ticket setup replaced obsolete probe
  setup before asserting unchanged 409/403 boundaries.
- One parallel regression saw EPERM while creating a Windows memory lock. The
  exact case passed in a fresh home. Acquisition now retries those transient
  Windows errors within its existing deadline, never steals/deletes an owner,
  and reports the last error if the deadline is reached.
- One optional agent regression shell command was rejected by automatic approval
  review before execution (generic policy rejection, no detailed reason). It
  included temporary-home setup and cleanup. The rejected command was not retried
  or bypassed; dedicated tests and separately authorized fixture suites supplied
  the needed evidence. This did not block implementation.
- The first canonical folder-batch tool generation rejected operation `run`
  because the path inherits `execute`. Corrected the metadata and regenerated
  through the stamp. No malformed public tool was retained.
- Code review/preview and prompt buttons remain deferred by the user's decision;
  no legacy migration or deletion was performed. Future path ranking and mixed
  development/audit saved-report policy remain in the feature backlog.

## Final observed results

- Integrated suite: **556/556 passed, 0 failed**, 313.33 seconds. Log: [final-test.log](../../verification/project-workspace-2026-09-20/final-test.log).
- Changed-boundary follow-up: **37/37 passed**, covering server scope, real manual execution/receipts/session identity, concurrency and UI.
- Final browser-found result-clearing fix: UI/output-contract suite **13/13 passed** in an explicit isolated home. Catalog refresh no longer clears completed tool results. These counts overlap; they are not 606 unique tests.
- Actual browser index 1830000000043 -> batch 1830000000077 completed, saved folder 1830000000044 / execution 1830000000078, and the result remained visible. Outer run kept selected session 1830000000033. No console errors were observed.
- [Machine-readable summary](../../verification/project-workspace-2026-09-20/validation.json), [boundary log](../../verification/project-workspace-2026-09-20/boundary-test.log), [final UI log](../../verification/project-workspace-2026-09-20/ui-final-isolated-test.log).

One preliminary final UI/output-shape command omitted the explicit test-home environment; its projectless runner could advance the default local ID allocator. It was rerun with an explicit isolated home and passed. No default-home test project cleanup or historical-record deletion was attempted.
