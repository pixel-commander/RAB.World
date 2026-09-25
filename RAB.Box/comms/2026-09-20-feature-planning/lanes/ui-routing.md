# UI, tooling experience and path matching — independent lane

Owner: Inspect RRAABBIITT v0.9.3. Date: 2026-09-20.
Status: independent research reviewed by both lanes; updated for user decisions.
Product code unchanged. No tool execution, training, installs or service changes.

## Controlling user decisions

The first milestone is project switching and the request page. Supported template
tests should show code preview, with generated copies under the proposed
`.rab/temp/test/[numeric-id]`. They do not need registration as ordinary projects.
FR-0003 (prompt button) is deferred from this entire run, including further design.
Its earlier exploratory section below is retained as superseded research only.
See [the compared plan](../comparison-plan.md) for delivery order and scope.

## Current owners and verified gaps

- `magic-box/index.html:166,836–856,976`: a Tool runner already creates a form
  from input declarations and calls `/api/tools/run`. Calling this route performs
  a real execution; the return is currently formatted wholesale into a `pre`.
  The dedicated Toolbox already has contract-shape previews; those are descriptions,
  not trial output.
- `bridge/service.mjs:236`: toolsRun resolves project context through the supplied
  session. It lacks an explicit disposable-test lifecycle. The separate legacy
  workbench file/history/config paths still default to the host project in places.
- `bridge/service.mjs:155`: receipt file viewing bounds reads and requires a file
  named in a completed receipt. Reuse its artifact authorization concept, then
  resolve the correct project/session/run rather than broadening to arbitrary paths.
- `tools/_artifact-plan.mjs`: shared template rendering is separate from guarded
  no-overwrite writing and byte verification. This can support preview for stamps
  that use it; it does not confer a universal dry-run mode on every tool.
- `tools/base/{list-projects,find-project,load-project}` and
  `bridge/project-conversation.mjs`: listing/loading/session restoration owners
  exist. The names-only list cannot identify duplicate names uniquely. Loading
  calls openProject, which writes snapshots/last-opened state; a browse-only view
  needs a genuinely read-only inspect path.
- `bridge/tool-house.mjs:175–226`: current selection combines text/path/shape
  scores. It exposes matching reasons, but repeated terms can accumulate weight;
  final equal scores use lexical path order. Planner selection then adds its own
  heuristics. A top-ranked search result is not proof a complete request is executable.
- `bridge/seat-parser.mjs`: existing domain/operation/target evidence and reviewed
  global/project vocabulary are the language owners. Reuse these rather than
  maintaining button-specific synonym tables.
- `tools/react/stamp-new-project/template/RULES.txt`: canonical components,
  house grids, atoms/skin separation, supplied-value preservation, URL navigation
  and generated-output verification govern a React artifact. It does not specify
  the exact guarded dataset iteration contract requested in TR-0001.

Targeted searches found no `CodeViewer`/`CodeView` implementation in the current
app/templates or the known builder campaign. This is a bounded negative finding,
not proof it exists nowhere. The intended React viewer still needs its owner
identified; avoid installing an editor package as a substitute by assumption.

## Alternatives and recommendations

### One request lifecycle, several views

**A — Separate tool and feature CRUD systems:** quick local forms, but duplicate
status/ID/persistence rules and awkward UI+Feature classification. Reject as the
default because it conflicts with self-similarity.

**B — One shared request record with typed views:** recommended. The identity lane
owns the descriptor; this lane owns controls derived from its field declarations.
Use `name`, `title`, `description` and the agreed type classification. Preserve
FR/TR references as historical source labels, not replacement product IDs. Record
source wording, decisions, status and related implementation/evidence through the
shared contract. UI+Feature can be one primary type plus an agreed classification
facet; do not overload the existing tool `meta.domain` or introduce a second type
meaning without agreement.

**C — Adopt an external ticket system as authority:** useful connector later, but
adds an account/runtime dependency and does not solve local `.rab` identity. It
can be a replaceable projection, not the first owner.

Proposed input example, not the final persisted descriptor:

```json
{
  "name": "project-viewer",
  "title": "Project Viewer",
  "description": "Inspect a saved project and resume or start work in it.",
  "type": "feature"
}
```

