# Audit memory persistence reliability

Date: 2026-09-20.
Canonical project: `C:\Users\pixelcommander\Desktop\RRAABBIITT_v0.9.3`.
Scope handed off by Inspect RRAABBIITT v0.9.3 after Review audit stamps released
the memory-writer files. Implements the reproduced persistence item in phase 2
of the Audit Factory implementation plan, not the whole plan.

## Independent pre-fix reproductions

Tests ran on PIXEL using separate Node processes, shared disposable `.rab`
storage and a separate source folder. No production memory or audited source was
modified. These are observed results, not estimates:

| Probe | Attempted / expected | Observed |
| --- | --- | --- |
| Six processes, eight unique keys each, updating paths/facts/resources | 48 entries per collection | 11 paths, 17 facts, 15 resources remained; multiple Windows EPERM rename failures |
| Four processes, twelve unique fact keys each | 48 saves | 32 returned success; 13 entries remained; 19 acknowledged keys missing; 16 EPERM failures |

Baseline fixtures were created at Windows Temp `rab-memory-baseline-utTqjI`
and `rab-memory-acknowledged-8IQS8t`. Source sentinel contents stayed unchanged.
The first console output was truncated; its aggregate counts and example rename
failures were visible. The second output was complete and separately established
acknowledged-but-lost updates.

Cause: read/modify/write operations could interleave across processes. Atomic
replacement of individual JSON files did not serialize the preceding reads.
`openProject()` also rewrote PROJECT.json, including a later project-type update,
so even opening a project could overwrite a concurrently updated paths map.
Windows also rejected some concurrent renames. `openProject()` previously caught
all PROJECT.json read/parse errors and replaced the prior value with `{}`.

## Changes and ownership

- `bridge/rab-memory.mjs`: serialize public per-project memory operations across
  their complete read/modify/write sequence, not merely the final write.
- `bridge/rab-memory-lock.mjs`: private cross-process directory-lock helper.
- `tests/rab-memory-concurrency.test.mjs`: focused behavior tests.
- `tests/fixtures/rab-memory-concurrency/worker.mjs`: separate-process worker.
- This report only. No service, registry, request-log, scanner, runner, evidence
  adapter, dependency, or telemetry implementation changes.

The lock name uses a SHA-256 digest of the memory project directory (case-folded
on Windows), under the selected rab home's `.memory-locks` folder. A separate
home-initialization lock protects initial home settings. Per-project public calls
hold one project lock; internal calls remain inside that operation rather than
recursively acquiring it. Unrelated projects use different project locks, with
only brief home initialization serialized globally.

Lock acquisition uses exclusive directory creation. Contention waits with short
jittered delays for up to 15 seconds, then throws MEMORY_LOCK_TIMEOUT with lock
path and owner metadata when readable. The owner record contains PID, hostname,
token and acquisition time. Locks are not stolen based on age or PID guesses.
Successful and failed operations release their locks in finally. Release failure
is reported, including that an otherwise successful operation may have completed.

Atomic JSON writes still use a temporary file and rename. Temporary creation is
exclusive. EPERM/EACCES/EBUSY rename errors receive seven bounded retries (about
0.63 seconds of scheduled delay in total); permanent errors still propagate.
Failed temporary files are removed when possible without removing the original
destination; cleanup errors are attached. Corrupt/unreadable PROJECT.json now
fails visibly and is not silently reset.

## Contracts deliberately preserved

- `saveResources`, `saveFacts`, and `saveSession` remain full replacements. They
  are not secretly merged. Last serialized replacement wins.
- `setFact`, `setProjectPath`, `removeProjectPath` and `addResource` update the
  latest state under one lock. Explicit false, zero and empty strings survive.
- Audit result ownership remains in `saveToolResult`. It still saves only
  read-authority results in audit projects; the runner still owns top-level-only
  invocation. This change does not infer completion from a saved report.
- Packing of root/child results, execution statuses, error fields, and partial
  reports is unchanged. Failed/partial results are not relabeled complete.
- `resolveToolValue` preserves project containment and recursive JSON Pointer
  unpacking. Child references may address nested locations in the root result,
  not just `child_results`.
