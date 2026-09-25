# Audit Factory vision alignment

Assessment date: 2026-09-20. Basis: the supplied vision, current source in `C:/Users/pixelcommander/Desktop/RRAABBIITT_v0.9.3`, and saved audit/builder evidence. This is an assessment and proposed sequence, not an implementation or new audit campaign. The original vision and historical test records are unchanged.

## Assessment

The existing work provides a substantial execution-and-evidence foundation for automatic system archaeology. The largest missing layer is the durable project model that connects observations into investigations, conclusions, and approved plans. Some of those activities have already been performed by the user and assistants during development; they are not all automated product capabilities yet.

The builder work fits the vision as the authorized action side: canonical stamps, bounded edits, receipts, and verification. It also provides controlled examples for testing auditors. Audit Room supplies a working evidence viewer. Its authored repair queue should not be mistaken for an automatic conclusion engine.

## Alignment by capability

| Vision requirement | Evidence in the current work | Assessment / remaining work |
|---|---|---|
| Name a project, select source, preserve that source | Audit settings use `paths.folder`; settings, sessions, reports and execution records live in the selected `.rab` project. Saved campaign evidence checked 11,496 scoped source files across ten projects without detecting changes. | Working foundation. Preserve the explicitly documented scope exclusions; this does not certify every file on the machine. |
| Atomic observations across many audit angles | Existing file/import, class/token, component/hook, security, network, hosting and convention tools produce structured inventories or findings. The earlier catalog campaign saved a completed example for each of its 137 audit read tools. | Broad coverage, uneven resolution and accuracy. That historical number is execution coverage for its catalog, not proof of complete system understanding. General function definition/caller inventory and end-to-end data lineage were not found in the inspected tool surface. |
| Relationships and meaningful ownership | `count classes` joins class definitions and assignments with locations; import scans index consumers by import text; graph utilities implement reachability, cycles and topological order. | Useful beginnings. These do not yet form a common resolved project graph covering calls, ownership, routes, data and runtime dependencies. Class-name agreement alone does not prove that a selector applies at runtime. |
| Reusable flat entities/relations/findings/investigations/conclusions/plans | Tools have documented output shapes and per-tool rows. Project memory has resource buckets and facts. | No unified implementation of the six proposed collections was established by this review. Add adapters over existing evidence instead of replacing historical reports. |
| Provenance and trust | Execution records retain tool identity, inputs, parent/session/project links, timestamps, duration, status, result size and report reference. Many findings retain file/line; some carry confidence or heuristic flags. | Strong execution provenance. Observation-level tool/rule revisions, source hashes/commits, freshness and consistently recorded scanned/skipped scope still need a shared contract. Execution UUIDs are not stable identities for code entities. |
| Distinguishable knowledge states | Dynamic class assignments can remain unresolved. Project facts include a source and timestamp; typed unknowns and question contracts exist in Box. Some domains already mark human declarations. | The full evidence-state model is not uniform across audits. Project vocabulary teaching and stored facts are foundations, not a complete evidence-classification system. |
| Investigations with typed human decisions | Box can detect missing inputs, ask questions, preserve turns, and resume a step. | Reusable investigation jobs such as removal impact or contract drift need their own objective, evidence requirements, strategy, result, confidence and gaps. Most audit-specific question families in the vision remain proposed. |
| Evidence-backed conclusions and root-cause collapsing | Audit reports and the authored dashboard repair queue explain findings. | The user/assistant currently performs much of the cross-report reasoning. Durable conclusion records need supporting and contradicting evidence, scope, uncertainty and invalidation rules. Shared root causes must be distinguished from repeated symptoms. |
| Plans and bounded writers | Session plans, confirmation, tool authority, stamps, class/DOM edits and receipts work. The builder campaign completed 100 checks and a 50-turn conversation with 40 verified actions and ten answered style questions. | Strong action infrastructure. A conversational execution plan is not yet the richer evidence-backed plan in the vision: affected files, prerequisites, risk, reversibility, approved boundary and acceptance checks. |
| Design normalization | Token/class/state audits and CSS writers exist. The active-state work updates shared owners and preserves accessibility. | Suitable building blocks. Perceptual grouping, semantic-role classification, family preview and approved normalization-plan generation still need to be connected. Similar appearance is not enough to infer the same responsibility. |
| UI for evidence, investigations and approvals | Audit Room has five pages, saved-run inspection, filtering, evidence downloads and builder test results. Box has steps, questions and execution controls. | Evidence inspection works. The complete investigation/classification/plan approval workspace is not yet implemented. Current dashboard priorities are authored from campaign findings and can become stale. |
| Git evolution and optional tracking | Run history and telemetry record tool executions. Saved before/after inventories and hashes were used in campaigns. | Run history is not Git history. Churn, change coupling, entity movement, complexity growth and snapshot comparison require additional owners. No automatic watcher/hook installation is needed for the one-shot default. |
| Stable identity, exceptions and business context | Tools and projects have identities; project facts can store declarations. | Logical code identity across moves/splits/merges, scoped exceptions with invalidation, and declared criticality are not established as a unified audit model. Name/path keys alone are insufficient. |
| Team/cloud work with the gloves | A local cloud package was assembled with baseline evidence and source manifests; the work already uses rules, stamp contracts and verification instructions. | Manual handoff preparation is demonstrated. No automatic investigation-to-handoff generator, cutoff evaluator, or cloud result acceptance loop was established. A local ZIP does not demonstrate an actual cloud refactor. |
| Verification and auditor quality | Live audits, controlled fixtures, retained failures, target-file assertions, builds and browser checks exist. Latest saved active-state suite: 440/443 passing; the three failures are Windows symlink fixture EPERM errors. | Strong practice to expand. Tests passing on known cases do not establish soundness/completeness for every scanner. Dynamic, malformed, ambiguous and intentional-exception cases remain important. |

