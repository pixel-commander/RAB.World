# Stamp discovery and drift follow-ups

Saved: 2026-09-20. Status: implemented and verified; three environment-limited symlink checks and test-server cleanup are documented in the verification record.

Project: `C:/Users/pixelcommander/Desktop/RRAABBIITT_v0.9.3`.

User concern: manually maintaining stamp lists and expected totals creates drift when tools are added, moved, or changed. These tasks preserve the follow-ups from that discussion. Unchecked items are not claims of implementation or newly confirmed runtime failures.

## Intended behavior

A conforming tool supplies its own identity and contract, or inherits a contract from its shared implementation owner. Existing discovery derives the catalog, search inventory, and displayed totals. Adding a tool should not require updating several central lists. Stable tool IDs remain identities; they must not become positions in a counted list.

Counts may be calculated for a current view or recorded in a dated report. They must not become manually maintained requirements for how many installed tools are valid. Historical reports remain snapshots and are not rewritten to match later inventories.

## Completion update — 2026-09-20

The user released shared scope for this checklist. Implementation is complete; each checked item is supported by the [verification record](../session-audits/2026-09-20-discovery-and-contract-verification.md) and [consumer contract documentation](../domains/tool-contracts.md). The original planning text below is retained for intent and acceptance criteria. Other sessions now own separate persistence, evidence-adapter, scanner-coverage, and later UI work; those are not silently included in this completion.

## Coordination

Another session is moving tools and working on shared execution. Before implementing any item, re-read the current code and agree on exact write paths with that session through the user. It may already have resolved or changed these findings.

The existing reservation includes shared `bridge/**`, `engine/**`, root registries/manifests, creation stamps and engines, `magic-box/index.html`, and shared or migration-related tests. This checklist records work; it does not authorize overlapping implementation, incidental registry regeneration, service restarts, or migration of the shared ChatGPT workspace.

Related work: [Audit Factory roadmap](audit-factory-roadmap.md). This checklist addresses discovery and duplicated contracts; the roadmap retains the broader audit reliability and investigation work.

## Checklist

- [x] **Reconcile the post-migration owners.** Identify the current owner of discovery, tool contracts, named shortcuts, output previews, and refresh behavior. Record which items below the other session has already completed, with verification evidence. Completion: every remaining item has an agreed owner and write scope; resolved items link evidence before being checked off. Evidence: [verification record](../session-audits/2026-09-20-discovery-and-contract-verification.md).

- [x] **Remove fixed inventory assumptions from the source-report helper if it is retained.** Replace literal expected totals and handwritten total sentences with values derived from discovery. Account for every discovered writer, including an explicit unclassified group. The helper currently lives in the shared workspace; agree on its project-local home and direct future working reports to `docs/session-audits/`. Completion: adding or removing a valid fixture tool changes the calculated report without editing a central list; unknown classification remains visible; existing report originals are preserved. If the helper is retired instead, document its replacement and avoid leaving a misleading reusable entry point. Evidence: [verification record](../session-audits/2026-09-20-discovery-and-contract-verification.md).

- [x] **Give classification one owner.** Use observed template files and tool/shared-engine declarations where available. Keep human interpretations traceable to reviewed source, and distinguish templates, internal generators/editors, composites, and ordinary file operations. Do not infer all behavior from the presence or absence of `template/`. Completion: a new tool with an unknown implementation is reported as unclassified; a hybrid can identify both its template and generated portion without a second global classification table. Evidence: [verification record](../session-audits/2026-09-20-discovery-and-contract-verification.md).

- [x] **Resolve duplicate shortcut registration with the migration owner.** Review how discovered tools and `PATHS.json` addresses stay aligned after creation, movement, removal, or renaming. Reuse the agreed registry/discovery owner; derive mechanical mappings where appropriate and validate intentional aliases and project overrides. Preserve stable IDs, ambiguity checks, execution safeguards, and override semantics. Completion: controlled fixture changes keep supported addresses working or produce explicit stale/missing/conflicting-address diagnostics; no silent routing to another tool. Evidence: [verification record](../session-audits/2026-09-20-discovery-and-contract-verification.md).

