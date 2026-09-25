# Audit Factory: first class/atom investigation — 2026-09-20

Project: `C:/Users/pixelcommander/Desktop/RRAABBIITT_v0.9.3`.

The first complete workflow is implemented: observe a class, inspect its evidence,
record intent, prepare and approve one bounded CSS change, execute through Tool
House, verify the result, reopen the saved evidence, and prepare a local handoff.
This is the first class/atom slice of the vision, not every proposed investigation.

## What changed

- Added private `tools/audit/_evidence/` record, adapter and workflow owners, plus
  public `audit/inspect/class-impact` (ID `1830000000008`). The public tool was
  generated using the canonical `base/stamp-new-tool` in temporary staging; its
  installed address was added without regenerating shared registries.
- Added the authenticated `/api/investigations` facade in
  `bridge/audit-investigations.mjs`, with a narrow route in `server.mjs`. It uses
  the current session, project-memory owner and shared runner.
- Added Investigations to the existing Magic Box. The UI shows evidence, gaps,
  freshness, intent, plan details, explicit approval, verification and handoffs.
  Project/session changes invalidate selection and pending responses.
- Class scan paths now retain parsed-byte hashes and explicit excluded/read/link/
  traversal coverage. Canonical static template tokens followed by `.trim()` are
  recognized; arbitrary expressions stay unresolved. Token excerpts are bounded.
- Coordinated fixes protect cooperating concurrent memory operations and preserve
  explicit CSS-file filters through request binding. See the
  [memory/filter report](2026-09-20-audit-memory-reliability.md).

The [implementation contract](../domains/audit-evidence.md) documents the result
shape, entry points, storage and limits. Existing project settings/results are
still owned by `.rab`; ordinary scans do not write to the audited folder.

## Plan and evidence protections

The supported plan changes paired `:active` / `.is-active` custom properties in
one observed CSS definition file using already declared token references. It
retains source and writer fingerprints, exact options, expected bytes and prior
text for manual recovery. Unknown intent, stale evidence and unsupported changes
block planning. Changed input or writer invalidates the prepared approval.

Verification checks the approved scan root, post-scan consistency and coverage,
expected target bytes, unchanged other captured files, retained consumers and the
actual writer operation. A matching tool ID alone is insufficient: options and
execution time must match the prepared operation. Missing, altered, incomplete or
foreign saved source evidence rejects reopening; copied immutable class facts are
also re-derived and compared against the source execution.

Build/tests and runtime appearance are separate acceptance requirements, not
inferred from static matches. There is no atomic snapshot or multi-file rollback.

## Retained generated application

Artifact root: [retained demo](../../verification/audit-factory-2026-09-20T16-13-42-711Z/demo.json).

The canonical React project stamp generated `evidence-demo/`. The audit project
stamp created `.rab/projects/evidence-demo-audit/` beside it. Structured action
inputs and receipts are saved in that audit project; they are labeled structured
actions rather than represented as natural-language Box turns.

The initial scripted workflow completed investigation, declaration, plan,
execution, verification and handoff. The UI walkthrough then:

1. Entered the exact Box text `load project evidence-demo-audit`.
2. Reopened stale evidence and confirmed approval was disabled.
3. Scanned `action-main`, declared Intentional, and prepared the paired state change
   in `src/atoms/action-main.css` using `surface-main` and `content-main`.
4. Confirmed apply was disabled before approval, executed once, reopened the saved
   verification/handoff, and confirmed session reset cleared selection/approval.

See [UI verification](2026-09-20-investigation-ui-verification.md) for exact reason,
CSS input, plan ID, saved report paths and browser observations. That walkthrough
used the backend snapshot with five checks; the subsequent source-root check is
covered by the final code tests, not retroactively attributed to that walkthrough.

`npm install --ignore-scripts --no-audit --no-fund` ran only in the disposable app.
Its `npm run build` passed TypeScript checking and the Vite build, including after
the UI change. The production preview rendered the generated button; keyboard Tab
focused it; paired CSSOM selectors and retained focus styling were observed with
no captured console warnings/errors. This was not a screenshot-diff or timed
held-pointer test. [Build/browser record](../../verification/audit-factory-2026-09-20T16-13-42-711Z/.rab/projects/evidence-demo-audit/generated-app-verification.json).

