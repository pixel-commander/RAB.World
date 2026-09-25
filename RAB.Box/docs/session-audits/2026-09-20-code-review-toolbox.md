# Proposed code review through Toolbox

Implemented in `C:\Users\pixelcommander\Desktop\RRAABBIITT_v0.9.3`.

## Delivered

- `code-review` runs all or selected groups; `code-review/guards`, `grids`, and
  `atoms` run independently. All five tools, including `code-review/write`, use
  existing generated Toolbox fields, discovery and the Tool House runner.
- The groups call the existing bag-guards, prop-renames, grid-continuity,
  css-tokens and css-states tools as tracked children. Their engines were not
  rewritten. No UI-specific execution path was added.
- Inputs are exact proposed code, intended relative file path and optional
  supporting CSS. All/source-selected checks are reported separately; no
  applicable checks means not passed. Audit execution success is separated
  from review success.
- Numeric scratch folders preserve source, hashes and reports. Input is never
  evaluated. The selected project owns normal execution receipts.
- Review and Write New File requires explicit confirm, reruns checks on current
  input, and passes exact reviewed bytes to the shared artifact writer. It
  refuses failed/skipped reviews, existing files, traversal and link paths.
- The shared `runScratchTool` helper allows only read tools on an exact numeric
  scratch source directory. It preserves lineage and ordinary audit protections.

## Source scope and scaffolding

New `tools/code-review/**`, `bridge/tool-scratch.mjs`, dedicated tests, two
authoring/proof scripts and documentation. Narrow runner changes add the scratch
helper and validation. One explicit `PATHS.json` entry addresses the root-level
parent. No shared manifest regeneration, old audit deletion, dependency upgrade
or shared service restart was performed.

The New Tool stamp produced the initial tools in isolated staging. Receipt:
`1830000000726-code-review-scaffold.json`. Permanent tool IDs are
1830000000728 (parent), 1830000000730 (guards), 1830000000732 (grids),
1830000000734 (atoms) and 1830000000736 (write).

## Verification

First focused run: **15/16 passed**. The remaining failure exposed ordinary audit
context rejecting the staged source inside `.rab`. The fix is the explicit,
read-only scratch helper, not a relaxation of ordinary user audit inputs.
Original failure log: `2026-09-20-code-review-input-first-tests.txt`.

Final focused run: **50/50 passed**, including the new behavioral suite, existing
review audits, discovered contracts and Toolbox UI tests. Log:
`2026-09-20-code-review-input-final-tests.txt`. Output-shape sync check passed.

Full `npm test` run: **621/621 passed**, zero failed/skipped, 308983 ms.
Log: `2026-09-20-code-review-full-tests.txt`. These counts overlap the focused
run; they are not additional independent test cases. The implementation was
unchanged during this full run; subsequent edits were documentation/proof-script
work only.

Live browser checks used the normal Toolbox form on a separately started Box
backend at `http://127.0.0.1:60899/?view=toolbox`:

| Exact code | Observed review result | Saved evidence ID |
|---|---|---|
| `const labels = data.map(item => item.label);` | failed, 3 findings | 1830000000952 |
| `const labels = data?.map(item => item?.label ?? "");` | passed, 0 findings | 1830000001032 |

Both used `src/labels.ts` as an intended path, `code-review/guards`, and session
1830000000786. No project source was written by these browser reviews. Evidence
lives under `C:\Users\pixelcommander\.rab\temp\test\<evidence-id>\`.
The updated tab was left open. Older backends need restart to load the new runner
helper; catalog/browser refresh alone cannot update an imported backend module.

Persistent write proof:
`C:\Users\pixelcommander\.rab\temp\test\1830000001072\proof.json`.
The unguarded attempt was blocked, wrote nothing and retained 3 findings.
The corrected attempt wrote and verified
`C:\Users\pixelcommander\.rab\temp\test\1830000001072\project\src\labels.ts`.
This fixture uses separate test memory and does not register a pretend production
project in the user's project list. `scripts/prove-code-review.mjs` reproduces it
with fresh numeric identities. Log: `2026-09-20-code-review-write-proof.txt`.

## Limits and next shared work

These are existing static pattern checks. A pass does not establish syntax,
types, build success, runtime behavior, security or whole-project correctness.
Grid context comes from explicit markup and optional supplied CSS; project
imports and arbitrary RULES.txt prose are not automatically interpreted.
The new writer is opt-in and create-only, not interception of every writer.

The user's direction to standardize every tool is documented in
`docs/help/tools/toolbox/README.txt`, with a cloud-author brief, supported inputs,
input `try`, explicit composites, shared scratch reviews and required tests.
`docs/todo/shared-tool-prerequisites.md` records the missing enforced parent/
project requirements and future declarative composition work. No speculative
`requires` schema is advertised as already supported.

Coordination: Review audit stamps confirmed no overlap and made no changes for
this implementation. This task authored and verified the changes.
