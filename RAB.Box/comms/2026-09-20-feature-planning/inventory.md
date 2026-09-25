# Compared request inventory

Read from the canonical logs on 2026-09-20. Ten numbered entries, not ten
independent unfinished implementations. Related ideas are grouped below without
renumbering or rewriting the source records.

| Source | Requested outcome | Observed starting point / remaining work | Lead research lane |
| --- | --- | --- | --- |
| FR-0001 | One-off tool tests and temporary visible output | Existing settings-driven Tool runner executes real tools; explicit test lifecycle/target and bounded artifact display are missing | UI + audit pipeline |
| FR-0002 | Generated code in the existing React code viewer | Existing Magic Box receipt file viewer is present; user's intended React viewer owner has not been located in inspected app/templates/builder campaign | UI |
| FR-0003 | Context-specific LLM prompt button | User explicitly deferred this run, including further design; clarified project-context/copy intent saved | Deferred |
| FR-0004 | Request form and application-level non-project `.rab` storage | Markdown logs exist; persistence/form not built | Identity/storage + UI |
| FR-0005 | Project viewer/switching | List/find/load owners exist; preview, activation controls and context consistency need integration | Identity/storage + UI |
| FR-0005 refinements | Self-similar descriptor/folders, numeric IDs, resume/new action/new session, semantic path weighting | Embedded session history and mixed ID conventions exist; deliberate compatibility work required. Existing path/shape scorer supplies a starting owner | Identity/storage + UI routing |
| TR-0001 | Guarded dataset row-rendering stamp | Canonical React component stamp and rendering rules exist; exact collection guards/data-source contract still needs resolution | UI/stamp |
| TR-0002 | Tool request tracker | Overlaps FR-0004; one request lifecycle with several views, not two persistence systems | Identity/storage + UI |
| TR-0003 | Audit Factory roadmap | First class investigation milestone completed; later reliability/streaming/other investigation families remain | All / coordinator |
| TR-0004 | Persistent project mapper and folder references | Prior-art assessment exists; numeric-ID clarification supersedes earlier opaque-string examples for new design | Audit pipeline + identity |
| TR-0005 | Audits driven by mapped inventory | Idea only; requires declared direct-file/whole-project scope and coordinator over existing runner | Audit pipeline |
| Related unnumbered request | Streaming results and live progress | Saved design and real large-scan failures; implementation pending | Audit pipeline |

## Cross-cutting dependencies

1. Shared descriptor/identity + a single storage owner supports request records,
   project/session navigation, map references and execution artifacts.
2. Streaming/bounded artifacts supports audit reliability, code/result viewers,
   temporary tests and batch orchestration. Progress and saved findings are
   different records with related lifecycle.
3. One active-work context and one matching owner supports both Chat and UI;
   window selection, runtime execution ownership and durable project type must
   remain distinct.
4. Input forms and previews should consume canonical descriptor data and artifact
   references. Reuse code; do not create a second UI registry. Prompt design is
   deferred rather than a dependency of this round.
5. Historical IDs/reports need compatibility readers and explicit mapping where
   required. The recent numeric-ID rule is not permission to rewrite old evidence.

## Questions already sent

See [questions](questions.md). Additional candidate questions after research:
intended React code viewer location, first data-source/row-output target for
TR-0001, and supported multi-machine/offline writer topology if it materially
changes the numeric allocator design. Do not assume these are all blocking the
first milestone; lane reports must identify which actually are.
