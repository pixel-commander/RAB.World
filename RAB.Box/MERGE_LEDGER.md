# RRAABBIITT Merge / Implementation Ledger

Purpose: prevent silent loss, duplicate capabilities, and “discussed = implemented” drift.

## Source baseline

- Uploaded green baseline: v0.8.4, 258/258 at package time.
- v0.8.5 handoff supplied the intended nested-House architecture and known defects.
- Current release was rebuilt/expanded from that baseline + handoff and then verified from source.

## Major live-work layers incorporated

### Nested House / PATHS
Status: **BUILT + TESTED**
- deep semantic Tool paths
- stable IDs independent of path
- flat House PATHS
- project PATHS shadow/override provenance
- nearest-parent executors

### Generic nested execution
Status: **BUILT + TESTED**
- parentTaskId
- AUTO child Tasks
- runner-owned continuation
- runner-owned named-seat bag
- `settings[].try`
- child-return seat propagation

### Language / Turn Checker / Human Resolver
Status: **BUILT + TESTED**
- typed unknowns preserve known structure
- unknown/misspelled tokens do not gain authority
- no negative-vocabulary database
- same-Step teaching/rephrase repair
- Question Contracts
- fill-seat / define-token / choose / rephrase / correct-fact / reject event distinction

### Runtime formal primitives
Status: **BUILT + TESTED**
- `bridge/shape-codec.mjs`
- `bridge/seat-reducer.mjs`
- `bridge/graph.mjs`
- `bridge/flow-runtime.mjs`
- transition receipts
- normal-form/scoped-substitution tests

Reference roots used conceptually:
- DCG/state threading → explicit before/after state
- lambda-calculus → scoped substitution/reduction, normal forms
- graph theory → legal topology/cycles/order
- DeepPipe-style pipelines → composable deterministic stages + intermediate receipts

Prolog implementations themselves were **not copied wholesale**; only useful structural laws were adopted.

### School / symbolic training
Status: **BUILT + TESTED**
- executable deterministic lessons
- uses real reducer/graph/flow/codec primitives
- cold-repeat retention checks

### Audit/theme expansion
Status: **BUILT + TESTED**
- semantic audit leaves behind shared engines
- theme tokens/variables
- classes/class definitions
- components/usage/counts
- composite theme inspection

### Source mutation / choreography
Status: **BUILT + TESTED where registered**
- class / attribute / data-area editors
- add/remove/move/replace/wrap/unwrap element family
- component-use insertion/removal
- copy/paste element fragments
- file/component lifecycle tools present in the consolidated House where registered
- containment / confirmation rails

### Security / guard / generated-file work
Status: **BUILT + TESTED**
- static audit families
- bounded local active verifiers
- path/symlink/project containment
- server-owned Tool context
- generated-file/upload surfaces
- SQLite/FTS5/MySQL/background execution surfaces
- local network/container exposure checks

## Incoming pack decisions

### `rraabbiitt-audit-guard-pack-22-merge-2026-09-16`
Decision: **BASE / DOCUMENTED, NOT DUPLICATED**
Reason: Cannon 30 contains this guard family plus eight additional guard-test/live-boundary capabilities.

### `rraabbiitt-audit-guard-cannon-pack-30-merge-2026-09-16`
Decision: **MERGED / NORMALIZED / TESTED**
- manifest/hash integrity checked before merge
- shared helper deduplicated
- current newer `_shared.mjs` retained when it was a strict superset
- pack tests copied into main suite

### `rraabbiitt-code-review-standards-pack-20-merge-2026-09-16`
Decision: **MERGED / NORMALIZED / TESTED**
- path/meta conflicts corrected rather than weakening House validation
- pack behavioral tests integrated
- write-capable tools retained behind existing mutation/authority rails

## Sep 17 architecture material

### Deterministic tokenizer ideas
Decision: **PARTIALLY ADOPTED / EXISTING SYSTEM MAPPED**
- exact token policy already exists
- longest/exact form principles inform lookup
- no typo autocorrection authority
- source comments are not executable language instructions

### Canonical JSON Shape codec
Decision: **BUILT**
- explicit runtime codec
- round-trip tests

### DCG/state threading
Decision: **ADOPTED AS RUNTIME CONTRACT**
- state-in → operation → state-out is represented by transitions and seat bag
- Prolog backtracking semantics were not adopted

### Lambda reduction / alpha-renaming
Decision: **ADOPTED AS RUNTIME CONTRACT**
- scoped seat identity/provenance
- deterministic substitution
- normal forms
- no claim that RRAABBIITT literally implements pure lambda calculus

### Graph primitive
Decision: **BUILT**
- graph runtime and topology tests
- no copying of the unsafe recursive Prolog implementation

### DeepPipe-style pipeline
Decision: **BUILT / MAPPED**
- Flow represented as explicit data/runtime stages
- intermediate transition receipts retained
- authority metadata normalized

