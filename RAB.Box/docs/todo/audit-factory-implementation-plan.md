# Audit Factory implementation plan

Date: 2026-09-20.
Project: `C:/Users/pixelcommander/Desktop/RRAABBIITT_v0.9.3`.
Owner: **Inspect RRAABBIITT v0.9.3**.
Status: implementation authorized by the user's “ok go please” on 2026-09-20. The first class/atom workflow is implemented and verified. Final full suite: 496/499 passed, with three existing Windows symlink-setup EPERM failures. Broader later investigations remain future work. See the [completion report](../session-audits/2026-09-20-audit-factory-class-investigations.md).

Sources: [roadmap](audit-factory-roadmap.md), [vision assessment](../vision/VISION_ALIGNMENT_2026-09-20.md), and the user's [methods and scenarios](../vision/AUDIT_FACTORY_METHODS_AND_SCENARIOS.txt). The method examples describe desired capabilities, not measured current results.

## Outcome and first demonstration

Make this question work as a saved, evidence-backed investigation:

> Where is this class defined, who uses it, and what could a change affect?

First deliver a useful read-only answer. Then complete one controlled demonstration: select an action atom, inspect definitions and consumers, show unresolved references, record intent when needed, preview one bounded change, obtain approval, execute through the existing runner, and verify the intended before/after result. Keep settings, reports, decisions, and results in the selected `.rab` project.

The ordinary audit never modifies its input folder. A later approved builder action must identify its own exact write target and allowed changes. For the demonstration, use a disposable generated application; permission to scan a folder is not permission to edit it.

## Implementation order and completion gates

### 0. Agree on owners and establish the current baseline

- Obtain the active write scope from **Review audit stamps**, which is implementing discovery/contract/preview follow-ups.
- Read its final owner contracts and current verification evidence before coding against them. The saved migration baseline is 451/454, with three Windows EPERM symlink fixture failures; this is historical context, not a new test run or the final discovery-work baseline.
- Reconcile the old reliability findings with current source and focused reproductions. Record fixed, reproduced, and unverified separately.
- Agree on private helper/test ownership and the eventual public-tool shape, persistence integration, and UI handoff.

Gate: exact paths have an owner, dependencies are explicit, and user authorization to implement has been received. Another task agreeing to a boundary does not itself authorize implementation.

### 1. Define the minimum evidence contract and adapt class results

Create a small versioned record contract for the six flat collections: `entities`, `relations`, `findings`, `investigations`, `conclusions`, and `plans`. Initially populate only what the class investigation needs; avoid building every future domain first.

Each substantive assertion needs references to saved source evidence and relevant provenance: project/session/execution, report location and row or JSON pointer, tool identity/revision where known, source file/location/revision, and scan scope. Preserve raw reports by reference. Missing provenance stays explicitly unknown; an adapter cannot retroactively invent hashes or coverage for an older report.

Separate origin, resolution/verification, freshness, and disposition. A source observation may become stale or be ignored for one purpose without ceasing to be an observation. Human declarations remain distinguishable from scanned facts. Confidence needs reasons and coverage limits; do not manufacture percentage certainty.

Use the existing class index and its definition/assignment evidence. Represent class definitions, assignments, files, and justified ownership relationships. Class-name agreement supports a potential relationship; it does not establish runtime selector applicability. Identity is scoped and provisional where needed; durable identity across renames/splits/merges is later work.

Gate: a saved class result becomes inspectable, validated records without altering the original; every derived claim can be followed to its evidence; repeated adaptation is deterministic; unsupported versions and unresolved references are visible.

### 2. Verify reliability before durable integration

The reproductions and acceptance criteria belong to this plan. Shared fixes require the agreed owner to implement them or explicitly hand off the affected paths.