The shared owner allocates the numeric ID and validates the final record. UI
controls do not mint IDs or copy storage logic. JSON Schema's annotations are
useful prior art for title/description/default hints, but `default` does not itself
populate missing values during validation. Existing house bag/default ownership
remains necessary. [JSON Schema annotations](https://json-schema.org/understanding-json-schema/reference/annotations).

### Project viewer and action controls

**A — Dropdown immediately activates/resumes:** fewer clicks, but ordinary browsing
changes state and races with stale requests. Not preferred.

**B — Preview selection plus explicit Resume / New action / New session:** preferred.
Show project, session and action together; typed child lists can reuse the same
node viewer. Resume restores pending work but never reruns an uncertain execution.
New action starts a group through the current owner, retaining history but clearing
action targets/answers/approval. New session preserves durable project knowledge.
The identity lane settles storage details and reference compatibility.

The active selection should belong to a window/session, while the execution pins
its actual project/session independently. Browser localStorage alone is not a
cross-window selection protocol. On a switch, reject stale responses and keep
running jobs attached to their original context. Expose those jobs rather than
pretending a switch cancels them.

**C — One global current-project pointer:** simpler but conflicts with the user's
concurrent windows. Do not adopt without a deliberate change of requirement.

VS Code separates command identity from UI contexts and distinguishes menu
visibility from enablement. Reuse that design idea for project/tool/prompt actions:
one command owner, multiple contextual entry points. This is not a proposal to
embed VS Code or copy its expression language. Backend validation remains separate.
[Context keys](https://code.visualstudio.com/api/references/when-clause-contexts),
[command enablement](https://code.visualstudio.com/api/extension-guides/command#enablement-of-commands).

### Tool testing and generated-code viewing

**A — Run against the selected project and call the result temporary:** technically
simple but misleading: hiding output does not reverse file changes. Only offer
explicitly as a real target after review.

**B — Scratch template copy + normal runner:** the user's selected direction is
code preview with copies under `.rab/temp/test/[numeric-id]`. Supply an explicit
typed scratch context rather than registering a fake project. Keep target
root/artifacts explicit. This is an organizational test boundary, not an OS sandbox
for arbitrary scripts; absolute input paths and external effects need capability
compatibility checks. Retain tracking; clearing a view does not delete receipts or
generated source. Cleanup must target only the recorded disposable directory.

**C — Plan-only preview:** valuable for supported artifact-plan stamps. Reuse their
actual render owner so preview and execution do not drift. Unsupported tools say
preview unavailable rather than executing speculatively. This can complement B.

Bazel's per-action execution roots and declared inputs illustrate why reproducible
testing requires more than a temporary output folder; its sandbox mechanisms also
have platform-specific limits. Borrow the separation of inputs/output/strategy,
not a claim that our Node tools are sandboxed. [Bazel sandboxing](https://bazel.build/docs/sandboxing).

The viewer consumes a bounded artifact reference, with path, bytes and content
hash supplied by the artifact owner. Show code as text, never execute generated
HTML merely to preview source. Page large text through the shared artifact reader;
do not duplicate large results in localStorage or HTTP responses. Reuse the user's
existing React viewer once located; the host shell currently is vanilla HTML, so
its integration boundary must be explicit rather than a framework rewrite.

### Context prompt button — deferred, historical exploration only

The user has explicitly excluded this feature and further design from this run.
The following was researched before that answer; it is not an agreed design,
implementation assignment or outstanding question. Preserve the clarified
project-specific prompt idea in the request log for a future discussion.

Prefer one formatter receiving an explicit snapshot: selected node/tool,
project/session, relevant evidence references, current question and desired
outcome. Different button locations provide different context; they do not each
own a template engine. Tool/source text is quoted data, not new instructions.
Show exactly what will be copied, including omitted/unavailable evidence. Save
prompt provenance and user edits if requested through the application storage owner.

Compare immediate copy, editable preview then copy, and an LLM adapter. Recommend
editable preview/copy first, pending the user's answer. A later provider adapter
can accept the same prepared packet without owning project memory or routing.
Clipboard copy must handle rejection honestly: `writeText()` is asynchronous and
requires a secure context; provide selectable text when it fails. No success toast
before resolution. [Clipboard writeText](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText).

### Guarded row-rendering stamp

Keep source loading and row rendering separate. Existing source bindings or an
explicit source descriptor supply normalized rows; the stamp should not guess a
database query from a filename. Start with one source/output pair once chosen,
using the canonical React component stamp when React is the target. Loading,
error, empty and malformed-row behavior need their own explicit contract.

Resolve exact house collection/callability/property guards before generating code.
Optional-call notation by itself is not an approved complete pattern. Rows need
stable data identity; generating fresh timestamp IDs during each render would
break UI continuity even though persistent IDs use numeric timestamps.
[React list keys](https://react.dev/learn/rendering-lists#rules-of-keys).

## Read-only matching probes (actual observations)

Called only `createToolHouse().findTools` against the current catalog; did not run
the selected tools or submit Chat turns. Exact test strings are assistant probes,
not approved vocabulary entries or quotations of the user's brainstorming.

| Probe | Observed result | Implication |
| --- | --- | --- |
| `create a react component` | New-component and sub-component both score 56 (path 24, shape 19, text 13) | Parent/child distinction needs real context; lexical tie order is not intent |
| `create an html component` | Parsed domain is React; both React creation variants lead with score 40 | Explicit platform fidelity is a prerequisite, not something path weight alone can repair |
| `count css classes` | `audit/count/classes` leads at 60 | Positive control for known operation/target |
| `count css css css classes` | Correct leader remains at 64; unrelated CSS review candidates rise to 39 with path 36 and shape -12 | Repeated words can inflate weak candidates; test bounded contextual evidence |
| `find stylesheet selectors` | Target unresolved; generic file/folder/hook tools tie at 26 | Ask for/resolve missing meaning; ranking alone must not declare readiness |
| `show project names` | Operation unresolved; React project-creation stamp leads at 32 | Read/write intent must remain a hard boundary; search result is not execution authority |

These are discovery observations, not six claimed end-to-end bugs or execution
outcomes. Project-conversation/planner layers can add guards and special handling.

## Matching alternatives

**A — More lexical path weight:** cheap but increases repetition/depth bias and
does not repair wrong parsed platform or missing operation. Reject alone.

**B — Compatibility gates then bounded contextual ranking:** preferred. Existing
language owner resolves explicit operation/subject/platform with provenance.
Contradictions exclude candidates. Within valid alternatives, relevant project
specialization and path dimensions contribute once, with visible reasons. Old
branch context supplies defaults; it cannot override an explicit new request.
Tie/ambiguity logic must use meaningful missing distinctions, not folder order.
Implement within current Tool House and share the resolved outcome with Chat and
Turn Checker while keeping diagnostic runs project-independent by default.

**C — LLM selects a tool directly:** potential later interpretation aid, but adds
cost/nondeterminism and must still produce the same validated candidate contract.
Not required for this feature and not a replacement for deterministic execution.

Evaluate B using contrast sets rather than asserting invented confidence
percentages: platform pairs, synonym paraphrases, explicit override versus stale
context, repeated words, missing target, same-word different operation, parent/
child creation and audit-after-creation transitions. Save exact strings, expected
outcome, candidates/reasons and actual selection for user comparison.

## Implementation dependencies and falsifiable acceptance

First agree identity/storage interfaces, then one shared context/activation owner,
then UI consumers. No monolithic all-features rewrite is necessary. Proposed files:
`bridge/service.mjs`, `bridge/project-conversation.mjs`, base project tools, the
existing artifact-plan/result owners, `magic-box/index.html`, language owner and
`bridge/tool-house.mjs`; assign those sequentially because they are shared.
New public tool addresses and IDs come from canonical stamps after agreement.

- Request form retains valid false/zero/empty values; UI and CLI create the same
  validated record; duplicate submits do not create unintended duplicate requests.
- Preview does not initialize sessions/write snapshots. Duplicate project names
  remain individually selectable. Resume/new-action/new-session preserve the
  specified history and remove only the correct temporary scope.
- Two windows do not switch each other. Stale requests cannot populate another
  project's panel; running work still saves under its original project.
- A supported test stamp writes only its recorded disposable target; known
  unsupported external effects are not disguised as safe previews. Generated
  bytes match the canonical artifact plan; existing source remains unchanged.
- Artifact views load bounded pages. Prompt/clipboard checks are deferred with
  FR-0003 and are not acceptance criteria for this run.
- Row stamp output typechecks/builds and passes malformed/empty/reordered-row
  fixtures using approved guards and stable row identity.
- Matching contrast suite meets all explicit platform/operation constraints,
  repetition cannot change eligibility, ties remain explainable, and known
  builder/audit/project-switch scenarios preserve their behavior.

First milestone and prompt/test behavior have been answered. Find the intended
React viewer owner; confirm first row
source/output only when scheduling TR-0001. Do not block unrelated foundational
research on those two feature-specific details.
