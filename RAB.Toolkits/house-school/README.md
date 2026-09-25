# House school: bag and handler fixtures

Separate curricula, shared stamp engine and receipt format. No frozen press changes.

Run `node runner/run.mjs` from this directory. Dependencies are the existing Box
artifact stamping engine/auditors and UI TypeScript compiler; paths are in
`runtime.mjs`, overridable with HOUSE_BOX_ROOT and HOUSE_UI_ROOT.

Each family owns its contract and mutation renderer. The shared runner renders
template trees using Box's existing renderTemplateTree, writes through its
no-overwrite, hash-verifying writeArtifactPlan, and reviews both sides. This uses
the shared stamp machinery, not a newly registered public Toolbox stamp.

Use `--family=bags,handlers`, `--packaging=isolated`, or `--masks=0,1,2,4,7`
to select a smaller run. Run independent regressions with
`node --test tests/verification.test.mjs`. The default mask selection covers clean,
each single defect, and all three together; pair-only combinations are exercised
in the regression suite rather than counted as default exported cases.
Use `--variant=alternate --masks=0,3,5,6,7` for alternate implementations and
pair/triple defects. These are deterministic structural variants, not random seeds.

All generated files and receipts land under the user's `.rab/temp/test/<Date.now()>`.
Case labels describe combinations; the run identity is an observed numeric timestamp.
Existing curriculum and source files are never rewritten by the runner.

The candidate export is separate from the authoritative approved school format.
It contains file-labelled input/target messages, no hidden mutation manifest in
model input, and no fabricated reasoning. Candidates need review/approval before
admission to an approved collection. No model training or promotion occurs here.

Independent behavioral probes receive source and family only, never mutation flags.
They run generated mechanics with deterministic callback spies and edge-case values.
VM execution is ONLY for our own generated code, not a sandbox for model outputs.
The TSX and JSDoc-typed JS are type-checked as context, not mounted in React; hook lifecycle and DOM
behavior are not claimed tested. Types cover fixture-specific contracts, not the
entire global keyring. Local setters stay within the explicit ownership exercise.

Known masking is recorded as CANNOT_CHECK and excluded from candidate export.
Legacy Box findings are retained separately; they do not define canonical truth.
An unflagged broken specimen measures missing coverage in the selected auditors,
not global safety. Optional access fixtures assume correct types when present.

This first batch exercises a limited combination matrix, not all proposed checks.
CSS provides unchanged component context; CSS repair is not this curriculum's task.
No held-out model benchmark is included: this batch tests the generators/reviewers.
Before LoRA evaluation, reserve structurally different tasks outside this export.
