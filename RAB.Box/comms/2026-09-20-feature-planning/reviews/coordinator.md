# Coordinator cross-review

Date: 2026-09-20. Task: Inspect RRAABBIITT v0.9.3.
Reviewed both independent drafts and the identity lane's first cross-review.
Documentation only; findings are design conclusions, not implemented behavior.

## Identity/storage review

Accepted: preserve the six house keys with typed validation; keep settings as input
declarations; numeric safe-integer allocation behind one memory owner; retain
actual timestamps separately; read-only inspection; explicit version boundaries;
expected-revision checks in addition to filesystem locks; application requests
separate from project state; window selection separate from execution scope.

The proposed reservation/recovery protocol addresses a real gap: atomic rename
alone cannot establish that an acknowledged ID is permanently reserved. It needs
fault-injection tests, not an unsupported durability claim. SQLite is a researched
alternative, not an approved installation or prerequisite.

Two boundaries need narrowing:

1. Category descriptors, all existing generators and historical evidence migration
   are not prerequisites for the first request/project UI. Do not add settings.json
   to tool categories yet. Before that future rollout, discovery must distinguish
   categories from executable tools, including inherited executors.
2. New numeric session paths cannot be shipped while actions, turns, endpoints or
   tracking in that same flow remain incompatible. A v1 read adapter alone does
   not solve mutation. Requested a narrow continuation/adoption contract from the
   identity lane before assigning source edits. Keep original history readable.

The user was asked one deployment question: one host per `.rab` versus concurrent
independent hosts. A UNC audit target does not answer where state is written.

## Audit pipeline review

Accepted: backpressure throughout traversal, parsing, reduction, tracking and
transport; a small result reference instead of retained whole output; bounded child
traces as well as findings; one supervised worker invoking the same runner; paged
status/results; committed progress distinct from observed progress; captured-byte
provenance and explicit incomplete coverage; source remains untouched.

The saved Invalid string length reports establish a failing child, not the exact
allocation. Capture a bounded reproduction stack before claiming a specific fix.
Synthetic output tests are preferable to using a live drive as the first scale test.

Clarifications requested and incorporated into synthesis:

- User's first delivery is project switching/request page. Streaming is the next
  reliability milestone, not a competing first delivery.
- Code preview/temp-test decisions have been answered. No new question, fake
  project registration or `.rab/apps/.../tests` default is needed.
- Flat incremental audit records are a physical encoding for observations. They
  do not replace nested project/session entity folders and their settings.json.
- An output directory is not an OS sandbox. Supported template plans use their
  real renderer; arbitrary tools cannot acquire preview support by adding a flag.
- A stable folder identity ledger is durable data; rebuildable search indexes are
  a different thing. Deleting an index must not mint identities for known folders.

## Changes to this lane after their review

Our original disposable-project default is superseded by the user's scratch/code
preview answer. Prompt research is frozen and labeled historical. Added to the
compared plan: stale session revision conflicts, unavailable-source preview,
idempotent request submissions, mixed-project audit persistence, and explicit
continuation boundaries. None needs a second runner or persistence system.

## Remaining technical disagreements to resolve before code

No disagreement on user priority or architecture ownership. The identity lane's
follow-up settles the proposed narrow seam: explicit Resume-for-work creates one
numeric continuation while linking original history, with all newly created
lifecycle references numeric. The user resolved writer topology: per-user `.rab`
on the executing computer, created on first run, one host per storage realm.
Exact module/schema names in research are proposals; final fields must be checked
against existing contracts before source implementation. Optional schema roles,
deep task folders, new taxonomy and query accelerators remain later work.

Final identity-lane review returned no blocker. Its useful clarification was
accepted: the new ID helper must not become a second filesystem writer. Keep
transaction persistence/locking in rab-memory and test integrated crash/concurrency
behavior separately from the pure helper's arithmetic and contract fixtures.

Final audit-lane review also returned no material contradiction or first-milestone
blocker. Its live draft now incorporates the user's priority, scratch preview,
local home and prompt deferral. Later pipeline detail includes explicit root/producer
locators and reconciliation between sealed artifacts and terminal execution state;
none is an extra prerequisite for the initial request/project UI.

Research and comparison complete. No source implementation was dispatched and no
proposal is reported as a passed runtime test.
