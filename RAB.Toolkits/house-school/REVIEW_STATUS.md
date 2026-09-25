# Active review scope

The binary audit runner sweeps all mutation masks of both mechanics variants.
Run `node runner/binary-audit.mjs [correction-ledger.json]`.
Its stamped output separates active PASS/FAIL records from excluded records.
Exclusions have no scoring verdict and do not enter the accuracy denominator.
The optional ledger is keyed by `family/rule`, with `corrections` and `supported`.
A fourth correction excludes that rule. Record corrections explicitly; the runner
does not infer edit attempts from Git or reset an existing ledger automatically.

Syntax checks are supplementary, bounded checks, not whole-program proof.
Trusted generated mechanics can execute in the existing probe. Arbitrary model
output must not execute there: a Node VM is not a security sandbox.

Handler depth fixtures cover linear forwarding and independent optional-handler
boundaries. They expose an important masking case: an upstream wrapper makes a
downstream callback present, hiding a missing guard during whole-chain execution.
The tests therefore check boundaries independently as well as in composition.
This is not yet branching JSX or full-page coverage.

## Remaining / excluded from claims of completion

- Branching component graphs and whole-page composition.
- Forms/API contracts and mock-response curricula.
- General lexical binding analysis for shadowed handler names.
- Arbitrary model-output behavioral execution in a genuine sandbox.
- Integration of new syntax findings into training export eligibility.
- Fresh held-out model evaluation and earlier CSS/grid regression comparison.
- Legacy Box gaps: preserved as diagnostics; frozen Box reviewers were not patched.

Existing training artifacts and the running 32B training configuration are unchanged.
