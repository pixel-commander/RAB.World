# UI and feature requests

## Storage clarification — 2026-09-21

The entries below are a historical planning log. New feature requests use the
Requests page or `base/create/request`: Global / shared saves under the configured
`.rab/feature-requests/`; project scope saves under the owning
`.rab/projects/<existing-project-directory>/feature-requests/`. Do not save new
request records or duplicate them in docs. Preserve earlier entries and their
provenance; plans and implementation reports may still link to those records.
This dated clarification supersedes the older new-entry instructions below.

Canonical running list for UI and other feature requests in
`C:\Users\pixelcommander\Desktop\RRAABBIITT_v0.9.3`.

Append requests only. Recording an idea does not authorize planning or
implementation. Keep tool requests in [TOOL_RUQUEST.md](TOOL_RUQUEST.md).

## Usage

- Read the current list before adding an entry; avoid duplicates.
- Give each new request the next unused `FR-####` ID and its recorded date.
- Preserve the user's intent; label paraphrases rather than presenting them as quotations.
- Append dated clarifications or status changes without erasing earlier requests.
- Leave requests as `Requested` until the user asks for further action.

## Requests

<!-- Append entries using:
## FR-#### — Short title
Recorded: YYYY-MM-DD
Request (paraphrase): ...
Status: Requested
-->

## FR-0001 — One-off tool execution with temporary output

Recorded: 2026-09-20
Request (paraphrase): Add a feature for one-off executions of a tool through the
shared runner, showing its output temporarily for testing.
Status: Requested

### Clarifications — 2026-09-20

User answers (paraphrase):

- Launch testing from a button in the Toolbox.
- Build the input form from the selected tool's settings/input declarations.
- Tentative storage idea: keep test output in local storage for viewing, with a
  way to clear the test.
- Handling write-tool output is connected to this temporary viewing behavior;
  see FR-0002 for the separate code-viewer request.

Not yet decided: whether "local storage" specifically means browser localStorage,
and whether screen output replaces or supplements filesystem writes. Clearing a
test has not been defined as permission to delete generated project files.

### Clarification — code preview and temporary template output, 2026-09-20

User answer (paraphrase): The intended test experience is code preview. A tool
that copies/renames a template folder can generate into a temporary area such as
`.rab/temp/test/[id]`, then show that code. The example location is a storage
direction, not a claim of existing implementation. Reuse numeric IDs, the
canonical stamp and result owner. Do not treat temporary screen output as a
reversal of writes or target the active project's source by default.

## FR-0002 — View generated code in the existing code viewer

Recorded: 2026-09-20
Request (paraphrase): Enhance tools that write code or copy template code so they
can output that code to the screen for the user to inspect in the code viewer
already built in a React project.
Related request: FR-0001 — one-off tool testing and temporary output.
Status: Requested

The existing React code viewer is the intended reuse target; its project/location
has not been identified in this entry. No lookup or implementation started.

## FR-0003 — Context-specific LLM prompt button

Recorded: 2026-09-20
Request (verbatim):

> prompt button that copy and pasts related prompt for user to easily and sepificially engange LLM based on where the the button is

Intent (paraphrase): A button offers a relevant prompt based on its location/context, helping the user engage an LLM with a specific request.
Status: Requested

The user will explain further when they return. Idea recorded only; clipboard/paste behavior, prompt contents, and implementation remain unspecified.

### Clarification and deferral — 2026-09-20

Status: Deferred — the user explicitly excludes this feature from the current
coordinated research/implementation run and wants to think further about it.

Purpose (paraphrase): A contextual button prepares a prompt for the user to copy
and paste into Codex. For example, when adding a tool, the prompt supplies the
current project/location, intended work and guidance to ask needed questions
rather than guess, reducing repeated explanations.

Project-specific prompts are a desired direction. Tool-settings references or a
shared prompts file are exploratory options; exact file format and ownership are
not settled. The user mentioned `settings.js` while brainstorming; this does not
decide executable configuration or supersede existing `settings.json` contracts.
No direct LLM submission is requested. Keep this saved for later; do not build or
continue designing it in the current run.

## FR-0004 — Feature-request page and application-level storage