- Existing report files are not rewritten by new result saves. Tracking and
  reports retain their established separate shapes and paths.
- No writes are made to the source being audited by these memory operations.

## Verification

Dedicated test command:

```text
node --test tests/rab-memory-concurrency.test.mjs
```

Latest result: 6 tests passed, 0 failed, 0 skipped (includes the subsequently
requested report-reader integration).

Verified behavior:

1. Four simultaneous processes start with cold project metadata. All 24 expected
   paths/facts/resources persist, including false/zero/empty values. Every session
   and parent/child execution record reloads, and every saved result reference
   resolves to its expected content. Child pointer `#/result/nested/child` is
   explicitly checked. Further processes save additional reports without changing
   any original report bytes. Source sentinel and directory contents stay intact.
2. Twenty simultaneous in-process fact updates survive; explicit full-snapshot
   saves replace rather than merge; path deletion and another-key addition coexist.
3. Malformed PROJECT.json fails without modifying original bytes and releases its lock.
4. Two projects with the same project ID but distinct owned roots stay isolated.
   Cross-project result references are rejected. Write-authority and non-audit
   result saves retain their ineligibility behavior.
5. A worker is killed while holding a lock. A later acquisition times out visibly,
   does not run the protected operation, and does not steal the interrupted lock.
6. The report reader returns a matching envelope verbatim, including failed-task
   and partial-error metadata. It rejects foreign/traversal paths, malformed JSON,
   unsupported envelopes, mismatched project IDs and oversized files. Reading
   does not create PROJECT.json, locks, or missing project directories.

The existing seven `tests/audit-tracking.test.mjs` tests also passed alongside
the initial four concurrency tests (11/11 total in that run). These include
failed composite partial-result retention, original errors, nested report links,
restored seats, audit-folder rules, compact receipts and Chat rebinding.
The fifth concurrency case was subsequently added and passed in the 5/5 run.

Additional conversation/usage/seat regressions: 44 passed, 0 failed, 0 skipped:
`project-conversation`, `session-planner`, `session-flow`, `usage-health-v085`,
`nested-seat-scope-v092`, and `audit-project-names` test files.
No full-suite or new browser verification is claimed by this focused report.

## Report-envelope read API (requested integration)

The coordinator subsequently requested a narrow reader in this same owner:

```js
const envelope = await memory.loadToolReport(meta, file);
```

`file` is an absolute path or a path relative to the selected memory project
directory, not the scanned source folder. The method checks containment using
the existing containedPath helper and final realpath, opens a regular file,
limits both initial size and actual bytes read to 32 MiB, parses JSON, and requires
`version: audit-result/v1` plus `project_id === meta.id`.

It returns the original parsed envelope without classifying successful/partial
evidence or unpacking pointers. Consumers must inspect error/task status;
`resolveToolValue` remains the separate unchanged pointer-unpacking API.
Malformed JSON/version produce BAD_REPORT; oversized payloads REPORT_TOO_LARGE;
wrong IDs WRONG_PROJECT; containment failures INVALID_PATH. Filesystem errors
such as ENOENT propagate. The reader does not call openProject, acquire a creating
lock, or initialize any project. It does not add a second report writer.

The coordinator owns report enumeration and investigation eligibility decisions.

## Limits and operational caveats

- Locks coordinate callers using this memory implementation. Other code directly
  writing the same JSON files bypasses them. Filesystem semantics were tested on
  local Windows storage, not SMB/NFS or multi-machine writers.
- A lock protects one public call, not a caller's separate `loadFacts()` then
  edit then `saveFacts()` transaction. Such a stale full snapshot can still replace
  newer data by its existing contract. Use incremental methods for incremental
  updates; future snapshot conflict detection needs its own explicit design.
- Session snapshots remain last-writer-wins. This is not multi-server session
  revision control, nor a fix to the separate usage/telemetry writer.
- A killed process can leave its lock and temporary JSON behind. Recovery is
  deliberately manual: quiesce all writers, inspect owner and persisted files,
  establish that no operation still owns the lock, then remove only that exact
  abandoned lock. Do not delete all `.rab` storage or auto-steal a live lock.
