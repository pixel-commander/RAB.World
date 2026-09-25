# RRAABBIITT v0.9.0 Documentation Suite Plan

This roadmap starts from the frozen v0.9.0 Tool/Stamp-only architecture. Historical Sensor/Hand taxonomy is documentation history, not current architecture.

## Tier 1 — Start Here / System Map

1. **00_START_HERE.md**
   - what the Magic Box is
   - how to launch it
   - where truth lives
   - safe first commands
   - package verification commands

2. **01_ARCHITECTURE_MAP.md**
   - Tool / Stamp taxonomy
   - stable ID vs path
   - deep House / flat PATHS
   - Run / Group / Step / Turn / Task
   - Bag and named seats
   - self-similar return law

3. **02_RUNTIME_PIPELINE.md**
   - raw input → Shape → reduce → capability → execute → verify → receipt
   - transition receipts: BEFORE / OPERATION / RETURNED / AFTER
   - normal forms
   - deterministic reduction precedence

## Tier 2 — Language / Human Resolver

4. **10_LANGUAGE_KERNEL.md**
   - exact token policy
   - lexical candidates vs semantic authority
   - typed unknowns
   - path/resource identifiers
   - no typo normalization

5. **11_SHAPES_AND_SEATS.md**
   - canonical seats
   - typed seats
   - unresolved vs null vs false vs empty
   - scoped seat ownership / capture prevention

6. **12_QUESTION_CONTRACTS.md**
   - fill-seat
   - define-token
   - choose
   - rephrase
   - correct-fact
   - reject
   - smallest-unresolved-authority law

7. **13_TRAINING_AND_SCHOOL.md**
   - deterministic training loop
   - executable lessons
   - correction landing
   - cold exam / retention
   - project-only vs House-proposed learning

## Tier 3 — House / Tools / Stamps

8. **20_TOOL_CONTRACT.md**
   - `settings.json` outer schema
   - invocation seats
   - metadata
   - authority classes
   - nearest-parent executor inheritance
   - structured return shapes

9. **21_STAMP_CONTRACT.md**
   - `template/` law
   - future seats
   - overwrite rules
   - product vs mold

10. **22_PATHS_AND_OVERRIDES.md**
    - House PATHS
    - project PATHS
    - shadowing/provenance
    - control-plane moves

11. **23_CHAINING_AND_FLOWS.md**
    - `settings[].try`
    - child Tasks
    - named-seat propagation
    - explicit Flow data
    - no sideways capability coupling

12. **24_TOOL_AUTHORING_GUIDE.md**
    - use `new-tool`
    - nested semantic paths
    - stable IDs
    - tests / registration / lookup requirements

## Tier 4 — Mutation / Construction

13. **30_DOM_EDITORS.md**
    - target resolution
    - root/default vs `all`
    - classes / attributes / data-area
    - add/move/remove/replace/wrap/unwrap
    - dynamic JSX refusal rules

14. **31_ARTIFACT_LIFECYCLE.md**
    - copy / rename / move / save-as / delete
    - component use insertion/removal
    - fragment copy/paste
    - containment and confirmations

15. **32_GENERATED_FILE_SAFETY.md**
    - output roots
    - allowed extensions
    - path containment
    - provenance markers
    - generated-code audits

## Tier 5 — Audits / Security

16. **40_AUDIT_SYSTEM.md**
    - many semantic Tools / few engines
    - exact vs heuristic evidence
    - structured audit reports

17. **41_THEME_AND_COMPONENT_AUDITS.md**
    - theme/token declarations/usages
    - classes
    - components
    - usage/count cross-reference

18. **42_SECURITY_MODEL.md**
    - local-trusted-workbench threat model
    - server-owned authority
    - project containment
    - control plane vs data plane

19. **43_SECURITY_VERIFIERS.md**
    - active bounded probes
    - guard/cannon families
    - symlink/path escape
    - replay/revision/receipt boundaries

20. **44_DATABASE_AND_WORKER_AUDITS.md**
    - SQLite / FTS5
    - MySQL
    - child-process / worker boundaries
    - generated-file/upload surfaces

## Tier 6 — Observability / Health

21. **50_TELEMETRY_LEDGER.md**
    - append-only events
    - stable-ID usage
    - known-word usage
    - losses/questions/corrections/resolutions
    - terminal-state taxonomy

22. **51_HEALTH_DASHBOARD.md**
    - hot / cold / core / workhorse / noisy
    - first/last used
    - non-completion analysis
    - raw event drilldown

23. **52_TASK_TRACE_AND_REPLAY.md**
    - parentTaskId
    - AUTO vs DIRECT
    - transition receipts
    - interrupted-task reconciliation
    - deterministic replay concepts

## Tier 7 — Formal / Reference

24. **60_FORMAL_MODEL.md**
    - state threading (DCG-inspired)
    - scoped substitution / reduction (lambda-inspired)
    - canonical Shape codec
    - graph topology
    - explicit pipeline composition
    - what is analogy vs actual runtime contract

25. **61_GRAPH_PRIMITIVE.md**
    - vertices/edges
    - reachability
    - cycles/SCC
    - topological validation/order
    - reverse dependency graph

26. **62_REDUCTION_MODEL.md**
    - reducible Shape
    - deterministic precedence
    - normal forms
    - semantic cut / stop reinterpretation

27. **63_SHAPE_CODEC.md**
    - canonical representation
    - round-trip invariant
    - unresolved values
    - receipts/storage/replay

## Tier 8 — Reference Catalogs

28. **70_TOOL_CATALOG.md** — generated catalog of every Tool/Stamp ID/path/address/title/authority/consumes/returns
29. **71_LANGUAGE_CATALOG.md** — exact known language forms/types/senses and provenance
30. **72_AUDIT_CATALOG.md** — audit families, exact/heuristic level, output schema
31. **73_TEST_CATALOG.md** — what each regression test proves
32. **74_MERGE_HISTORY.md** — package/pack ancestry and normalization decisions

## Documentation build law

Every major doc should include:

- current version/date
- authoritative source files
- concrete JSON/code examples from the real package
- invariants / laws
- failure examples
- relevant tests/receipts
- explicit “not implemented” section when applicable

Do not document an idea as runtime truth until a concrete file/function and test support it.

## v0.9.1 Kitchen / Food Process documentation additions — 2026-09-17

Authoritative current integration docs:

- `docs/CHANGES_v0.9.1.txt`
- `docs/domains/kitchen/source-pack/` — incoming design/source pack preserved verbatim
- `tools/kitchen/` — implemented Kitchen runtime Tool family
- `tools/food-process/` — implemented initial industrial Tool family
- `tests/kitchen-v091.test.mjs` — domain law/regression proofs
- `TEST_REPORT.txt` — green verification summary

Still future work, and must not be documented as implemented runtime truth:

- authored full recipe corpus
- recipe equipment/timing authoring
- derived ingredient-level allergen registry
- cross-contact evidence model
- complete date-night/cookie dialogue orchestration from natural language
- validated plant/process registry beyond the current authority gates