## A complete example we have already performed together

The navigation active-state work followed the vision's chain:

1. **Observation:** a generated numbered nav selector used `aria-current` for its active skin.
2. **Investigation:** source and migration records identified where it came from and which stamp/tool owners mattered.
3. **Declared intent:** the user chose aligned `:active` and `.is-active` appearance.
4. **Plan:** update the CSS state writer, navigation stamp, existing app, state audit, Box binding and documentation.
5. **Authorized action:** implement at those shared owners and preserve independent pressed-state tuning.
6. **Verification:** repeated state edits, live Box turns, generated React rendering, build checks, browser selection/ARIA agreement and keyboard focus feedback.

The factory supplies many of the tools and records. The investigation, semantic interpretation and plan composition in this example were largely supplied by the user and assistant. Productizing that middle section is the next major advance.

## Current evidence corrects some older descriptions

The class tools have progressed beyond the earlier audit report's multiline/comment limitations. The current class owner handles multiline assignments, masks recognized comments, retains static tokens from supported templates, records unresolved dynamic assignments, limits snippets, and reports scope/skipped files. The saved `count classes` verification on standalone-maker recorded 134 occurrences, 22 unique names, 64 definitions, 70 usages and six dynamic assignments; its 48 scoped source files stayed unchanged.

That improvement is local to the supported class search. It does not establish general syntax-aware resolution for every language or every audit. The current theme-token branch still repeats full source lines. The generic walker still suppresses some read/traversal errors, and different inventory tools still use different exclusion policies. The report packer already avoids redundant copies in trace/seat metadata, which is a separate problem from repetition inside a tool's own result.

The current project-memory code still replaces `PROJECT.json` through a read/modify/temp-file/rename flow without a process-wide coordination strategy. The old overlapping-save failure should remain open until a targeted concurrency test demonstrates its resolution. The old CSS-only binding failure likewise should not be marked fixed merely because the later builder/state tests pass.

## Recommended next milestone

Prove one complete **class/style investigation** through the product, using the existing class index and action atoms.

