# Shared tool prerequisites and composition

User direction, 2026-09-20: apply the same Toolbox execution method to audits,
stamps and actions such as adding X to Y. Parent requirements must be explicit
and linkable. External/project authors should add tools without modifying the
host system.

Current supported method is documented in `docs/help/tools/toolbox/README.txt`:
declared settings, missing-input handling, input `try`, shared runner composites,
external toolkits, discovered output contracts and task receipts.

Remaining shared infrastructure work:

- Define one enforced prerequisite shape for required project, parent and target
  identity/type; distinguish an implementation parent from an artifact parent.
- Let the standard preparation UI collect or select missing parents. Creating a
  parent must be an explicit write action with the usual execution safeguards.
- Define canonical child input/output bindings for a declarative recipe if
  needed; preserve runner lineage and stop dependent effects after failure.
- Add a shared test harness for missing prerequisites, substitutions, wrong
  project/parent, failure propagation and output verification.
- Extend reviewed writing to deliberate patch/replacement plans after defining
  stale-source checks, overwrite policy and recovery. Do not claim universal
  interception while other tools retain direct write paths.

No new prerequisite schema is declared implemented by this note. The current
code-review tools demonstrate runner composition and a reusable read-only
scratch helper; they do not solve every prerequisite or tool-test workflow.