- **Coverage:** distinguish scanned, excluded, unreadable, and unsupported inputs, including traversal errors. Prioritize the class investigation's scanner path; retain other scanners' gaps in the backlog.
- **Payloads:** bound excerpts and reference shared evidence instead of repeating long lines. Reproduce the remaining theme-token case separately; compact runner metadata and compact scanner payloads are different requirements.
- **Persistence:** test concurrent sessions/processes writing to the same disposable `.rab` project, including project metadata and result references. Check missing records, lost updates, malformed JSON, and readable references. A rename-based write alone does not prove safe read/modify/write concurrency.
- **Binding:** confirm an explicit folder/filter wins over stale saved inputs, while valid `false`, `0`, and optional empty strings retain their existing meaning. Reproduce the CSS-only case rather than inferring a fix from unrelated passing tests.
- **Source preservation:** verify the scoped input hashes before/after an audit, including an audit root containing excluded `.rab` storage. Record exclusions so the check is not overstated.

Persist the new records through the existing project-memory owner. Establish storage layout and failure behavior with that owner; do not create a second memory writer or silently fall back to a new local directory.

Gate: the first investigation's data remains intact, coverage is honest, source files remain unchanged by auditing, and explicit inputs reach the intended tools. Wider scanner weaknesses stay labeled and scoped.

### 3. Ship the class/atom investigation

Add one discoverable investigation tool using the current tool mold and runner. Private analysis functions perform the evidence transformation; nested audits use `helpers.runTool`. Discovery, tool IDs, input questions, tracking, and persistence keep their current owners.

Inputs identify the selected project, class/atom, and evidence revision or fresh scan. Return definitions, observed consumers, supported owner relationships, possible change impact, contradictory evidence, and unresolved gaps. Capture source changes during scanning or adaptation as inconsistent/stale evidence rather than silently combining revisions.

Save the investigation and its conclusion. “No matches in the scanned scope” must remain distinct from “unused.” Unresolved dynamic assignments, CSS modules, runtime registration, generated selectors, and incomplete coverage limit the answer.

Gate: a controlled fixture produces the expected answer, missing evidence stays visible, and the saved investigation can be reopened. Then try one representative real project without changing its audited source.

### 4. Add declared knowledge and the investigation view

Use the existing project's question/answer mechanisms for facts the investigation cannot determine. Begin with a small relevant decision such as Intentional / Accidental / Unknown. Store the answer's author/source, scope, timestamp, and invalidation conditions separately from observed evidence. Changing a declaration must preserve its history.

Once the shared UI owner releases the required files, add an investigation view to the existing application:

1. Select a subject.
2. Read the question, evidence, coverage, and gaps.
3. Inspect the conclusion and its supporting or conflicting evidence.
4. Add a scoped declaration, leave unresolved, or request a plan.

Keep turn-checker diagnostics independent of project knowledge. Use current OOCSS rules and existing stamps for any canonical UI shape. Select precise component/atom paths after inspecting the current UI with its owner; do not start a second dashboard or silently use the Documents workspace application as the product home.

Gate: reopen an investigation with its evidence and declaration intact; stale evidence is visible; changing projects does not leak declarations; diagnostics remain input/output diagnostics.

### 5. Produce, approve, execute, and verify one bounded plan

A plan references its investigation, evidence revision, explicit target files, baseline hashes, proposed changes, applicable canonical tools, prerequisites/order, expected result, reversibility or recovery limits, and verification commands. Unknown semantics may prevent automatic action while still permitting a useful read-only conclusion.

For the first demonstration, propose one controlled action-atom style change in the disposable application. Preserve the shared state behavior, accessibility, and relevant public component contracts. Do not infer semantic equivalence from similar colors or class names.

Approval covers a particular plan and revision. A changed source, contract, or required scope invalidates the prepared action and requires review. Execute through the existing runner; preserve nested receipts and reported partial failures. Do not claim transactional rollback unless the implementation provides it.

Verify the expected target changes, unchanged unrelated fixture files, build/tests, relevant re-audit, and browser behavior where needed. Persist linked before/after evidence and report pass, regression, or unresolved outcome. Historical failures remain historical records.

Gate: the user can follow one approved change from evidence to plan to runner receipts to verified output. A successful tool return alone cannot satisfy this gate.

### 6. Package unresolved work and expand by investigation

