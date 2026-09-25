# Compared feature plan

> Historical research proposal. The user subsequently authorized fresh records
> only, dropped legacy continuation/migration, deferred code preview/reviewer,
> and prioritized the folder-ID runner. The controlling implementation record is
> [execution.md](execution.md); the implemented shape is documented in
> [Project workspace and folder runner](../../docs/vision/PROJECT_WORKSPACE_AND_FOLDER_RUNNER.md).
> References below to legacy continuation or unstarted product work describe the
> earlier review state, not current authorization or completion.

Date: 2026-09-20. Canonical project: `C:/Users/pixelcommander/Desktop/RRAABBIITT_v0.9.3`.
Coordinator: Inspect RRAABBIITT v0.9.3.
Status: compared delivery proposal; both other tasks completed final review with
no first-milestone planning blocker. All first-milestone user questions are answered.
Product implementation has not started in this research round.

## Decisions from the user

1. First milestone: **Project Viewer/switching and the request page**.
2. Normal first run creates `C:/Users/<current-user>/.rab` on the executing computer.
   One computer owns each home; cooperating windows/processes share its owner.
3. Supported template-tool tests show code preview; generated copies can live at
   `.rab/temp/test/[numeric-id]` rather than in active project source.
4. Prompt button: save the clarified idea, but exclude implementation and further
   design from this run. Project-specific prompt storage is still exploratory.
5. Use numeric timestamp-derived IDs, house keys, missing-only defaults and
   self-similar shapes. Preserve original history and do not write into audit input.

The logs contain ten numbered requests plus the related streaming/progress item.
Some overlap or describe partially completed roadmaps; they are not eleven separate
new applications. See [inventory](inventory.md) and [user answers](questions.md).

## What the three reviews changed

| Issue | Alternatives compared | Chosen proposal and reason |
| --- | --- | --- |
| Request records | Separate feature/tool trackers; one typed record; external ticket authority | One house-shaped request lifecycle, with typed views. FR-0004 and TR-0002 share persistence. Existing FR/TR labels stay provenance. |
| Project selection | Dropdown immediately loads; preview then explicit work controls; one global active pointer | Read-only preview plus Resume/New action/New session. Selection belongs to each window; executions keep their original scope. |
| Identity | Ad hoc Date.now; shared high-water allocator; SQLite; distributed worker-bit IDs | One local memory-owned safe-integer allocator. Reserve before returning, handle crash/clock collisions, preserve old IDs. No new database dependency or distributed-ID machinery. |
| Folder hierarchy | One huge nested state document; a file for every event; typed folders plus bounded state | settings.json at adopted entity levels, initially app/request/project/session. Embedded action/step history can remain until a deeper level has a reason. |
| Legacy state | Rewrite everything; permanent duplicate writers; versioned readers and continuation | Read originals in place; an explicit Resume-for-work makes one numeric continuation when needed. No mass rename or evidence rewrite. |
| Tool testing | Write into active project; register fake project; supported render preview/scratch copies | Use canonical rendering and `.rab/temp/test/[id]`. A temp folder alone is not an OS sandbox or universal dry-run. |
| Large audits | Stream only the final writer; unbounded worker messages; bounded full pipeline | Bound traversal/parser/reducer/trace/results/transport, reuse the runner in supervised jobs, then page results and status. This follows the user's first milestone. |
| Path matching | Increase lexical weights; compatibility gates plus contextual ranking; direct LLM choice | Hard compatibility first, then bounded path/project context weights with visible reasons. Explicit new intent overrides stale branch context. |

The original disposable-project recommendation was changed after the user's
answer. The original streaming-first recommendation was reordered. Flat audit
record streams do not replace the requested nested entity folders: observations
and saved project/session entities are different storage responsibilities.

Primary-source mechanisms and their limits are linked in each independent draft:
[identity/storage](lanes/identity-storage.md), [audit pipeline](lanes/audit-pipeline.md),
[UI/routing](lanes/ui-routing.md). Reviews are [identity](reviews/identity-storage-review.md),
[pipeline](reviews/audit-pipeline-review.md), and [coordinator](reviews/coordinator.md).

## Shared foundation, kept small

The current default home already uses `os.homedir()/.rab`; retain that owner and
verify first-run initialization. Do not create a registry/scanner in another home.
The server's house registry stays distinct from this application's local memory.
An explicit test-home override remains available so tests do not mutate real data.

Keep existing house keys `id`, `name`, `title`, `description`, `settings`, `meta`.
`settings` remains input declarations, not an unrelated state object. A proposed
version and typed role distinguish project, session and request records. Project
type (for example React) and request type (feature/UI/tool/stamp) retain their own
validated meanings. Fill absent defaults without replacing valid false, 0 or '';
null follows the actual field contract. References never grant write permission.

Proposed new-record paths, hidden behind the memory owner:

