# Class investigations and evidence

Implemented 2026-09-20 in the Desktop RRAABBIITT v0.9.3 project.

## Entry points

- Open **Investigations** in the existing Magic Box after starting/loading an audit project in Chat.
- Tool: `audit/inspect/class-impact`, derived shortcut `inspect-class-impact`, stable ID `1830000000008`.
- Required input: `class_name`, one exact token such as `action-main` (no leading selector dot). Optional `folder` uses existing runner defaults and explicit-input precedence.
- Authenticated HTTP facade: `POST /api/investigations` with the active `session_id`. It calls the same Tool House and memory owner as other tools.

The UI supports scan, saved-result reopening, declared intent, a bounded CSS plan,
explicit approval, execution, verification, and a local handoff. Reopening old
evidence compares captured source against current input. Audits, declarations,
planning, and handoffs never change the input source. The separate execute action
writes only the displayed, approved CSS target.

## One versioned result, six flat collections

`audit-evidence/v1` has `entities`, `relations`, `findings`, `investigations`,
`conclusions`, and `plans`. It also records project identity, scan root, evidence
revision, source execution, and coverage. Current entities include a class token,
files, selector occurrences, and assignment occurrences. File containment is an
observed relation. Matching a class name is not proof of runtime applicability.

The adapter validates actual class-index data. Toolbox `contract.json` shapes
describe outputs; they are not runtime validators. Source report envelope versions
and description-owner paths do not prove a scanner implementation revision.

Each evidence reference identifies its originating execution and a result-relative
JSON pointer. On saved-result reopening, the memory owner resolves the report's
task pointer, including nested root results and `child_results`. Revisions retain
source-report hashes. Missing, changed, foreign, failed, or incomplete referenced
evidence prevents action instead of becoming a valid conclusion.
Reopening also derives the immutable class facts again from their source execution
and rejects altered copied conclusions, entities or relations.

Source origin, resolution, freshness and disposition are distinct dimensions.
Declared intent is a separate finding with author, reason, time, class/revision
scope, and invalidation conditions. Subsequent revisions preserve declarations;
source changes mark old intent stale and require a current declaration for a new
plan. They do not rewrite the original scan.

## Coverage and interpretation

Class scans capture SHA-256 hashes of the bytes actually parsed. They report
excluded directories and read/traversal problems. The composite compares captured
stylesheet hashes across definition and assignment scans. This detects differences
between those reads; it is not an atomic filesystem snapshot.

Supported static template tokens survive the canonical `.trim()` composition
pattern. Unknown expressions and arbitrary method calls stay unresolved. Runtime
class creation, CSS modules, preprocessing, cascade applicability and semantic
component ownership remain limited or unknown. No-match means no observed match
in this scope, not unused or safe to remove. A file's location is relative to the
audited folder, not to the `.rab` project.

The broad generic scanners still have different coverage capabilities. Class
coverage improvements do not certify every scanner. Theme token snippets are now
bounded per occurrence; this does not make the token scanner a cascade resolver.

## First supported plan

The first writer is deliberately bounded to paired `:active` / `.is-active` skin
for one simple class in one observed CSS definition file, at most 512 KiB.
Styles must assign custom properties to declared CSS token references, for example:

```css
--action-main-background: var(--surface-inset);
--action-main-color: var(--content-main);
```

The plan retains source revision, target hash, writer fingerprint, exact options,
expected output hash, original text for manual recovery, and verification limits.
Preview and writer share the existing CSS merge owner; there is no competing
normalization implementation. A declaration and current source are prerequisites.
The UI requires approval of the displayed plan. Execution rechecks its scope and
revision, then invokes `css/add/state/class` through Tool House. Changed source or
writer invalidates approval. Replaying a successful change fails the old baseline
check. Cooperating investigation executions on the same scan root are serialized.

Verification binds the completed writer's stable ID, exact options and execution
time to the prepared plan. It checks expected target bytes, unchanged other captured
files, the approved scan root, scan consistency/coverage, and class consumers. It reports application
build/tests and browser behavior as separately required verification; the current
tool does not run arbitrary package commands from an audited project.

There is no multi-file rollback or atomic snapshot guarantee. An interrupted
operation can require inspection of receipts/source before continuing. Project
memory concurrency and its explicit recovery limits are documented in the
[memory reliability report](../session-audits/2026-09-20-audit-memory-reliability.md).

## Persistence and handoffs

Only audit-type projects automatically save these top-level read results through
the existing report writer. A standalone tool call without an audit project is
transient. Settings/results/tracking stay in the selected `.rab` project, including
declaration, plan, verification and handoff revisions. Raw reports are retained.

The handoff is prepared locally and includes the objective, bounded files, evidence
references, unresolved gaps, applicable rules, forbidden actions and acceptance
conditions. No data is automatically transmitted to a cloud model or teammate.
General refactoring, Git evolution, endpoint/data lineage, arbitrary normalization,
and stable identity across code moves remain later investigations.

## Verification commands

```text
node --test tests/audit-evidence.test.mjs tests/class-index.test.mjs tests/toolbox-output-shapes.test.mjs
node tests/audit-evidence/demo.mjs
```

The demo uses the existing React and audit project stamps, retains a disposable
application under `verification/`, and saves actual investigation reports and
interaction inputs in its isolated `.rab` project. Its interactions are labeled
structured actions; they are not falsely presented as natural-language Box turns.
