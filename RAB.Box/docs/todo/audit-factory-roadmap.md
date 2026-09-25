# Audit Factory work list

Saved: 2026-09-20.

Project: `C:/Users/pixelcommander/Desktop/RRAABBIITT_v0.9.3`.

Purpose: turn audit results into investigations and actionable plans. This checklist preserves the proposed sequence for resuming work; unchecked items are not claims of completed implementation.

Context: [vision alignment assessment](../vision/VISION_ALIGNMENT_2026-09-20.md).

Implementation plan: [phased plan and coordination record](audit-factory-implementation-plan.md). The user authorized implementation on 2026-09-20. Status below distinguishes the delivered class/atom workflow from broader future capabilities.

## First complete milestone

Take one class/atom investigation from observation through a verified change:

> Where is this class defined, who uses it, and what might change if we modify it?

Reuse the existing class index, stamps, runner, and saved evidence. Keep dynamic or unresolved connections visible. A successful Tool return alone does not prove the intended change.

## Proposed order

- [x] **1. Define the evidence records.** Implemented `audit-evidence/v1` with six flat collections, scoped identity, source references and validation. See [implementation contract](../domains/audit-evidence.md). Ownership beyond observed file containment remains unknown where unsupported.
- [ ] **2. Strengthen trust in the results.** Make scanned/skipped scope consistent, bound repeated excerpts, verify reliable concurrent saves, and preserve requested input filters through binding. Coordinate shared-runner changes with the migration session. Recheck current code and evidence before treating earlier defects as still open or resolved.
- [x] **3. Build one complete class/atom investigation.** `audit/inspect/class-impact` resolves observed definitions and consumers, explains possible impact, and preserves unknown ownership/dynamic connections. Saved results reopen through the existing memory owner. See [verification report](../session-audits/2026-09-20-audit-factory-class-investigations.md).
- [ ] **4. Add declared knowledge and typed decisions.** Support choices such as Intentional / Accidental / Unknown and Internal / External / Both / Unknown. Keep declarations separate from observations, and track verification, freshness, and ignored status independently.
- [x] **5. Give investigations a UI.** The existing Magic Box has an Investigations view for class selection, evidence, gaps, declarations, plans, approval, verification and local handoffs. See [UI verification](../session-audits/2026-09-20-investigation-ui-verification.md).
- [ ] **6. Produce reviewable normalization plans.** Show proposed changes, affected files, applicable stamps, uncertainty, prerequisites, ordering, approval scope, reversibility, and verification requirements.
- [x] **7. Close the verification loop for the first supported plan.** Existing tools execute one approved action-atom CSS change; verification checks exact target bytes, other captured files, consumers, coverage and writer attribution. The retained generated app also passed build/browser checks. General changes still need their own verification design. See [verification report](../session-audits/2026-09-20-audit-factory-class-investigations.md).

## Delivered scope and remaining work — 2026-09-20

The first class/atom milestone is implemented. Unchecked broader items above have these concrete starting points:

| Item | Delivered | Still open |
| --- | --- | --- |
| 2 — Reliability | Class scan hashes, explicit skipped/read/traversal coverage, bounded token excerpts, concurrent-memory fix, explicit CSS-file filter binding, source-preservation proof | Bring other scanner families to equivalent coverage; broader natural-language filters; documented lock/recovery limits remain |
| 4 — Declared knowledge | Intentional / Accidental / Unknown, scoped reasons, declaration history, revision freshness | Internal / External / Both / Unknown and broader exception lifecycles |
| 6 — Plans | One observed CSS file; existing token references; paired `:active` / `.is-active`; preview, baseline, writer fingerprint, approval and recovery text | General normalization and multi-file plans; semantic equivalence and transactional rollback are not provided |
| 8 — Handoffs | Local package with objective, source references, scope, gaps, rules, forbidden actions and acceptance conditions | Self-contained external-worker packaging and a tested cloud exchange; no cloud transmission occurred |

Evidence and failures are retained in the [session report](../session-audits/2026-09-20-audit-factory-class-investigations.md). The prompt-button idea is separately recorded as FR-0003 in [feature requests](../feature-request/FEATURE_REQUEST.md); it has not been implemented.
- [ ] **8. Package the hard remainder for human/cloud work.** Assemble the “gloves”: relevant evidence and files, rules, canonical stamps, approved boundaries, forbidden actions, unresolved questions, acceptance criteria, baseline hashes, privacy limits, and verification commands.

## Later expansion

- [ ] Function definitions, callers, and ownership relationships.
- [ ] API contracts and end-to-end data lineage.
- [ ] Git history, churn, change coupling, and hotspots.
- [ ] Exception lifecycles and invalidation conditions.

## Coordination boundary

The original migration reservation was followed by explicit owner handoffs recorded in the [implementation plan](audit-factory-implementation-plan.md). **Review audit stamps** completed discovery/contracts and the Investigation UI. **Activate rraabbiitt** completed the bounded memory/filter fixes and independent verification review. Both released their completed scopes. This task integrated the evidence tool, scanner improvements, facade and tests.

Before further concurrent implementation, check the latest owners again. Preserve completed builder and active-state changes. This saved list does not authorize optional SQLite, HTML demo, or note stamps, or incidental registry regeneration, dependency upgrades, or shared-service restarts.

## Resume here

Next expansion: **token resolution and atom bypass investigations**, using the shipped evidence records and class workflow. Agree a bounded next slice; do not treat all later investigation families as already implemented. Revisit the user's prompt-button details when they return.

Before resuming, read this checklist, the linked vision assessment, and the latest migration status. When completing an item, add its evidence or report link before checking it off. Keep working reports in `docs/session-audits/`; actual audit results and execution tracking stay in the selected `.rab` project.
