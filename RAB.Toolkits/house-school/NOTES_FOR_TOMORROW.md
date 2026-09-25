# Verification handoff — 2026-09-23 evening

## Current source

Work continues here on L:, not in the original Codex copy. The Codex copy is now
an older snapshot. No source copies were deleted. The frozen press and Box
auditors were not edited.

## Second batch: checked from disk, not just summary counts

Source batch: `C:\Users\gauge\.rab\temp\test\1790224843198`

Reaudit and issue copies: `C:\Users\gauge\.rab\temp\test\1790225181382`

- 50 cases: 10 clean, 40 corrupted; 50 distinct inputs, none identical to batch one.
- Inspected all isolated mechanics/diffs and the shared component packaging;
  rechecked saved hashes and behavior across all 50 records.
- These are five small subfamilies in two packaging contexts, not 50 unrelated
  architectures. Component variants share mechanics with their isolated partners.
- Canonical TSX, types, and JSDoc-typed JS compile with checkJs and unused-local checks.
- React rendering, hook lifecycle, and arbitrary model-generated code execution
  are NOT covered by these tests.

## Existing Box reviewers: bag-guards + prop-renames only

- 22 corrupted cases produced no findings. Treating this as whole-contract PASS
  would be a false pass. Some violated rules are outside those auditors' coverage.
- 12 other corrupted cases only triggered `bag-optional-guard` on `delete bag.key`.
  The bag is a freshly constructed object. The finding does not identify the
  intended rename/ownership/argument violation. Set aside for review of the exact
  House policy on known-local object access, rather than changing that policy here.
- 6 corrupted cases triggered an actual prop-rename finding. This does not mean
  all other planted defects in those multi-defect cases were detected.
- No whole-case false failures among the 10 clean cases in this batch. This is
  a bounded observation, not proof there are no false positives.
- Six map cases have a masked fallback check: an earlier exception prevents
  observing the result. Recorded CANNOT_CHECK and excluded from candidate export.
- 34 issue cases (categories overlap) have full before/after files copied into
  the audit's `issues/` folder; `issues.json` identifies each reason.

## Our harness corrections

- Fixed duplicate-producing alternate map templates. Latest batch has 50 unique inputs.
- Compare object values structurally, not by JSON insertion order. Preserve the
  distinction between missing and present-but-undefined properties. This is not
  whitespace stripping or lowercasing of source; exact source scoring remains exact.
- Check every callback invocation, not just the first, for payload/type preservation.
- Test caller-owned selection with undefined, empty string, and a real value.
- Added explicit regression probes for the above. 26 tests pass.
- Fixed the reaudit's file-order reconstruction; no historical source bytes changed.

## Training run authorized by Gauge

Dataset: `C:\Users\gauge\.rab\temp\test\1790225264065`

Configuration: `training-run/house-32b-1000.json`

- 1,000 training examples, exactly 400 unchanged and 600 repair targets.
- 50 separate held-out examples (20 clean / 30 repair).
- Training uses original implementations; held-out uses alternate implementations.
- Context values, list sizes, selection states, and isolated/component packaging
  vary. These are synthetic rehearsals of a small rule set, not 1,000 independent
  concepts. No claims of broad generalization are justified by this dataset alone.
- No masked checks enter training; each intended mutation has an independent
  FAIL and each target passes the finite behavioral probes and typecheck.
- Existing Box findings are evidence only, not the correctness authority.
- Approved collection binds the explicit user authorization to the dataset hash.
- Continue the Qwen3-32B round-2 adapter, frozen cached base, one epoch,
  assistant-target-only loss, 2e-5 learning rate, accumulation 4.
- New candidate and checkpoints only. No replacement of parent or default model.
- Maximum encoded example length: 1,459 tokens; no truncation.
- Parent/candidate evaluation records exact-byte repairs and raw outputs. It does
  NOT call alternative repairs wrong or execute model code inside Node's VM.
  General behavioral scoring of model-produced programs needs a real sandbox.

Logs and status: dataset folder's `lora/` directory. Training may be in progress;
read `status.json` for current state rather than treating this note as completion.

## Questions parked for tomorrow

1. Should optional chaining be mandatory even on a proved local object, or is
   semantic safety sufficient? In particular, should `delete bag.key` be flagged?
2. Should masked mutations be prohibited entirely, or retained as advanced
   diagnostics with explicitly incomplete per-rule verdicts?
3. Which additional House rules should receive real checkers before page-scale
   training: DOM-only on* sockets, arrow syntax, wrapper recursion, whole-bag DOM
   spreading, and detailed type/runtime boundaries remain outside this batch.
4. The global keyring previously said no raw setters in JSX; Gauge explicitly
   described a selected/setSelected ownership lesson. This batch treats that as
   a narrowly scoped ownership contract, not a rewrite of all global House rules.
