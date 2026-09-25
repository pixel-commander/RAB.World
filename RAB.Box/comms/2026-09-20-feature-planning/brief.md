# Feature research and coordination round

Date: 2026-09-20. Coordinator: **Inspect RRAABBIITT v0.9.3**.
Project: `C:/Users/pixelcommander/Desktop/RRAABBIITT_v0.9.3`.
Status: research, cross-review and compared plan complete. Both other tasks returned
no first-milestone planning blocker. Implementation assignments remain proposed;
no product-source changes were dispatched in this research round.

User answers received: prioritize **project switching and the request page**.
Template-tool testing should support code preview with generated copies in an
area such as `.rab/temp/test/[id]`. **FR-0003 prompt button is deferred and out of
this run**, including further design work; record its clarified intent only.
See [answers](questions.md). The coordinator may append these user-requested
clarifications to the canonical logs; other lane write scopes remain unchanged.
The user also confirmed one computer owns each `.rab`: first run creates it under
the current Windows user's home on the executing computer. No shared multi-host
storage or second house registry is part of this plan.

Start here for the delivery proposal: [compared plan](comparison-plan.md).

## User request and boundaries

The user asked the coordinator to enlist **Review audit stamps** and **Activate
rraabbiitt** in the rraabbiitt.com project, discuss the requested features, divide
research lanes, compare findings, use `/comms` for shared records and ask relevant
questions before getting started. This round produces independent research,
cross-review and a concrete implementation plan. All currently assigned writes
are documentation under this round; no shared product-code edits, migrations,
installs, model inference, service restarts or drive-wide scans are assigned.
Execution work will have explicit files, owners, prerequisites and acceptance
checks in the compared plan before dispatch.

Source requests:

- [Feature/UI requests](../../docs/feature-request/FEATURE_REQUEST.md): FR-0001–FR-0005.
- [Tool requests](../../docs/feature-request/TOOL_RUQUEST.md): TR-0001–TR-0005.
- [Streaming and progress](../../docs/todo/streaming-audit-results-and-live-progress.md): a related request outside the numbered logs.
- [Mapper assessment](../../docs/session-audits/2026-09-20-project-mapper-and-index-driven-audits.md).

## Confirmed principles

- Preserve ownership and direction of the system; outside engines should remain
  replaceable. Research prior work for mechanisms, limitations and useful search
  vocabulary, not as an automatic decision to add dependencies.
- Seek independent viewpoints and measurable improvement. Distinguish observed
  facts, user requirements, hypotheses, recommendations and proven outcomes.
  Neither existing products nor our ambition proves a design superior.
- Self-similarity is required: repeat canonical house keys, contracts and bag
  behavior at the levels adopted. Numeric timestamp-based IDs, no hash/random
  suffixes. Collision handling must preserve the numeric contract.
- Settings own supplied/default values; preserve valid false, zero and empty
  strings. Separate identity, address, project platform, current work intent,
  durable settings and temporary step state.
- Meaningful paths provide contextual match weight between compatible tools.
  They are not the sole candidate source or execution permission. The user's
  example labels and synonyms are brainstorming, not exact approved names.
- Keep one execution owner, one persistence owner, and derived indexes. Audit
  inputs remain untouched. Preserve historical reports and references.
- Deep task/step folders are optional. Application-level requests need a `.rab`
  scope separate from project data; exact naming is undecided.

## Independent lanes and write ownership

| Task | Research lane | Sole writable paths this round |
| --- | --- | --- |
| Inspect RRAABBIITT v0.9.3 | Feature inventory, UI workflows, request/prompt/code-viewer reuse, guarded row stamp, language/path matching, synthesis | `brief.md`, `inventory.md`, `questions.md`, `lanes/ui-routing.md`, `comparison-plan.md`, `reviews/coordinator.md` in this round, plus `comms/README.md` |
| Review audit stamps | Streaming/progress, folder-ID mapper, indexed batch orchestration, test-run output/tracking integration | `lanes/audit-pipeline.md`, `reviews/audit-pipeline-review.md` in this round |
| Activate rraabbiitt (rraabbiitt.com) | Shared descriptor/identity, numeric allocation, application vs project storage, session lifecycle and compatibility/migration | `lanes/identity-storage.md`, `reviews/identity-storage-review.md` in this round |

Task IDs for direct coordination (host `local`):

- Coordinator: `01a0bbe0-0c2f-7d00-b8da-177797ff9aae`
- Review audit stamps: `01a0bbe5-dd20-7ba3-884e-2eb88753a232`
- Activate rraabbiitt, rraabbiitt.com: `01a09cda-fca4-75a3-8106-96c333fbfcc3`

First declare any existing in-flight source scope/conflict; do not interrupt user
work without agreement. Read the other lane once drafts are available, send direct
questions, and write critiques in your own review file. Do not overwrite another
lane or modify the canonical request logs in this round.

## Research output contract

Each lane should provide:

1. Current code owners and observed gaps, with precise local references.
2. Two or more serious alternatives for consequential choices; failure modes and
   conditions that would change the recommendation.
3. Primary-source prior art, linked to specific mechanisms and limits; explain
   what fits this house and what does not. Use targeted current web research.
4. One preferred design and at least one concrete shared-contract example. Label
   new keys/paths as proposals, reconcile existing key meanings, and avoid
   silently redefining `settings`, `type` or `id`.
5. Dependencies, proposed implementation files/owners, compatibility strategy,
   falsifiable acceptance tests/measurements and a bounded first milestone.
6. Questions only the user can answer; resolve routine implementation choices
   from existing contracts rather than forwarding a large questionnaire.

Compare on correctness, ownership/maintenance, self-similarity, migration cost,
memory/latency at scale, resumability, UI clarity and testability. Record
disagreements before deciding; avoid both superficial consensus and complexity
added for appearance. No package installation or live scan is needed for research.

## Sequence

Inventory and questions -> independent lane drafts -> cross-review -> compared
plan and unresolved decisions -> bounded execution assignments when ready.
The first investigation milestone's 496/499 baseline is historical; later
streaming/mapper/features are not validated by it.
