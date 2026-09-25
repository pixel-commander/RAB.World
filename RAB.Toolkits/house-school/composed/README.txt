COMPOSED HOUSE GENERATOR — EXPERIMENTAL

This is additive. It does not modify the frozen press, the old family generators,
training scripts, weights, or existing evaluation records.

Run from house-school:
  node --test composed/test.mjs
  node composed/cli.mjs composed/example.json NEW_OUTPUT_DIRECTORY

The CLI refuses existing output directories. Its candidate.jsonl is NOT approved
training data. No model invocation or training is performed.

STRUCTURE
houseKeyCoverage: 0..1, default 0.5; fraction of handler-enabled levels eligible
for seeded variation from handleClick to handleSave, handleCancel, handleSelect,
or handleToggle. A probability, not an exact quota. Generated forwarding bodies
use the authentic HandlerKey<Payload> contract. The actual shared HouseKeys type
file is packed as SharedHouseKeys.types.ts with a source hash in the receipt.
These are real vocabulary/contracts, NOT copied production implementations.
depth: component-composition levels, 1..32. Level0 renders Level1 inside its main
area and so on. This is actual component nesting, not copied forwarding functions.
It is currently ONE branch with sibling content, not a branching component forest.
width: sibling content blocks per level, 1..8.
areas: 2, 3, or 5, selecting an existing House named layout.
atomTypes: 0..3; introduces container, then action, then effect families.
Actions are buttons with action classes; enabled handlers appear above return.

FEATURE CONTROLS
Each features entry has enabled, coverage (0..1), and optional seed. Coverage
selects component levels deterministically, not individual DOM nodes.
Supported features: classes, container-atom, action-atom, effect-atom, css,
data-grid, house-handlers, bags, loops.
groups.layout shares enabled/coverage defaults between css and data-grid only.
An explicit feature setting overrides its group. Features are NOT error switches.
CSS off omits generated class CSS, but system.css remains supplied grid authority.
Tokens are supplied in system.css; external token discovery is unnecessary.

ERROR CONTROLS
Each errors entry has enabled, seed, mode=count|rate, amount.
Rate means a fraction of eligible rule locations, rounded to nearest integer;
it is not a percentage of source lines. Exact count means mutation operations,
not the number of downstream diagnostics one mutation can cause.
Rules: classes, container-atom, action-atom, effect-atom, css, data-grid,
grid-area, handler-order, handler-guard, bag-guard, bag-rename, unguarded-loop,
bad-nest, convention-arrow, convention-export.
Convention-arrow changes an arrow component to a function declaration.
Convention-export removes the named export.
bag-order moves outgoing bag packing ahead of other preparation. Correct form
finishes handlers and loop preparation, packs local handlers after all spreads,
and places the bag declaration immediately before return. This is a House style
rule even where the early placement would happen not to change runtime behavior.
CSS corruption puts display:grid on an atom class.
No errors supplied means clean controls. Impossible requested counts return
CANNOT_GENERATE_FAIL. Review disagreement produces QUARANTINED.

REVIEW BOUNDARY
review.mjs uses Babel AST and bounded CSS checks, without executing any source.
It does not consult hidden mutation receipts. Each mutation family has a positive
and negative fixture test. It is NOT a general-purpose semantic reviewer: arbitrary
repairs, missing files, runtime behavior, broad CSS parsing, and other House rules
require additional checking. Do not give arbitrary model answers a global PASS
based on this reviewer alone. The trainingApproved flag stays false.
Atom placement findings share a rule category; coverage is per family/level,
not a proof of one diagnostic per individual mutation.

LIMITS TO EXTEND
Real branching component trees, independent per-element class coverage, more
atom variants, ownership/local-state lessons, handler-key rename seats, general
runtime-safe review, and bulk type-check admission are not implemented here.
Do not describe this first version as the complete House training instrument.