## Usage / Health telemetry
Status: **BUILT + TESTED**
- append-only project telemetry ledger
- stable-ID capability usage
- first/last use + time windows
- direct vs AUTO use
- known-word usage
- losses/questions/corrections/resolutions
- Health tab + Chat side-column pulse
- terminal states: completed / failed / blocked / cancelled / user-opt-out / superseded / abandoned / interrupted
- restart reconciliation of started Tasks without terminal receipts

## Current verified House

- 241 public capabilities
- 15 Stamps
- 226 Tools
- 0 unavailable
- 373 / 373 Node tests passing
- language audit passing
- main browser: 18 checks / 0 JS errors
- Turn Checker browser: 3 checks / 0 JS errors

## Rule for future merges

A capability/idea is not considered incorporated until all applicable boxes are true:

1. concrete file/function exists
2. House scan sees it
3. flat PATHS resolves it when public
4. language/lookup reaches it when intended
5. authority/path/meta laws pass
6. executable behavior is tested
7. docs/ledger records provenance and normalization

## v0.9.0 convergence refactor — 2026-09-17

- **Sensor taxonomy:** removed from live architecture; no alias/mapping retained.
- **Hand taxonomy:** removed from live architecture; useful project-intent logic moved to `bridge/project-intent.mjs`.
- **Engine hand helper:** renamed to `engine/src/mutation-plan.mjs`.
- **Audit behavior:** ordinary read Tools now own audit execution.
- **Stamp visibility:** preserved as Tool `check-stamp-visibility` (`audit/check/stamps/visibility`).
- **Mechanical dedup:** intentionally deferred; no semantic leaves collapsed.
- **Behavior gate:** 363/363 Node tests plus language + browser harnesses.


## v0.9.1 Kitchen/Baking integration — 2026-09-17

- **Base:** recovered verified v0.9.0; no interrupted partial tree used as authority.
- **Incoming source:** `rraabbiitt-kitchen-baking-pack-2026-09-17`.
- **Source preservation:** copied verbatim to `docs/domains/kitchen/source-pack/`.
- **Runtime integration:** 25 `kitchen` Tools + 4 `food-process` Tools with stable new IDs.
- **Memory:** reuses existing `.rab` project FACTS; no Kitchen-specific memory subsystem.
- **Safety startup:** people + allergy status gate; unresolved means no safety claim.
- **Allergy:** human-scoped hard constraints; explicit removal; no guessed negatives.
- **Recipes:** starter index is queryable but not promoted to executable/safe authored recipe data.
- **Math:** exact one-seat conveyor solver; multiple missing independent variables stay unresolved.
- **Industrial:** process authority/support gates and visible Runner child composition.
- **Taxonomy cleanup:** removed current `domains.json` Sensor fossil (`kind:sensor`, `sensor_root`).
- **Regression gate:** 373/373 Node tests; language audit; browser 18/18 + Turn Checker 3/3.

## v0.9.3 construction composition — 2026-09-17

Status: **BUILT + VERIFIED**

Added public capabilities:
- Stamp `react/stamp-new-page` (`1830000000001`)
- Tool `react/apply/grid-layout` (`1830000000002`)
- Tool `react/insert/component-into-area` (`1830000000003`)
- Tool `react/apply/scroll-y` (`1830000000004`)
- Tool `react/add/scroll-wrapper` (`1830000000005`)
- Stamp `react/stamp-new-dashboard` (`1830000000006`)

Composition decisions:
- Dashboard is a compound Stamp composed through Runner child calls.
- Grid topology reuses the existing canonical grid catalog.
- Component placement reuses the existing DOM element editor for the actual placement and adds a deterministic relative import.
- Vertical scroll uses the canonical `.scroll-y` Grid CSS utility.
- No artifact-specific behavior was added to the Runner.

Confluence receipts:
- page-first vs component-first construction converges to identical final source.
- compound Dashboard output converges with the equivalent primitive sequence.

Verification:
- 389/389 Node tests across the complete test surface
- language audit PASS
- browser main 18/18, 0 JS errors
- Turn Checker 3/3, 0 JS errors

### v0.9.3 recovery-review hardening — 2026-09-17

Status: **BUILT + VERIFIED**

- Component placement now detects a same-name import bound from the wrong module and fails closed with `IMPORT_COLLISION`; no target mutation occurs.
- Apply Grid Layout now accepts `seat_id` / `area` and composes through the existing DOM edit Tools for nested grid construction.
- Nested grid area construction seats receive deterministic target-derived suffixes so they do not collide with root area seats.
- Live engine docs/CLI/test labels no longer describe `Hand` as a current architecture species. Historical changelogs remain historical.
- Stable IDs, Runner semantics, NEST-001 scope laws, PATHS behavior, Kitchen/Food Process behavior, and existing output behavior are preserved.
- Verification: 389/389 Node tests; language audit PASS; browser 18/18; Turn Checker 3/3; 0 JS errors.