```text
C:/Users/<current-user>/.rab/
  settings.json
  apps/
    <app-id>/
      settings.json
      requests/
        <request-id>/
          settings.json
  projects/
    <new-project-id>/
      settings.json
      sessions/
        <session-id>/
          settings.json
          state.json
  temp/test/
    <execution-id>/
      settings.json
      <generated template files>
```

Each `state.json` belongs beside the corresponding entity's settings.json when
mutable state needs a separate file. This shorthand is not a demand to create all
paths now. Existing project folders remain in place through compatibility readers.
`apps` is a proposed clear name for application-owned data; it avoids confusing the
Tool House `base` domain with a storage role. No dummy project is required to submit
a request. Deeper task/step folders, category descriptors and taxonomy moves wait.

The numeric allocator serves new durable identities in adopted flows, including
request/session/action/step/turn/run/receipt/failure identities. It must reserve
`max(Date.now(), highWater + 1)` atomically under the existing local owner, validate
safe integers, persist acknowledged reservations and fail visibly on corrupt state.
Batch reservation can use the same interface later. Gaps are fine; reuse is not.
Actual event times remain separate. Hashes/checksums and stream positions are not
entity IDs. Separate computers may allocate the same number: importing/merging
their stores needs an explicit future reconciliation contract.

## First milestone: user-visible behavior

**Project Viewer:** list known projects with enough identity/path detail to
distinguish duplicate names. Selecting a row previews source settings, saved state,
sessions and current availability without opening, updating or creating a project.
If source settings are unavailable, label the historical snapshot as a snapshot.

- **Resume:** choose saved work, revalidate current settings/tool inputs, and
  continue it without replaying uncertain executions or carrying old approval.
- **New action:** retain the current session/history and project defaults; start
  a fresh group without previous action targets, answers or approvals.
- **New session:** retain the project and previous history; create a fresh session
  from durable defaults through the common binder.
- **Switch:** change this window's working selection. A running job still belongs
  to the project/session/action captured when it started. Stale UI responses cannot
  overwrite the newly selected view; stale session saves report conflicts.

**Request page:** fields are name, title, description and a type dropdown containing
tool, feature, UI and stamp. Save in application-owned `.rab` storage even with no
project selected. Creation/list/detail share one validated owner; saving twice due
to a response retry returns the same request, while two intentional identical
requests remain distinct. Use the same public tool path from Chat/UI where exposed;
never add a separate browser-only JSON writer. Final tool names/IDs must come from
the canonical stamp and the approved contract, not this prose.

Existing Markdown requests are source history. Keep their exact text and FR/TR
labels; any later import records provenance and is idempotent. Do not silently
convert historical feature descriptions into user-approved implementation specs.

## Legacy continuation boundary

Read legacy projects, sessions and reports without modifying them. On explicit
Resume-for-work, create one numeric session continuation if the chosen session is
legacy. A durable mapping makes repeated Resume return that same continuation.
The original project can retain its old identity, addressed through a tagged
legacy reference, without becoming a newly created string-ID record.

Link original turns/results rather than recopying and renumbering them. Import only
the unresolved action/steps needed to continue; allocate new numeric identities,
record their scoped origins and revalidate answers. Approval and executing status
do not transfer. Unsupported pending shapes remain visible with an explicit new-
action path. Changes by an older writer cause a conflict, not a silent merge.

Memory, planner, project conversation, runner/tracking, receipts, failures, route
validators and UI references must agree on this version boundary. Widening one
session regex is not sufficient. Existing evidence payloads keep their declared v1
protocol and original validation; converting their identity scheme is a later
versioned change. Adapt existing investigation entry points for the new lifecycle
so the first milestone does not casually disable the working audit demonstration.

Preview/request creation can be reviewed first. Work controls are enabled only
after the coherent lifecycle slice passes. The first milestone is not complete
until project switching and representative resumed work operate end to end.

## Implementation sequence and proposed file ownership

These are bounded assignments to dispatch after plan agreement, not permission for
parallel shared-source editing. Recheck current files and instructions at dispatch.
All shared files have one writer: the coordinator. Helpers call existing owners.