- [x] **Verify catalog refresh across supported changes.** The catalog already scans folders and supports a fresh scan; it also caches results and has an invalidation path. Establish how every supported tool mutation, including externally edited files, becomes visible. Completion: add, move, edit, and remove fixture tools, then confirm the next supported refresh updates catalog/search without editing an inventory or restarting a shared service as a test workaround. Document any explicit refresh requirement. Evidence: [verification record](../session-audits/2026-09-20-discovery-and-contract-verification.md).

- [x] **Make output previews consume the owning contract.** Review the separately maintained output-shape guide and its generated UI embedding. Place reusable contracts with the tool or shared engine owner, using the existing contract conventions; have the Toolbox consume them. Preserve the distinction between a tool result, its saved report wrapper, and separate execution tracking. Avoid treating a single sample result as a complete schema. Completion: a fixture output-contract change reaches its preview through the agreed owner, and an undeclared contract is shown explicitly instead of guessed. Retain fixture checks of real output and saved records. Evidence: [verification record](../session-audits/2026-09-20-discovery-and-contract-verification.md).

- [x] **Replace inventory-size assertions with behavioral checks.** Remove the `audits.length > 100` assumption and similar fixed catalog-size expectations. Test discovery of known controlled fixtures, unique identities, valid contracts, visible diagnostics for invalid tools, and preview coverage for the discovered scope. Preserve checks that prevent an empty or broken scan from passing vacuously. Completion: adding a conforming fixture tool passes without updating an expected installed total; duplicate identities, missing required contracts, and broken discovery still fail meaningfully. Evidence: [verification record](../session-audits/2026-09-20-discovery-and-contract-verification.md).

- [x] **Verify the complete addition/change workflow and close the handoff.** Exercise a disposable tool through discovery, supported lookup, preview, and authorized fixture execution after the agreed changes. Record the actual outputs and remaining limitations, rather than relying only on a successful exit. Completion: adding or moving the fixture requires no unrelated central inventory edits; report and tracking contracts remain intact; each completed checklist item links evidence and identifies any work still assigned elsewhere. Evidence: [verification record](../session-audits/2026-09-20-discovery-and-contract-verification.md).

## Evidence and limits at the time of this note

- [Source-report helper](C:/Users/pixelcommander/Documents/ChatGPT/audit-factory/audit-stamp-sources.mjs): per-tool classification notes, fixed category assertions, a fixed prose summary, and output to a sibling `reports/` folder. This is a one-off report helper, not the normal execution runner.
- [Tool House](../../bridge/tool-house.mjs): folder discovery, settings validation, cached catalog, explicit fresh scan, and cache invalidation. Discovery itself is already derived; this checklist does not propose a second scanner.
- [Paths registry](../../bridge/paths-registry.mjs): separate house/project address mappings, including intentional project overrides. Their existence is not proof that a current address is broken.
- [Output-shape owner](../../tools/audit/_output-shapes.mjs), [UI sync script](../../scripts/sync-toolbox-output-shapes.mjs), and [preview tests](../../tests/toolbox-output-shapes.test.mjs): separately described result shapes, generated embedding, fixture checks, and an installed-count threshold.
- [Original templates-versus-code report](../session-audits/2026-09-20-stamp-templates-vs-code.md): dated findings to preserve as historical evidence, not a live registry.

These observations came from source inspection. No tools, runner behavior, registries, or historical audit results were changed while saving this checklist. Current migration work may supersede individual observations.

Working plans and session write-ups belong in Magic Box's docs tree. Actual audit execution results and tracking remain in the selected `.rab` project; do not copy them into this todo folder. Files in the shared ChatGPT workspace must not be attributed to a session solely from their location or timestamps.
