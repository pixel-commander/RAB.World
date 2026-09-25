# Shared tool request log

## Storage clarification — 2026-09-21

The entries below are a historical planning log. New tool requests use the
Requests page or `base/create/request` with type `tool`: Global / shared saves
under the configured `.rab/feature-requests/`; project scope saves under the
owning `.rab/projects/<existing-project-directory>/feature-requests/`. Do not
save new request records or duplicate them in docs. Preserve earlier entries
and their provenance; plans and implementation reports may link to those
records. This dated clarification supersedes the older new-entry instructions
below.

Location: `docs/feature-request/TOOL_RUQUEST.md`.
Running list only: append requests; do not plan or implement them unless asked.

Canonical log for user-requested tools in
`C:\Users\pixelcommander\Desktop\RRAABBIITT_v0.9.3`.
All sessions working on this project use this file, not a separate copy in
Documents/ChatGPT. Created 2026-09-20.

## How to use this log

- Append each new user tool request at the end with the next unused `TR-####` ID.
  Read the current file before appending; check for an existing matching request.
- Preserve the original request and intent. Label paraphrases and assistant
  suggestions; do not turn suggestions into user requirements.
- Append dated updates under the existing request for clarifications, decisions,
  ownership, blockers, implementation links and verification. Do not erase prior
  entries or silently rewrite the history.
- Use statuses: `Requested`, `Needs clarification`, `Planned`, `In progress`,
  `Blocked`, `Done`, `Deferred`, or `Cancelled`. The latest dated status entry wins.
- Recording a request does not authorize implementation. Confirm scope and
  existing user authorization before starting. Check for another session's owner.
- Link detailed plans in `../todo/` and evidence in `../session-audits/`. Keep this log
  as the shared request record, not a second competing implementation plan.
- Mark `Done` only with implementation and verification evidence. Keep completed
  and cancelled requests in the log so they remain traceable.

### New request template

```text
## TR-#### — Short title
Recorded: YYYY-MM-DD
Source: user request / conversation reference
Request: exact quotation or clearly labeled paraphrase
Desired outcome:
Scope / constraints:
Open questions:
Owner: unassigned
Status: Requested
Related plan / implementation / evidence:

### Updates
- YYYY-MM-DD — Status: ... — decision, progress or verification evidence.
```

## Requests

No historical requests have been backfilled yet. This is not a claim that earlier
requests were completed or cancelled. Append new requests below; backfill older
ones with their source and explicitly unverified status when appropriate.

## TR-0001 — Guarded dataset row-rendering stamp

Recorded: 2026-09-20
Source: user request in this session, immediately after creating this log.

Request (verbatim):

> need a tool that will loop through a specified data set and print the rows using a pre-approved style of map?.(item) that uses the strict guards on looping and mapping. but we also need the stamp to determine if the we're getting data form a file, or db call somewhow

Desired outcome (paraphrase): A tool/stamp that generates row rendering for a
specified dataset using the project's approved guarded iteration pattern, and
determines whether the data comes from a file or a database call so the generated
code handles the appropriate source.

Scope / constraints:

- Use the current project's canonical mapping/looping guards and approved stamp
  shape. The quoted `map?.(item)` is intent shorthand, not an approved executable
  implementation; resolve the exact syntax from current rules before building.
- Determine the data source from available evidence; do not silently invent a
  file format, database connector, query, or schema.
- This entry records the request only. No implementation or database access has
  been started or authorized by adding it to the log.

Open questions for planning:

- Does "print the rows" mean React/UI rendering, textual output, or another
  target? Where should the generated code be placed?
- What are the exact approved collection, item, field and fallback guards?
- What input identifies the dataset and its row shape?
- Should source determination inspect existing bindings/imports and loader code,
  accept explicit source metadata, or ask the user when evidence is insufficient?
- Is the stamp wiring an existing file/database loader, or also generating one?
  Which file formats and database access contracts are in scope?
- What should loading, empty-data and error states look like, and how are row
  identities/keys supplied where required by the rendering target?

Owner: unassigned
Status: Requested
Related plan / implementation / evidence: none yet.

### Updates

- 2026-09-20 — Status: Requested — Logged as the first shared tool request;
  planning questions above are assistant-identified, not additional user requirements.