Build the handoff package from the same records: smallest coherent objective, evidence/gaps, allowed files, rules/stamps, forbidden actions, disclosed content, expected hashes/revisions, stop conditions, and acceptance commands. Prepare locally; sending to a model or person needs its own authorized destination/scope. Unknown remains an acceptable conclusion.

Prove the handoff with local acceptance checks before claiming an automated cloud workflow. Expand to token resolution and atom bypasses next, then endpoints/import/removal impact, function callers, data lineage, Git history/coupling, and scoped exception lifecycles. AI cost analysis waits for real usage/outcome records; illustrative costs in the methods document are not measurements.

Gate: another worker has sufficient bounded context to act, and local checks can accept or reject the returned work using the same criteria as a local action.

## Proposed ownership and write boundaries

The following table preserves the original planning boundaries. Later explicit
handoffs and completed ownership are recorded below; unresolved entries here are
historical, not the current implementation status.

| Area | Proposed owner and boundary |
| --- | --- |
| This plan, `audit-factory-roadmap.md`, and one new shared request-log entry | This task; documentation-only writes in this planning round; log now at `docs/feature-request/TOOL_RUQUEST.md` |
| `tools/audit/_evidence/**` | Other task confirmed no conflict; future private evidence/adapter/investigation helpers for this task; no `settings.json` or independent scanner/runner |
| `tests/audit-evidence/**` | Other task confirmed no conflict; future dedicated tests and fixtures for this task; no shared test configuration changes |
| A public class-investigation tool | This task after agreeing its canonical path/settings/ID with the current tool owner; exact path remains unresolved |
| Discovery, sidecar contracts, shortcuts, refresh, Toolbox previews and related tests | **Review audit stamps**; consume its completed work and do not duplicate it |
| `bridge/**`, `engine/**`, existing audit engines/count tools, root registries/manifests and test infrastructure | Shared dependency; no writes by this task until exact ownership is handed off |
| `magic-box/index.html` and product UI integration | Shared dependency; inspect and agree precise scope after current Toolbox work |
| Creation stamps and `tools/_stamp-engines.mjs` | Reuse migrated owners; do not reopen the migration incidentally |
| `docs/feature-request/TOOL_RUQUEST.md` and shared indexes | Other task released the log for this planning entry; read current entries before appending. Shared indexes left unchanged by this task |
| Runtime evidence | Selected `.rab` project through the existing storage owner; audited input remains untouched by audits |

The helper/test lane has a no-conflict confirmation; the public-tool path and shared integration remain unresolved. Documentation does not authorize source changes by itself. No dependency upgrades, automatic service restarts, registry rebuilds, watcher installation, or historical evidence rewrites are part of this plan.

## Verification cases

Use meaningful cases rather than a fixed installed-tool count:

| Area | Required examples |
| --- | --- |
| Class evidence | Exact case, multiline assignments, comments, duplicate declarations, static and dynamic template parts, CSS escapes, long lines, unsupported syntax |
| Relationships | Same name in different scopes, unknown ownership, unresolved runtime use, no-match with incomplete coverage |
| Provenance | Saved raw-result references, source revision changes, incomplete legacy provenance, version mismatch |
| Persistence | Parallel sessions/processes, interruption/failure reporting, distinct project roots, preserved historical results |
| Input scope | Explicit folder/filter versus stale bag/default; excluded `.rab`; unreadable input recorded |
| Plan execution | Approval revision mismatch, scope expansion, partial write, no-op/faulty writer returning success, intended and unrelated target checks |
| UI/decisions | Saved/reopened investigation, declaration history, unknown choices, stale evidence, project switching, diagnostic independence |

Keep exact Box wording, clarification turns, selected inputs, expected outcome, actual target/result, and pass/fail reason for conversational checks. Preserve failed attempts with later fixes linked. First use focused tests; run the relevant shared regression suite at integration, and browser/build verification when output changes warrant it.

## Methods covered and deferred