Final demonstrated target SHA-256:
`91a1b695b822f5b9f2c63b7a12b52d6840d634232d2b15599ce6da6f403d53cc`.

## Read-only real-project check

Input: `C:/Users/pixelcommander/Documents/ChatGPT/audit-factory/builder-campaign/audit-room`.
This was an audit input, not the implementation destination.

For `ui-muted`, the saved report found one selector occurrence, 36 assignment
occurrences and nine potential consumer files, with 12 dynamic assignments left
unresolved. All 45 scoped source files hashed identically before and after.
Results were saved in the retained demo's `.rab/projects/audit-room-evidence-check/`.
See [source-preservation proof](../../verification/audit-factory-2026-09-20T16-13-42-711Z/.rab/projects/audit-room-evidence-check/source-preservation-check.json).

## Verification ledger

Final full suite: **499 tests, 496 passed, 3 failed**, no skipped/cancelled tests;
166.15 seconds. All three failures are the existing Windows symlink-setup `EPERM`
cases in `dom-edit-security-v085.test.mjs`, `full-house-v085.test.mjs` and
`server.test.mjs`. No new failure remains in this run. See the
[final log](../../verification/audit-factory-2026-09-20T16-13-42-711Z/full-tests-verified.log).
Command:

```text
node --test tests/*.test.mjs engine/tests/*.test.mjs
```

Dedicated tests are included by `tests/audit-evidence.test.mjs` in the normal test
glob. They cover records, real scan output, saved evidence tampering/deletion,
verification negatives, the disk-backed approved workflow, authenticated access,
foreign reports, UI state and CSS-only binding. Memory concurrency has its own
cross-process suite.

Historical failures are preserved:

- First retained demo attempt failed because the scanner missed static tokens in
  the generated component's trimmed template. Fixed at the class-search owner and
  added a regression. The failed demo directory remains
  `verification/audit-factory-2026-09-20T16-13-06-995Z`.
- Integration initially exposed stripped session context and assumptions about
  tracking identity. Corrected to the child's session and actual stable ID/options
  contract; workflow tests then passed.
- Browser testing found a malformed intent option; fixed with a markup regression.
- First full suite: 491/495 passed; three existing Windows symlink-setup `EPERM`
  failures plus the new UI's disallowed `minmax` layout. Layout was corrected to
  house grid conventions without weakening the test.
- Next full suite: 495/499 passed; the same three `EPERM` failures plus a mock
  missing its primary source-report link after evidence validation was tightened.
  The mock was corrected and its focused suite passed 3/3. This run's log remains
  `full-tests-final.log`; its filename does not mean all checks passed.

All full-suite logs are in the retained demo root. The three Windows fixture
failures are not passes; their application assertions cannot run when symlink
creation is denied. No OS security or privilege settings were changed.

## Coordination and next work

**Review audit stamps** supplied the discovery/contracts baseline and owned the
Investigation UI and browser verification. **Activate rraabbiitt** owned the
bounded memory/filter fixes and reviewed verification negatives. Both released
their source scopes. This task owns the integrated evidence/scanner/facade work
and final verification. Shared server `4318` was not restarted. The coordinating
task's isolated backend/production preview on ports 58929/58930 was closed through
its own graceful shutdown handler after verification; the generated app and saved
results remain on disk. The other task reported that cleanup of its unrelated
isolated port 61110 process was blocked by policy; this task did not attempt to
circumvent that denial.

Remaining work is explicit in the [roadmap](../todo/audit-factory-roadmap.md):
broader scanner coverage, token/cascade and atom-bypass investigations, additional
decision types, general normalization, function/API/Git/data-lineage work, and a
self-contained external-worker handoff. Existing handoffs are local; no project
content was sent to a cloud model. The separate context-specific prompt-button
idea is saved as FR-0003 only, awaiting the user's explanation.