## TR-0002 — Tool request tracker

Recorded: 2026-09-20
Source: user request in this session.
Request (paraphrase): A tool that makes requests for new tools easier to track.
It should ask what type of tool is being requested, with choices such as audit,
template, stamp, base, shared, etc.

Owner: unassigned
Status: Requested

### Updates

- 2026-09-20 — Added to the running request list only. Per the user's clarification,
  these entries do not require planning or implementation until requested.

### Related feature-request page — 2026-09-20

- Status: Requested — The user expanded the request with a feature-request page
  containing `name`, `title`, `description`, and a `type` dropdown with `tool`,
  `feature`, `ui`, and `stamp`. Reuse the current tools' house keys and conventions
  to keep the form and records self-similar.
- Store non-project work in a shared area of `.rab`, separate from project
  storage. The user suggested `/base` or similar, with an application-owned folder
  for this application's todos, features, and other requests. Exact directory
  naming remains open; `/base` is a suggestion, not an established contract.
- Canonical page/storage request: [FR-0004 — Feature-request page and application-level storage](FEATURE_REQUEST.md#fr-0004--feature-request-page-and-application-level-storage).
  This is a recorded request only; no form or storage implementation is started.

## TR-0003 — Audit Factory roadmap implementation plan

Recorded: 2026-09-20
Source: user request in task “Inspect RRAABBIITT v0.9.3”.
Request (paraphrase): Turn the previously saved Audit Factory roadmap into a concrete plan, show it to the user, coordinate with “Review audit stamps” to avoid conflicts, and enlist help if available.
Desired outcome: A phased plan for evidence records, reliability, a class/atom investigation, declared knowledge and UI, approved changes with verification, and bounded human/cloud handoffs.
Scope / constraints: Planning, documentation, and direct coordination are authorized. Product implementation has not started under this plan. Preserve other tasks’ edits and existing evidence; runtime results belong in the selected .rab project.
Open questions: Implementation authorization; exact public investigation-tool path; persistence/concurrency owner; eventual shared UI/runner integration handoff.
Owner: Inspect RRAABBIITT v0.9.3; Review audit stamps retains discovery/contracts/Toolbox and has offered a later read-only adapter review.
Status: Planned
Related plan: [Audit Factory implementation plan](../todo/audit-factory-implementation-plan.md).

### Updates

- 2026-09-20 — Status: Planned — Saved the phased plan and linked it from the roadmap. The other task confirmed no conflict for future private helpers in tools/audit/_evidence/ and dedicated tests in tests/audit-evidence/. Its descriptive catalog contracts must not be treated as runtime validators. Detailed adapter review and shared integration ownership remain pending; no additional implementation was assigned.

- 2026-09-20 — Status: In progress — User authorized implementation with “ok go please” and asked both available tasks to help. The class/atom workflow, source evidence adapter, approved single-file CSS plans, verification and local handoffs are implemented; final tests/browser checks are in progress. Activate rraabbiitt completed focused persistence fixes; Review audit stamps owns the new Investigation UI. See [implementation contract](../domains/audit-evidence.md). Earlier planning-only entries above remain historical.

- 2026-09-20 — Status: First milestone complete; broader roadmap remains open — The class/atom investigation, UI, declared intent, bounded approval/execution, verification and local handoff are delivered. Final default suite: 496/499 passed; three existing Windows symlink-setup EPERM failures. Generated-app build/browser verification passed, and the real-project audit preserved all 45 scoped source files. Both assisting tasks released their completed scopes. See [completion report](../session-audits/2026-09-20-audit-factory-class-investigations.md) and [remaining work](../todo/audit-factory-roadmap.md).

## TR-0004 — Project mapper with folder identities

Recorded: 2026-09-20
Source: user request in task “Review audit stamps”, following the streaming-results discussion.
Request (paraphrase): Add a project-mapper that takes a folder and indexes its structure. Assign folder IDs so separate audit JSON files can reference folders, including README discovery and per-folder file-type counts. Assess flat versus nested storage and research how other applications do this.
Desired outcome: One reusable project structure map, with independent audit datasets linked to its folder identities.
Scope / constraints: Record the request and research the design only. Input should follow the existing `folder` contract; reuse project-path binding and persistence. Keep runtime maps/results in the selected `.rab` project and the audited folder unchanged. Do not create a competing house/project/tool registry or a manually maintained folder inventory.
Open questions: Final public tool address and output contract; identity across renames, removal/recreation and root changes; exclusion policy; whether initial mapping includes lightweight file entries; refresh and retention policy.
Owner: implementation unassigned; assessment recorded by Review audit stamps.
Status: Requested
Related assessment: [Project mapper and audits driven by its index](../session-audits/2026-09-20-project-mapper-and-index-driven-audits.md).
Related work: [Streaming results and live progress](../todo/streaming-audit-results-and-live-progress.md); TR-0005 below.

### Updates

- 2026-09-20 — Status: Requested — Researched Watchman, Everything, Git and Windows identity APIs. Assistant recommendation: flat ID-keyed folder records with parent IDs and relative paths; generate nested trees for display. Audit references should include an immutable map version. Stable folder identity and rename detection are separate concerns. Large maps should use bounded records/paged reads rather than one giant JSON string. These are proposals, not implemented behavior or additional approved requirements.

## TR-0005 — Batch audits driven by the project index

Recorded: 2026-09-20
Source: user follow-up in task “Review audit stamps”.
Request (verbatim):

> then maybe a second runner that's build for this, can loop the project index folder list... and use that to populate whatever audit or scan we're performing

Desired outcome (paraphrase): Iterate indexed folders to populate a selected audit or scan, with results associated with the shared folder identities.
Scope / constraints: Idea recorded only. Assistant recommendation: a batch coordinator over the existing Tool House runner, preserving sessions, validation, authority, tracking and the canonical result writer. Per-folder work must declare direct-folder versus recursive scope to avoid repeated scans; whole-project analyses need their full context.
Open questions: Tool capability contract for indexed input; direct folder versus file inventory iteration; concurrency, cancellation, resume/retry and aggregation behavior.
Owner: implementation unassigned.
Status: Requested
Related request: TR-0004 above.
Related assessment: [Companion runner assessment](../session-audits/2026-09-20-project-mapper-and-index-driven-audits.md#the-companion-runner).
Related work: [Streaming results and live progress](../todo/streaming-audit-results-and-live-progress.md).

### Updates

- 2026-09-20 — Status: Requested — Recorded the follow-up with an explicit warning about recursively scanning descendants once per ancestor. A folder index alone does not eliminate file enumeration or content reads. Lightweight file inventory can support README-name and extension-count queries; arbitrary existing tools still need explicit compatibility. No second executor, scan, runtime artifact or service was created.

## TR-0006 — Review LLM-submitted code before writing

Recorded: 2026-09-21
Source: user request in task “Review audit stamps”.
Request (paraphrase): Add review stamps or extend the current ones to review code
before it is written to a file, supporting a tool that reviews code an LLM submits
to the write tool.
Desired outcome: Return actionable review findings before accepting proposed
code for writing, so the LLM can correct its submission.
Owner: implementation unassigned; existing code-review lane authored by Inspect
RRAABBIITT v0.9.3.
Status: Requested
Related implementation/evidence: [Current code-review tools](../session-audits/2026-09-20-code-review-toolbox.md).
Related work: [Shared tool prerequisites](../todo/shared-tool-prerequisites.md).

### Existing behavior verified from source — 2026-09-21

- `code-review` already accepts `file` (intended relative path), `code`, optional
  supporting `css`, and selected `checks`. The current groups cover guard/prop
  patterns, grid structure, and CSS atoms/states. Inputs are bounded to 256 KiB
  combined code and CSS. These are static pattern checks, not syntax, type,
  build, runtime or general security validation.
- `code-review/write` requires confirmation and project context, invokes the
  installed reviewer itself, and checks the reviewed file/code hash before
  creating the destination. A failed or entirely skipped review blocks that
  write. It creates new files only and is not a gate on every existing writer.
- The review currently stages proposed source in
  `.rab/temp/test/<evidence-id>/source/` for the folder-based audit engines, then
  saves review evidence. This is before the destination write, but is not review
  before any source-file write. Current checks are selectable by the caller;
  a mandatory policy for LLM submissions is not already implemented.

### Suggested extension, not an implemented contract — 2026-09-21

Reuse the existing checker logic through a shared source-text interface. Folder
audits would read a file and call it; proposed-code reviews would pass the code
directly. Preserve the same findings rather than duplicating rule engines.
Checks that require sibling files, imports or CSS must receive their context or
report missing coverage instead of silently passing.

The intended flow is submission -> review -> findings and no destination write,
or accepted review -> write the exact reviewed bytes. The writer should own its
required review policy; an LLM-provided pass flag or omitted required checker
must not authorize writing. Keep the existing runner lineage, result owner and
execution authority. Bind acceptance to the submitted path/content and relevant
review context; a changed submission needs review again.

For replacements or patches, review the resulting full file and verify that the
original destination has not changed before applying it. This extends the
current create-only writer and still needs implementation scope. Whether review
evidence retains submitted source is separate from reviewing it in memory.

No runtime code, stamps, saved project data or services were changed for this
entry. Future implementation should coordinate with the current review/runner
owner and verify blocked writes, exact-byte writes, changed submissions,
missing context and unsupported checks in isolated test storage.

### Manual testing and literal code input — 2026-09-21

User clarification (paraphrase): Allow testing the review tool by hand in the
Box, typing code and seeing what gets rejected or accepted, without losing `<`,
`/`, `:`, or other special characters.

Current source supports manual testing through Toolbox's generated Proposed
code textarea: it reads the field's `.value` directly and sends structured JSON
to the tool runner. The reviewer retains the original string and reports its
hash. The ordinary chat language parser is not an exact-code channel: its
normalization collapses whitespace and replaces curly quotes. Do not promise
lossless code submission through ordinary command parsing.

Assistant recommendation: use the existing review-only textarea immediately;
if submission is added to Chat, keep literal code separate from the command
text, using a dedicated code field or an explicitly protected code block before
language normalization. Display code as text, not interpreted HTML, and use the
same reviewer/policy that the reviewed writer uses. Show the actual review
verdict and rule/line findings, separately from tool execution success.

Verification should include JSX angle brackets, closing tags, CSS pseudo-class
colons, backslashes/Windows paths, quotes/backticks, ampersands, braces, Unicode,
tabs and multiline input, plus known passing/failing examples. Compare the
submitted string with the reviewed string; specify newline handling rather than
claiming a textarea preserves an imported file's original line-ending bytes.
Manual review must leave the intended destination untouched. The existing
reviewer's scratch evidence is still written as described above until the
in-memory extension is implemented. This clarification records requirements;
no UI or runtime change was made.

### Chat side-column placement — 2026-09-21

User clarification (paraphrase): Use the side column for the manual code-review
input described above.

Interpretation: use Chat's existing right-side temporary input panel, keeping
the conversation visible. Reuse the declared tool fields and shared submission
path for the intended filename, literal code and any supporting inputs. The
code field must bypass natural-language normalization. A Review action shows
the review verdict and rule/line findings in the panel, allowing the user to
edit and submit again without writing the destination file. Changing the code
makes the previous verdict apply only to the earlier submission.

This extends the previously discussed runner-provided input panel; it does not
call for a separate reviewer, executor or permanent competing form schema.
Related work: [Run preparation and input panel](../todo/run-preparation-and-input-panel.md).
Status: Requested. Placement recorded; UI implementation has not started.

### Shared runner owns the panel's fields — 2026-09-21

User clarification (paraphrase): The side column must interact with the Box
runner, which gathers all fields needed to execute as the Chat input grows.
The review form is an instance of that shared preparation view. Tool declarations
and current Step bindings determine its fields; submitted values return through
the same planner/runner path. Literal code remains separate from language parsing.

Current implementation updates requirements from submitted turns and accepts
panel answers. While typing, only tool search updates; preparing requirements
from the draft and discovering all nested requirements remain incomplete.
Recorded in [the shared preparation checklist](../todo/run-preparation-and-input-panel.md#clarification-runner-driven-fields-as-chat-develops--2026-09-21).
No separate review form owner or runtime change was introduced by this update.