- A timeout does not mean earlier work was rolled back. Multi-call workflows,
  report-plus-tracking writes, and interrupted writes are not database transactions.
  Inspect existing evidence before retrying. No power-loss durability/fsync claim.
- Serialization trades concurrency for integrity within a project. Long operations
  may cause visible timeout; no promise of fairness or unbounded waiting is made.

## Source fingerprints after implementation

- rab-memory.mjs SHA-256: `166589275C87C20E9CC2A4344471F54257D56C8E71D1D82B3A7FDB46D8F0DDF5`
- rab-memory-lock.mjs SHA-256: `F5C1D5FDECFA6B878FB9DE861420AAD2661B7846C245FFCDBF952174C98C9D9E`

## Related records

- [Approved-plan context](../todo/audit-factory-implementation-plan.md)
- [Tracking contract](../../AUDIT_TRACKING.txt)
- [Runner process](../process/runner.md)

## Follow-up: exact CSS file-filter binding

Later on 2026-09-20 the coordinator released a separate narrow phase-2 binding
item: reproduce the Box text `find all css files`, inspect its plan before
execution, and fix the owner if the explicit extension was lost. Additional scope:
`bridge/seat-parser.mjs`, `bridge/session-planner.mjs`, and dedicated
`tests/audit-evidence/css-filter.test.mjs`. The persistence changes above were
not reopened. No catalog/registry, UI, service or tool implementation edits.

### Reproduction

A fresh disposable audit project with `a.css`, `b.js`, and `c.txt`, loaded through
`createWorkbench` and `sessionTurn`, produced a ready `audit/find-files` step.
Its pre-execution extension was `*`, with provenance `contract:default`.
Execution returned all three files, reproducing the reported loss. Fixture:
Windows Temp `rab-css-baseline-a8jIUT`. The frame recognized `css` lexically but
carried no extension evidence; optionsFor had no request-extension binding.

### Focused fix

- In request mode, a find/file frame with adjacent CSS + file/files tokens now
  carries explicit `extension: .css` evidence. This is a file modifier, not a
  switch from audit into the CSS work domain. Quoted paths are not matched by a
  substring search. Uppercase CSS and dot-prefixed .css are covered.
- The planner binds that evidence to a declared `extension` setting before
  inherited bag values and contract defaults, preserving `request:extension`
  provenance. Existing explicit folder handling and builder target invalidation
  are unchanged. No global binding/default rules were rewritten.
- This is a narrow CSS-file construction, not a claim of general natural-language
  glob, multi-extension, exclusion, or arbitrary file-format support.

### Verification

`node --test tests/audit-evidence/css-filter.test.mjs`: 3 passed, 0 failed.

1. Exact Box text binds `.css` and the correct folder in the ready plan, before
   any execution. After confirmation, results contain only `a.css` and `b.CSS`,
   not JS/text files. Fixture source contents and directory inventory remain intact.
2. An explicit quoted folder and CSS modifier beat stale session seats and saved
   path values (`.js` / `.txt`). A direct shared-runner call with explicit folder
   and extension also retains those inputs and returns the same CSS-only result.
3. Lowercase/uppercase/dot-prefixed CSS modifiers retain audit domain; `css files`
   inside a quoted path does not create filter evidence. Plain `find all files`
   still uses the wildcard default in a fresh session.

A read-only check of current Tool House `bindSettings` also confirmed supplied
`false`, `0`, and optional `''` survive contrary defaults. No execution or storage
was involved in that check. Existing parser/CSS-state/builder/session/schema
regressions passed: 57 tests, 0 failures, 0 skipped. Command:

```text
node --test tests/seat-parser.test.mjs tests/action-states-v093.test.mjs tests/builder-session-v093.test.mjs tests/session-planner.test.mjs engine/tests/schema.test.mjs
```

This includes the explicit-component-target-over-stale-page-address regression
and paired CSS active/is-active parsing and execution. The coordinator's prior
full-suite run predates this binding fix; no post-fix full-suite result is claimed
here. Scope released after this handoff.