Recorded: 2026-09-20
Source: user clarification following the discussion of TR-0002.
Request (paraphrase): Add a feature-request page with a form that uses the same
house keys as our tools, and provide `.rab` storage for work that does not belong
to a project, including this application's own todos and feature requests.
Related request: [TR-0002 — Tool request tracker](TOOL_RUQUEST.md#tr-0002--tool-request-tracker).
Owner: unassigned
Status: Requested

Requested form:

- `name`
- `title`
- `description`
- `type`: dropdown with `tool`, `feature`, `ui`, and `stamp`.

Reuse the applicable tool house keys, naming, and record conventions so the form
and saved data remain self-similar. Resolve their exact existing contract before
implementation rather than introducing competing field names or shapes.

Requested storage:

- Use a shared, non-project area within `.rab`, separate from `.rab/projects/`.
- The user suggested a `/base` area or similar; its exact name/layout is not yet
  decided.
- Include an application-owned folder for this application's todos, features,
  requests, and related records, independent of any selected project.

This entry records the requested page and storage direction only. No form,
storage folders, persistence changes, or migration of existing logs has been
implemented under this request.

## FR-0005 — Project viewer and current-project selection

Recorded: 2026-09-20
Source: user request in this session.
Request (paraphrase): A project-viewer page lists all projects in a dropdown. The
user can select a project to view or make it the current project for the work
being performed. This is a base capability, classified as UI + Feature, and may
require new tools.
Domain: `base`
Classification: UI + Feature
Owner: unassigned
Status: Planned — initial outline requested and recorded; implementation has not started.
Related request: FR-0004 — application-level `.rab` storage.

### Current implementation evidence

- `tools/base/list-projects/` already lists saved project names, but deduplicates
  names and does not return selectable project identity records.
- `tools/base/find-project/` returns matching identity records.
- `tools/base/load-project/` loads a project by name, key or root, snapshots
  settings through the memory owner, and returns its latest saved session.
- `bridge/rab-memory.mjs` owns the known-project inventory under `.rab/projects/`
  and returns `id`, `name`, `root`, `key`, plus unavailable records.
- `bridge/project-conversation.mjs` already handles Chat project activation;
  `GET /api/project?session_id=...` and the existing Project panel inspect current
  settings. Some workbench paths still use host-project configuration, so global
  work-context consistency needs explicit verification before claiming support.

### Proposed implementation outline

1. **Base Projects view.** Add a Project Viewer to the existing application,
   available before a project is active. Show a dropdown of all known projects
   across types, a refresh action, and a visible current-project indicator.
2. **Stable selection.** Use the memory owner's project key as the selection
   identity. Display title/name with enough type/path detail to distinguish
   duplicates. Do not manufacture missing metadata or scan arbitrary folders to
   build another project registry.
3. **Preview first.** Selecting a dropdown item displays its current settings,
   identity/type, working or audit input folder, `.rab` storage/results location,
   and available session information. Preview does not change the active project,
   create a session, or update its last-opened metadata. Make missing folders or
   invalid settings visible rather than presenting old snapshots as live data.
4. **Use as current project.** An explicit button activates the selected project
   through the existing session/loading owner. Proposed default: resume its latest
   session, creating one only when none exists, consistent with Chat loading.
   Refresh project-dependent views and default paths together. Clear old pending
   UI selections/approvals without deleting their saved history; never retarget
   an in-flight run. Turn Checker remains independent diagnostics.
5. **Shared tool/service behavior.** Reuse existing list/find/load capabilities.
   Add a backward-compatible detailed list mode or thin facade for keyed records.
   A read-only project-inspection tool is a likely addition; determine its exact
   canonical address before implementation. Chat and UI should call one activation
   owner rather than duplicate switch logic or simulate typed Chat commands.
6. **Storage and scope.** Project settings, sessions and results remain with the
   project's existing `.rab` memory. Any new application-level viewer preferences
   belong to the non-project area proposed in FR-0004 once that layout is settled.
   Treat active work context as belonging to the current window/session; other
   windows must not silently change projects. A new storage layout is not required
   merely to list or preview existing projects.
7. **Verification.** Cover duplicate names, mixed project types, empty inventory,
   missing/invalid settings, preview without activation or writes, session resume,
   stale responses, reload behavior and switching while work is active. Execute a
   representative action after activation and verify its default paths, session,
   results and tracking all belong to the selected project. Check Chat, Project,
   Toolbox and Investigations agree; preserve diagnostic independence.

Expected integration areas (proposal only): existing Magic Box UI, base project
tools, the project conversation/service owner, narrow server routes and dedicated
tests. Coordinate exact shared-file ownership with the other sessions before
implementation. No product code or storage migration is authorized by this outline.

### Accepted direction and lifecycle refinement — 2026-09-20

User feedback (paraphrase): The viewer plan looks good. Switching projects should
allow picking up where the user left off or starting a new step/action. Review
the project/session/step levels as part of the design.

Observed current model: sessions already store `bag`, `groups`, `steps`, and
`turns`; steps belong to groups, and the planner executes a current group through
the shared runner. Chat loading resumes the latest saved session when one exists.
The UI's current **Clear Bag** button actually creates a new session. These are
existing behaviors, not newly implemented lifecycle controls.

Proposed user-facing hierarchy for planned work:

```text
Project
  Session
    Action (existing group)
      Step
        Execution / attempt
```

- **Project:** durable identity, settings, default paths, resources and project
  knowledge. Changing session/action does not discard this layer.
- **Session:** a saved work/conversation context in one project, with history and
  its current position. Users can reopen it or start another session.
- **Action:** one objective, possibly requiring several steps. Reuse the current
  `group` owner; “Action” is a proposed UI label, not a parallel record collection.
- **Step:** one planned operation with inputs, questions, status and result links.
- **Execution / attempt:** an actual tool run, including nested runs and its
  timing, outcome and receipts. Retrying retains earlier attempt evidence.
- **Turn:** a message in the session's conversation timeline, linked to relevant
  steps. Several turns may clarify one step, and one turn may introduce several
  steps; turns are not an additional nesting level.

Proposed project-entry controls:

| Control | Behavior |
| --- | --- |
| View | Inspect project details without activation or session changes. |
| Resume | Restore the last-used session and current action/step for this window/project; validate any remembered selection and fall back to the latest saved session. Restore pending state without automatically executing a write or replaying an uncertain run. |
| New action | Keep the selected project and session history, start a fresh group, and clear prior action targets, answers, temporary inputs and approval state. Existing action history remains saved and accessible. |
| New session | Keep project settings/knowledge, create a clean session and action context, and preserve older sessions for reopening. |

Resolve lifetimes explicitly before implementation: project defaults persist;
session conversation/history persists within its session; action-specific target,
input and approval state must not leak into a new action. Inherit absent canonical
keys through their existing owner without overwriting valid supplied values.
Resuming must recheck source-sensitive prepared approvals. An in-flight execution
keeps its original project/session/action and is never transferred by switching.

Show the current project, session and action together in the UI. Use clear
**New session** wording for controls with that behavior instead of implying that
only a few fields were cleared. Non-project application records from FR-0004 are
a separate storage scope, not a fabricated project above this hierarchy.

Add verification for the three distinct transitions (resume/new action/new
session), preservation of older work, stale target/approval removal, remembered
session fallback and concurrent-window behavior. Detailed schema changes, final
labels and implementation remain to be settled within the existing owners.

### Core requirement: self-similar folders and contracts — 2026-09-20

User clarification (paraphrase): Project, session, task/action and other levels
must be self-similar. Each folder needs its own `settings.json` or equivalent
canonical descriptor, using the same house keys and a similar shape so the
structure can repeat fractally. This is a foundation requirement, not merely a
visual hierarchy for the viewer.

Design direction:

- Define one shared node/descriptor contract before implementing the viewer or
  changing persistence. Each work level owns a folder and the same descriptor
  filename/shape, with its own identity and references to its children.
- Reuse canonical keys and their meanings. Current Tool House descriptors already
  use `id`, `name`, `title`, `description`, `settings`, and `meta`; current project
  settings use `id`, `name`, `type`, and `paths`. These are observed starting
  points, not evidence that a unified contract is already implemented. Reconcile
  existing meanings once; do not repurpose `settings` (currently tool input
  declarations) as arbitrary runtime state or silently change what `type` means.
- Keep the common identity/description/relationship shape at every level.
  Level-specific settings and artifacts extend it through defined contracts.
  Sessions, tasks and steps can have different responsibilities without inventing
  unrelated identity or path vocabularies. Final hierarchy labels and relationship
  keys must be resolved with the current owners; retain existing `group` identity
  until any deliberate migration is defined.
- Preserve the bag contract: each level accepts the contract it passes onward,
  fills only absent keys from its own defaults, and preserves supplied values
  including valid `false`, `0`, and empty strings. Lifecycle reset rules still
  determine which temporary action values are passed to a fresh action.
- Give descriptor creation/validation/loading/saving one shared owner and a
  canonical stamp. Typed wrappers and the viewer reuse that owner at every level;
  they do not each implement their own filesystem or inheritance logic.
- Let the same viewer render a node's shared fields and its children, with typed
  detail views where needed. Application-level todos/features can use the same
  base contract while remaining outside project storage.
- Keep durable configuration identifiable separately from changing runtime
  history/results, using consistent companion-record conventions if needed.
  Repeating the descriptor does not require copying parent history or full
  execution payloads into every child.

Current departure: sessions are saved as `sessions/<id>.json` containing embedded
groups/steps/turns, rather than folders with their own descriptors. Meeting this
requirement therefore involves a versioned storage/reader migration, not just
adding dropdowns or empty settings files. Preserve old session IDs, links,
receipts and original history; avoid two independently writable sources of truth.

Next design step: settle the shared descriptor and bag/child relationship rules,
then define compatibility and migration, then build the viewer and lifecycle
controls against that shared contract. This update records the requirement; it
does not migrate existing project/session data.

### ID-addressed folders; optional depth — 2026-09-20

User correction: use `sessions/[session-id]` and, if that level is needed,
`tasks/[task-id]`. The earlier generic `session/` and `task/` tree labels were
illustrative placeholders, not literal folder names or names derived from titles.

Each implemented level uses its stable ID as the folder name and the shared
descriptor inside that folder. Task/step folder depth remains optional; do not
introduce extra nesting solely to fill out the illustration. The same house
contract applies at whichever levels are actually adopted.

### Numeric house IDs — 2026-09-20

User correction: IDs must be numbers generated from `Date.now()` or the canonical
numeric equivalent. No extra hashes, random suffixes or descriptive prefixes.
This applies to the shared identity contract throughout the proposed hierarchy.

- Store `id` as a JSON number. ID-addressed directory names are its decimal text,
  for example `sessions/1789920825354/settings.json`.
- Keep name, title, type and parent relationships in their own canonical fields;
  do not encode them by changing the numeric ID into a prefixed/composite string.
- One shared numeric allocator should own creation. `Date.now()` alone can repeat
  within a millisecond; collision handling must retain numeric IDs and prevent
  overwrites, including between cooperating processes. The existing tool stamp's
  `Math.max(Date.now(), maxExistingId + 1)` is a local numeric precedent, not proof
  of concurrency-safe allocation. Define that reservation behavior once.
- Parent scope remains useful context for references; it does not justify a new
  hash-based identity convention. Content-integrity hashes remain separate from
  record IDs.

Observed drift in current code:

- `bridge/rab-memory.mjs`: session and failure IDs use timestamp plus random hex.
- `tools/audit/stamp-new-project/stamp-new-project.mjs`: project IDs use
  `project-` plus timestamp and random hex.
- `tools/_stamp-engines.mjs`: default project IDs use a `project-` prefix.
- `bridge/session-planner.mjs`: groups, steps and turns use prefixed counters.

Record this as compatibility/migration work for the self-similar model. Existing
history and reference links must be preserved through an explicit mapping/read
strategy; do not strip suffixes or renumber saved records in place. This update
corrects the design contract and documents current drift; generators are not yet
changed by this planning entry.

### Semantic folder organization and anticipated problems — 2026-09-20

User preference: use meaningful nested folders as a secondary organization/tagging
mechanism for tools, audits and other things. Examples supplied by the user:
`tools/audit/css`, `tools/build/react/css`, `tools/build/vanilla/css`. Prefer this
to encoding the entire hierarchy in flat filenames such as
`tools/build/build-react-css.mjs`. The user requested assessment before changes.

Observed support: Tool House already recursively discovers leaves, exposes path
segments as tags, infers selected semantics from those segments, and supports a
nearest-parent executor. Tool IDs are catalog-wide permanent identities; duplicate
IDs make tools unavailable. The earlier discussion of parent-qualified references
does not override that existing tool uniqueness requirement.

Assessment and proposed rules (assistant recommendations):

1. Keep numeric ID as stable identity, folder path as current address/context, and
   the descriptor as the record. A move retains identity. Refresh the existing
   discovery/address owner and verify references; never leave a second writable
   registry or silently redirect stale identity/path pairs.
2. A tree supplies one primary grouping. Cross-cutting classifications such as
   CSS, accessibility, React and performance also need metadata/search views. Keep
   one canonical home for a tool; do not copy executables into several categories
   merely to give them more tags. Distinct wrappers may share one executor through
   the existing owner when they are genuinely distinct capabilities.
3. Agree meanings/order for path segments. The current first segment is the
   domain, so `build/react/css` would have domain `build`, not `react`. Routing,
   vocabulary, stamps and metadata validation need an explicit migration if this
   taxonomy is adopted. Path-derived classification and explicit declarations
   need defined precedence and visible conflicts, not two drifting values.
4. Treat moves as behavior-sensitive where inheritance exists: nearest-parent
   executor, defaults and contracts can change. Show inherited owners and check
   behavior before/after a move. Folder depth alone must not authorize execution
   or change a tool's read/write permissions.
5. Resolve container versus executable discovery before putting `settings.json`
   in every category folder. Today each discovered descriptor is validated as a
   tool and must have its own or an inherited executor. The shared descriptor
   needs an agreed way to identify the node's role; classification folders must
   not accidentally become executable tools.
6. Keep readable semantic paths for capabilities and numeric-ID paths for saved
   work records, as appropriate to their existing roles. Both can share identity
   keys, readers and viewer structure; neither a leaf word nor an ID folder alone
   should be treated as the complete record contract.
7. Handle numeric ID collisions through a shared reservation owner. Millisecond
   time alone cannot guarantee uniqueness across concurrent processes/machines or
   clock changes. Keep the user's numeric rule and preserve scope requirements;
   do not restore random/hash suffixes as a shortcut.
8. Keep nesting meaningful. Test real full paths and discovery cost, normalize
   casing/separators, retain excluded/link boundaries, and keep empty structural
   levels out. Cache/index data should remain derived and refreshable through its
   existing owner.

Suggested next design output: one concrete example covering a category node, a
tool leaf and a saved session node using the shared descriptor, followed by checks
for discovery, defaults, stable identity on moves, and resume behavior. No tools,
registries or saved project data were moved by this assessment.

### Routing through semantic branches — exploratory discussion, 2026-09-20

User intent (paraphrase, deliberately not fixing the example wording/paths): the
folder tree can be the routing structure. Recognize the requested operation and
subject, use project settings to select the applicable platform/specialization,
then resolve the appropriate capability along its semantic path. Related platform
variants keep the same contract. A session can move from creating artifacts to
examining them and back, without changing projects. Word/phrase associations map
natural language onto canonical operations and branches.

The user's example labels, hierarchy order and synonym lists were brainstorming,
not approved literal folder names or vocabulary entries. No mappings were trained,
registries rewritten or branches renamed as part of this discussion.

Interpretation and proposed behavior:

- Treat path segments as declared semantic dimensions that the existing parser
  and resolver understand. Fill the applicable dimensions from the request and
  project settings, then resolve through Tool House. Shared node/contract shape
  does not require every branch to contain the same number of levels.
- Keep project type/platform and default source paths durable. Track the current
  work intent/branch as session/action context, and record the actual resolved
  path/ID/inputs on each step. An inspection step does not convert a React/HTML
  project into a different project type.
- Explicit compatible information in the current request takes precedence over
  inherited branch context. Project settings supply relevant absent specialization;
  recent branch context helps incomplete follow-ups. Retain or leave the prior
  branch based on the next request's meaning, not how often the prior stamp ran.
  Explicit incompatible requests surface a conflict instead of rewriting settings.
- Resolve phrase associations to the canonical operation/subject through the
  existing language owner. Avoid universal single-word-to-domain rules: context
  and the requested object distinguish otherwise ambiguous verbs. Store the
  evidence for each resolved dimension so Steps can explain the choice.
- Capabilities can inherit shared executors/defaults under the agreed bag
  contract. A framework-specific creation branch may need a platform choice;
  a shared stylesheet inspection branch may not. Prefer the supported shared
  capability rather than copying one tool across every platform folder.
- Path-based family/specialization already supplies many of the associations the
  user wants. Additional free-form tags are optional, only for relationships not
  expressed by the chosen tree; they are not a prerequisite for this routing model.
- Each run remains bound to its recorded step/project/source and normal execution
  authority. Changing branch never executes a write, changes another window's
  project or transfers an in-flight run.

Current implementation points to reconcile:

- The parser already has operation senses and explicit-versus-inherited domain
  evidence, and the planner saves `bag.domain`. Domain presently mixes notions of
  work mode and technology/category; a richer path hierarchy needs these meanings
  resolved within the shared contract instead of inventing another router.
- The planner can select read tools across domains for audit intent. This is
  partial existing support, not proof that arbitrary branch switching works.
- Automatic saved read reports currently depend on `projectSettings.type ===
  'audit'` in the memory/runner path. Mixed creation/inspection sessions must be
  able to persist their investigation results in the same project's `.rab`
  storage without falsifying the project's type.

Proposed acceptance scenario: within one saved development-project session,
perform several creation requests, request a stylesheet summary, make an
inspection follow-up, then request another creation. Verify each step's selected
path/ID, inherited platform and folder, explicit-request precedence, saved results,
and preserved project identity. Also test an ambiguous request and another window
remaining on its own project. This is a design direction, not completed behavior.

### Refinement: path as matching evidence — 2026-09-20

User clarification (paraphrase): when several capabilities match, their paths
provide additional weight for deciding which candidate is valid and best fits the
context. The path is not intended to be the sole way to discover candidates.

This refines the preceding routing discussion: find candidates from the request's
meaning, evaluate declared compatibility, then use the path's relevant branch and
specialization as contextual ranking evidence. Project settings and recent work
context help rank compatible alternatives. Path depth or number of matching words
alone must not win; explicit current intent beats stale branch preference.

The current Tool House matcher already exposes `shape_score` and `path_score`.
Extend and verify that shared owner rather than adding a separate routing system.
Keep hard contract/compatibility checks separate from ranking: extra path weight
cannot make an incompatible capability valid or grant write permission. If the
remaining candidates are still materially ambiguous, preserve that ambiguity and
ask for the missing distinction instead of choosing by folder order.

Record why the winner matched (request meaning, supplied/project settings and
path context) so the decision is visible in Steps/diagnostics. No exact weights or
phrase mappings are approved by this clarification; they need representative
examples and conflict tests.

### Local storage clarification and planning milestone — 2026-09-20

User confirmed that normal first run creates `.rab` under the current Windows
user's home on the computer running the application: `C:/Users/<username>/.rab`.
Each computer owns its local data. Multiple windows/processes on that computer
coordinate through the same storage owner; server/laptop synchronization or shared
storage is not requested in this run. The house registry, audited folder and source
repository are separate from this application-memory home.

The user selected Project Viewer/switching (FR-0005) and the request page (FR-0004,
overlapping TR-0002) as the first milestone. Independent research and cross-review
from Inspect RRAABBIITT v0.9.3, Review audit stamps and Activate rraabbiitt are saved
in [the compared plan](../../comms/2026-09-20-feature-planning/comparison-plan.md).
It is a proposal, not a claim that these features or numeric continuation are built.
Prompt-button work remains explicitly deferred.

### Implemented first milestone and folder pipeline — 2026-09-20

FR-0004/TR-0002 Requests and FR-0005 Projects now have UI and memory-owner APIs.
Projects supports read-only preview, Resume, New action and New session, with
per-window selection. Requests saves house-shaped app-owned records without a
selected project. Numeric identity and project/session descriptor support are
implemented for fresh records; the user explicitly removed legacy continuation
from this run.

The folder index/runner slice adds disk-backed numeric folder records, bounded
pages, per-folder supervised Tool House executions and saved timing/results. This
does not claim all audit engines stream, automatic crash resume, or a complete
progress UI. Code reviewer, preview tester and prompt-button work remain deferred;
path-context ranking and broader storage unification remain follow-ons.

Current behavior, limits, tools and paths:
[Project workspace and folder runner](../vision/PROJECT_WORKSPACE_AND_FOLDER_RUNNER.md).
Validation and unresolved items:
[execution record](../../comms/2026-09-20-feature-planning/execution.md).

## FR-0006 — Persistent chat groups and history navigation

Recorded: 2026-09-21
Request (paraphrase): Keep previous chat messages in the project when a group
finishes, with an indication of whether it completed, was canceled or errored.
The user reports that previous messages currently disappear when a group finishes.
Provide a way to return to groups: a continuous conversation with separators, and
possibly a left column whose entries jump to the beginning of the selected group.
Related request: FR-0005 — project viewer and current-project selection.
Status: Requested

### Proposed presentation — 2026-09-21

- Keep one chronological conversation per session, retained under the project.
  Starting another group must not erase earlier messages. Older sessions remain
  accessible through the project's saved-session selection.
- Label each group separator with a readable title and outcome: Completed,
  Canceled or Errored. Show pending/running work accurately, and distinguish an
  interrupted or uncertain run from a known failure. Preserve partial successes
  and the individual step outcomes inside a group.
- Add a left-side group navigator that scrolls to the group's first message.
  If that part of the history is not loaded, load it before navigating. Browsing
  an old group does not change the active execution context or replay tools.
- Keep the existing right-side preparation, Steps and Project controls. A
  labeled separator can provide the requested dividing line without losing the
  group's meaning or status.

These are proposed details, not an implemented layout or a new storage contract.

### Read-only findings and implementation considerations — 2026-09-21

The current memory owner already saves session `turns`, `groups` and `steps` in
the project's `sessions/<session-id>/state.json`. `presentSession()` returns all
three collections. Completing execution saves the session and sets the group to
`completed`; cancellation records `cancelled`. Execution failures are saved on
steps as `execution-failed`, so a group outcome cannot rely solely on
`group.status`. A new action preserves turns but can mark an earlier group
`superseded`, another reason to retain and consider the step outcomes.

The current chat renderer restores the selected session's turn text and saved
`turn.reply` values, without group separators or navigation anchors. Some live
Box replies are instead generated by `sessionReply()` from current gaps/status,
and UI error bubbles are appended locally. Those display-only messages are not
all represented as saved replies for restoration. Preserve the actual replies
and outcome events through the existing session owner; do not regenerate old
questions from a group's later state or create a second transcript writer.

The inspected completion path does not itself delete turns. Chat rebuilding
occurs when restoring or changing sessions, including project transitions. The
user's exact disappearing-history event has not been reproduced, so its trigger
still needs tracing; these source findings are not proof that every message
shown in the running UI was saved successfully.

Reuse existing group/step/turn identities and associations. Keep ungrouped turns
visible and preserve chronological order when a turn relates to multiple steps
or groups. Avoid duplicating messages to manufacture a group association. Audit
payloads remain in their existing result files, referenced from history.

Acceptance should cover successful, canceled, failed, mixed-outcome and
interrupted groups; reload and resume; starting another group/session; project
switching; and long histories. Verify the saved conversation and displayed
outcomes, plus navigation that neither executes work nor changes the active bag.
Use isolated test storage under the agreed test-home convention. Coordinate
changes to the session owner/UI with the storage-reconciliation owner.

This entry adds documentation only. No runtime, saved project data, services or
UI were changed for this request.