The first milestone supports design-system bypass investigation (method 3), narrowly scoped normalization (9), bounded automation eligibility (10), unknown escalation (13), handoff (15), declared knowledge (16), evidence-supported root-cause grouping (17), and verification (18). These are limited class/atom applications, not complete implementations of all methods. Methods 9/10/17 require positive semantic evidence; ambiguity is not eligibility.

Later investigations address endpoints (1), token chains (2), removal impact (4), Git/test risk (5), co-change (6), data lineage (7), documentation contradictions (8), duplicate classification (11), scoped exclusions (12), and AI spend (14). Preserve these in the roadmap until each has its own scoped plan and evidence.

## Coordination record

- 2026-09-20 completion: **Review audit stamps** released its completed Investigation UI and tests; **Activate rraabbiitt** released its completed memory/report-loader and CSS-filter fixes and independent review. The public tool is `audit/inspect/class-impact`. Shared integration was handed off explicitly; no overlapping edit remains assigned. The final default suite passed 496/499 with only the three existing Windows symlink-setup failures. Generated-app build/browser checks and a source-preserving real-project scan are recorded in the [completion report](../session-audits/2026-09-20-audit-factory-class-investigations.md).

- 2026-09-20 implementation update: user authorized implementation and explicitly enlisted other tasks. **Activate rraabbiitt** owns and completed the bounded memory-concurrency fix and report-loading API, then reviewed plan verification and is checking CSS-only filter binding. **Review audit stamps** completed discovery/contracts and now owns the Investigation UI/browser verification. This task owns evidence, scanner coverage, class-impact tool, facade/route and final integration. No shared service was restarted.
- Current implementation contract: [class investigations and evidence](../domains/audit-evidence.md). Dedicated tests live in `tests/audit-evidence/` and are imported by `tests/audit-evidence.test.mjs` into the existing default suite.

- 2026-09-20: Read the current roadmap, vision, methods, migration report, runner documentation, discovery checklist, and the other task's recent activity.
- 2026-09-20: Showed the user the proposed sequence and sent **Review audit stamps** a direct coordination request. Asked for exact ownership, confirmation of the private helper/test lane, consumer contract details, and capacity for bounded contract review or a later reliability follow-up. No extra implementation was assigned.
- 2026-09-20: **Review audit stamps** confirmed the private helper/test lane does not conflict. It is editing discovery, sidecar loading/descriptions, paths/service refresh, Toolbox UI, dedicated discovery tests, the source-report helper/tests, and its own docs. It has no planned scanner-implementation or persistence-writer changes and will not edit our plan/roadmap.
- 2026-09-20: Its in-progress catalog contract retains `consumes`/`returns` and adds optional descriptive `result`, `source`, `settings`, and `files`/`owners` provenance. The descriptive notation is not JSON Schema or runtime validation. Runner output intentionally retains compact `consumes`/`returns` metadata. Our adapter must consume actual saved class output and preserve dynamic/unresolved and scope information; preview descriptions are supplementary metadata only.
- 2026-09-20: The other task reports HTTP catalog/search and top-level run refresh, with explicit `listTools({fresh:true})` still available. Its final interface documentation and verification are pending; do not treat these as settled integration guarantees yet.
- 2026-09-20: It offered a bounded read-only adapter review after its checklist. Sent the concrete plan and requested review of runtime input, parent/child evidence references, version assumptions, and ownership. That detailed review is pending. It is not taking additional persistence/concurrency implementation; that dependency remains unassigned.
- 2026-09-20: The other task confirmed it is not editing `docs/TOOL_REQUEST.md`, allowing this task to append a planning entry while preserving the current log.
- 2026-09-20: Recorded the planning request as TR-0003. Concurrent work relocated the log to `docs/feature-request/TOOL_RUQUEST.md`; verified our entry survived and corrected only its relative plan link. Preserved the relocation and all other requests.

## Resume point

The first milestone is complete within its stated bounds. Read the completion report and updated roadmap before continuing. Next expansion is token resolution/atom bypasses; further domains and general normalization need their own bounded implementation slices. FR-0003 is an idea recorded for clarification, not an implementation request. Do not repeat completed verification or mark later investigation families complete.