| Order | Deliverable / owner | Exact proposed write scope | Completion gate |
| --- | --- | --- | --- |
| 1 | Contracts and isolated fixtures / Activate rraabbiitt | New `bridge/rab-node.mjs`, `bridge/rab-id.mjs`; `tests/identity-storage/` only | Typed records, safe-integer calculation and injected reservation contract, absence semantics, versioned references. No independent filesystem writer or shared memory/source edits from this lane. |
| 2 | Local initialization, request storage and read-only inspection / coordinator | `bridge/rab-memory.mjs`, `bridge/service.mjs`, `server.mjs`; new `tests/project-lifecycle/` and `tests/request-records/` | First-run home, no-project request persistence, retry behavior and zero-write project preview. Lock helper changes only if demonstrated necessary. |
| 3 | Coherent continuation and selection / coordinator | Above plus `bridge/session-planner.mjs`, `bridge/project-conversation.mjs`, `bridge/tool-house.mjs`, `bridge/tool-tracking.mjs`, `bridge/audit-investigations.mjs`, applicable contract sidecars and existing base project-tool owners | Original history intact, new numeric lifecycle, pending work restored safely, stale saves rejected, existing audit flow supported. Sequential shared integration. |
| 4 | Request/project UI and canonical tool wrappers / coordinator | `magic-box/index.html`; specifically named new `tools/base/<approved-address>/` folders and required registry entries via canonical stamp; relevant existing project tools | Browser proof for save/reload, preview/resume/new action/new session, two windows, duplicate names, unavailable source. Declare exact new addresses before edits. |
| 5 | Independent acceptance review / Review audit stamps | Initially read-only; dedicated fixtures/tests under `tests/project-lifecycle/` by explicit file assignment if needed | Adversarial review of input/output scope, old evidence, audit compatibility, duplicate submissions and in-flight project switching. No shared owner edits. |

Order 1/2 can proceed independently only after function contracts are settled.
The ID helper computes/validates and calls an injected transaction; rab-memory owns
locking, durable reservation storage and acknowledgement. Multiprocess/crash
reservation guarantees require integrated tests in orders 2/3, not pure helper tests.
Order 3/4 integration is serialized. A test author and integration author do not
edit the same test file concurrently. Root registries, generators and shared tests
are never regenerated incidentally. No installations or service restart is implied.

## Following milestones

1. **Large-audit reliability and live progress:** controlled stack reproduction,
   then one class-definition tool through bounded parsing/emission, same-runner
   background execution, small tracking references and paged reads. Extend through
   class count and investigation before claiming the original large audit is fixed.
   Audit runs in development projects keep the project platform and save under its
   selected `.rab` project; result policy cannot depend solely on type=audit.
2. **Tool tests and code preview (FR-0001/2):** use existing prepare/confirm and
   artifact-plan owners. Pure rendering previews supported stamps; requested
   materialization writes only the recorded `.rab/temp/test/[id]` target. Keep
   planned versus written/verified content distinct. Locate the user's React code
   viewer before choosing its integration, rather than assuming a replacement.
3. **Mapper and indexed batches (TR-0004/5):** numeric folder identities, immutable
   map versions and durable identity assignments; derived indexes can be rebuilt.
   Direct-folder/indexed-file tools consume entries once; whole-project tools run
   once rather than recursively at every folder. Preserve incomplete coverage.
4. **Path/language refinements:** fix explicit platform/operation compatibility,
   bound duplicate-word/context weighting, retain explainable alternatives and
   clarification. Save exact prompt strings and results for comparison. Six actual
   read-only discovery probes are already recorded in the UI lane; they are not
   claimed end-to-end execution failures.
5. **Guarded row stamp (TR-0001):** resolve the existing guard guide and first data
   source/output pair, then generate through the canonical component stamp and
   inspect/build the output. Keep stable row identity across render/reordering.

TR-0003 remains the umbrella roadmap, with its completed earlier milestone marked
separately. FR-0003 prompt button has no delivery assignment in this run.

## Proof required for the first milestone

- First launch under an isolated user-home fixture creates exactly the intended
  local home; a second launch preserves it; concurrent initialization is safe.
- Frozen/backward clock and multiple local processes produce no duplicate IDs;
  crash after reservation cannot reuse an acknowledged ID. Corrupt state is not
  silently reset. These are process-failure tests, not an unmeasured power-loss claim.
- Save/retry/reload a request without a project; prove original values and one
  accepted submission. Request type cannot alter project platform or tool authority.
- Hash existing project settings/session/report fixtures before and after preview
  and continuation; original files remain unchanged, old references still resolve.
- Resume twice yields one continuation; a representative unfinished step keeps
  valid answers, loses approval, and continues through the existing runner. New
  lifecycle IDs, including nested runs, receipts and failures, remain numeric.
- Two windows select different projects; stale responses/saves are rejected;
  running work saves to its original scope after a switch. New action/new session
  clear exactly their temporary state and retain the specified history/defaults.
- Run a small existing audit and builder fixture through the adopted lifecycle;
  inspect output, tracking duration/status and storage location. Audit input stays
  unchanged. Generate any new stamp wrapper and inspect it under house rules.
- Run relevant existing checks once after integration, classify actual failures,
  and save exact test inputs, expected/actual outcomes and evidence in the project.
  Historical 496/499 checks do not validate any proposal in this document.

## Open matters

No unanswered user decision blocks this first milestone's plan. Exact new fields,
module boundaries and tool addresses are engineering details to settle against the
current rules before edits. Runtime migration remains explicit and bounded; no
historical rewrite is authorized by this plan.

Later questions: where the intended React code viewer lives, and the first source/
output pair for the row stamp. Ask when those features are scheduled. Do not reopen
the prompt-button discussion or ask again about local versus shared `.rab`.