1. Establish a minimal versioned record contract and coverage manifest. Preserve raw reports by reference. Give observations source locations and revisions; give entities logical IDs with an explicit provisional/unresolved identity when matching is uncertain. Keep ownership relations visible.
2. Adapt the class-definition and class-assignment results into entities and relations. Mark dynamic references unresolved. Use existing grid/atom conventions; avoid a competing record system.
3. Add one investigation: **“Where is this class defined and used, and what might be affected if it changes?”** Show evidence, unresolved consumers and relevant component ownership. Static results describe possible impact, not guaranteed runtime reachability.
4. Store the investigation and its conclusion. If intent is missing, ask a typed decision such as Internal / External / Both / Unknown, with provenance. Do not rewrite observed source facts to fit the answer.
5. Produce a reviewable plan referencing those records, expected file hashes, the existing writer/stamp, allowed changes, and required verification. Approval binds the scope and revision; changes since approval require reconsideration.
6. Execute through the existing runner, build/test/re-audit, and save a new result linked to the prior one. Acceptance requires the intended output and expected target changes, not merely a successful return code.

Harden shared persistence, bounded result payloads and explicit scan coverage before scaling this across many simultaneous projects. They determine whether later conclusions can be trusted.

## Two refinements to the written vision

**Keep the evidence distinctions, but model independent dimensions separately.** An observed fact can also be externally verified, later become stale, and be intentionally ignored in one investigation. A single mutually exclusive status cannot represent that honestly. Separate origin, verification/resolution, freshness and disposition while retaining the user's vocabulary.

**Deterministic does not mean certain.** A repeatable scanner can consistently miss a dynamic class or scan the wrong scope. Local scripts supply repeatability, bounded behavior and checkable results. Confidence comes from the evidence, coverage and verification. This preserves the intent behind “certainty belongs to local scripts” without giving deterministic failures unwarranted authority.

## Evidence and code references

- [User-supplied vision](C:/Users/pixelcommander/.codex/attachments/83ab0a61-7feb-4a32-8ae7-742cb5fbce64/pasted-text.txt)
- [Runner/storage contract](C:/Users/pixelcommander/Desktop/RRAABBIITT_v0.9.3/AUDIT_TRACKING.txt)
- [Execution/result projection owner](C:/Users/pixelcommander/Desktop/RRAABBIITT_v0.9.3/bridge/tool-tracking.mjs)
- [Project memory owner](C:/Users/pixelcommander/Desktop/RRAABBIITT_v0.9.3/bridge/rab-memory.mjs)
- [Class index contract](C:/Users/pixelcommander/Desktop/RRAABBIITT_v0.9.3/tools/audit/count/classes/README.md)
- [Class search owner](C:/Users/pixelcommander/Desktop/RRAABBIITT_v0.9.3/tools/audit/_engines/class-search.mjs)
- [Theme scanner](C:/Users/pixelcommander/Desktop/RRAABBIITT_v0.9.3/tools/audit/_engines/theme.mjs)
- [Graph primitives](C:/Users/pixelcommander/Desktop/RRAABBIITT_v0.9.3/bridge/graph.mjs)
- [Independent audit campaign evidence](C:/Users/pixelcommander/Documents/ChatGPT/audit-factory/package-check-20260919-230232/RRAABBIITT_v0.9.3/cloud-handoff/baseline/independent/REPORT.md)
- [Builder campaign](C:/Users/pixelcommander/Documents/ChatGPT/audit-factory/builder-campaign/BUILDER_REPORT.md)
- [Active-state changes and checks](C:/Users/pixelcommander/Documents/ChatGPT/audit-factory/builder-campaign/active-state-support/REPORT.md)
- [Dashboard evidence adapter and authored findings](C:/Users/pixelcommander/Documents/ChatGPT/audit-factory/builder-campaign/audit-room/server/evidence.mjs)
- [Local cloud-package verification](C:/Users/pixelcommander/Documents/ChatGPT/audit-factory/cloud-package-20260919-230232.json)

These sources have different dates and scopes. Historical campaign outcomes remain historical; current source inspection is called out separately. This assessment does not claim a fresh comprehensive rerun or knowledge of uninspected work in another task.
