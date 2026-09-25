BOX CONTRACTS: PURPOSE, LOGIC, AND EVIDENCE
=========================================

Research snapshot: 2026-09-25. Scope: current local source, tests, and local
design notes in RAB.Box. No Git-history evidence is used in this document.
The checkout is undergoing toolkit consolidation; paths and behavior may
change. This investigation changes documentation only.

1. THE CENTRAL DISTINCTION
-------------------------

Box's contract is larger than the file named contract.json. It connects what
the user means, which capability exists, what inputs it requires, whether it
may execute, what it actually returns, and what evidence gets saved.

contract.json is the declarative output/source-description part of that
system. It is read by discovery and exposed to the Toolbox and source-review
tools. It does not itself implement the planner, fill inputs, execute a
stamp, grant authority, or validate every returned value.

The practical division is:

settings.json       Tool identity, title/description, input fields and meta.
                    Input binding reads the settings array, not the
                    optional settings description in contract.json.
meta                Semantic domain/operation/target, authority and optional
                    declared returns. Used by matching and the runner.
PATHS.json          Intentional aliases and project bindings with identity
                    and location checks; not the output description.
executor .mjs       Implements run(), including domain-specific checks.
template/           Source material for a scaffold. Its presence influences
                    runtime classification; source.kind is separate.
contract.json       Describes output and implementation, with inheritance.
provided.seats      Actual values the tool returns for subsequent bindings.
saved report        Actual result and execution context, persisted by Box.
tracking record     Execution status, timing, provenance and result reference.

2. WHY THE SIDECAR EXISTS: LOCAL DESIGN ROOTS
-------------------------------------------

docs/todo/stamp-discovery-and-drift.md records the motivating problem:
manually maintained tool lists, implementation classifications, output-shape
tables, and expected counts drift when tools move or change.

The stated goal is one description at the implementation owner, inherited
by tools sharing that implementation. Catalogs, previews and reports should
consume that description instead of carrying independent per-tool tables.
Stable tool IDs remain identities rather than positions in an inventory.

docs/domains/tool-contracts.md describes the resulting design. This is
evidence of recorded design intent, not proof of the original date or author
of the idea. The current loader and its tests independently support the
mechanics described below.

3. THE FILE FORMAT
------------------

A minimal useful declaration is:

  {
    "version": "tool-contract/v1",
    "source": {
      "kind": "internal",
      "description": "Inspects files and returns matching rows."
    },
    "result": {
      "status": "string",
      "rows": [{ "file": "string", "line": "number" }]
    }
  }

The loader recognizes result, source, settings, extends, select and variants.
version must be tool-contract/v1 for each referenced file. Result and settings
are description notation, not JSON Schema. Strings describe values/types;
objects describe fields; a one-item array describes its item shape; a key
ending in ? denotes optionality; {"$nullable": ...} describes nullable data.
These conventions are interpreted for presentation and fixture checks.

Allowed source.kind values:
  template       behavior described as template-based
  internal       behavior implemented internally
  hybrid         combination of template and internal behavior
  composite      orchestration of child capabilities
  file-operation behavior described as a file operation
  unclassified   explicit absence of a classification

Those labels are owner declarations. They do not prove implementation
behavior, change permission, or select an executor. Template files are an
independent observation. Missing classification remains unclassified.

4. EXACT RESOLUTION LOGIC
-------------------------

Owner: RAB.Box/bridge/tool-contract.mjs, loadToolContract().

  Discover settings and resolve executor
    -> read contract.json beside the resolved executor (optional)
    -> read leaf contract.json if in a different folder (optional)
    -> combine inherited fields and explicit leaf fields
    -> expose contract plus file/field provenance in the catalog

It does not automatically merge every contract along every ancestor folder.
The executor owner's folder provides defaults. The leaf overrides it.

Inside each file or selected branch:
  1. Resolve relative extends, if present.
  2. Apply explicitly present result, source and settings fields.
  3. Resolve select against the tool, then evaluate the matching variant.
  4. Overlay the selected variant's fields.

Overrides are whole-field replacements, not deep merges of result fields.
An absent field inherits. Explicit result:null clears the inherited preview.
Selectors support name or dotted meta paths; matching selector values may
be strings, numbers or booleans. Unknown variants add nothing. A variant
may itself extend a file or select another variant.

Each file resolves through realpath and must stay inside the supplied tool
boundary. Circular references are rejected. Unsupported versions, malformed
JSON, invalid source kinds and invalid references surface as contract errors.
Missing optional owner/leaf files are allowed; a missing explicit extends
target is an error. Invalid contracts can make a tool unavailable at discovery.

No executor import is needed to browse its contract. This separation is
tested using an executor that would throw immediately if imported.

5. A REAL SHARED-ENGINE EXAMPLE
-----------------------------

tools/audit/find/contract.json selects meta.engine. Its line variant extends
../_engines/line-pattern.contract.json. Other branches describe structure,
theme, metric and syntax engines.

The line-pattern result describes status, scan, root, totals.files_scanned,
totals.matches, rows containing file/line/column/text/kind, and heuristic.
A new leaf using that shared engine can inherit this description. A leaf
with a different output needs its own truthful override. An unknown engine
does not silently inherit another engine's result shape.

6. HOW THIS CONNECTS TO BOX'S DECISIONS
-------------------------------------

Discovery: bridge/tool-house.mjs validates tool definitions and resolves
executors before attaching loadToolContract() output. Project-local tools
also load contracts, bounded by the project root. Contracts affect whether
a capability is available when the declaration is invalid.

Meaning: bridge/capabilities.mjs compares semantic seats such as domain,
operation and target_type, rejects hard conflicts, and scores matches.
bridge/session-planner.mjs resolves inputs from the selected capability,
context and declared defaults. Its phrase contract:default refers to input
declarations; it does not mean a default was read from contract.json.result.

Binding: tool-house.mjs bindSettings() rejects undeclared input names, applies
defaults when absent, collects required gaps, and checks primitive types and
enum membership. False and zero remain valid values. Executors must still
check nested objects, paths and cross-field constraints.

Dependencies: an input's try may name a helper tool. The runner binds shared
inputs to that child, executes through the same runner, extracts its actual
returned value, substitutes the relevant seat and binds the parent again.
Unresolved required fields stop execution with INPUT_REQUIRED. The declaration
contract.returns alone does not fill a seat or guarantee a returned value.

Execution: after binding and other runner checks, the module is imported and
run({options,context,tool,root,toolsRoot,helpers}) is called. Public child calls
through helpers.runTool retain parent execution links, trace and seat state.
Confirmation belongs to the conversation/service workflow; merely possessing
a contract file is neither confirmation nor a permission grant.

Continuation: packResultSeats() reads actual provided.seats and continuation
values. Those values can populate subsequent task state. The runner does not
compare each result field against contract.json.result before completion.

Failures: errors carry execution state. If child writes already completed,
the runner can revoke safe_to_resume. A contract or failed return does not
imply rollback. Partial execution evidence must survive.

7. CATALOG AND UI
-----------------

The catalog contract contains:
  consumes: derived from input names in tool.settings
  returns: derived from meta.returns, or []
  result/source/settings: resolved sidecar descriptions, when supplied
  files: contract files read
  owners: file responsible for each resolved descriptive field

tools/audit/_output-shapes.mjs formats these descriptions. The Toolbox's
embedded formatter in magic-box/index.html uses tool.contract.result and
shows input/return declarations, implementation classification and owner.
An absent or null result means output is undocumented, not that no output
exists. Previewing does not execute the tool.

Discovery can be cached. listTools({fresh:true}) refreshes it. The service
catalog and top-level runner support fresh discovery; the UI filters its
loaded snapshot. This is not a general filesystem watcher.

8. PERSISTENCE IS A DIFFERENT CONTRACT
------------------------------------

bridge/rab-memory.contract.json describes the audit-result/v1 envelope.
bridge/tool-tracking.contract.json currently describes tool-execution/v2.
Both use version plus shape, rather than the tool-contract/v1 sidecar format.
service.mjs supplies these descriptions to the UI separately.

The runner's saved tool.contract is deliberately compact: consumes and returns
only. The full result/source descriptions and their owner-file list are not
automatically embedded in every execution receipt. Actual result data is
retained separately. bridge/tool-tracking.mjs packs composite references and
seats while retaining the public root result.

Consequently, an old saved receipt does not itself freeze the exact output
description or executable source revision used at that time. Owner paths are
not content hashes. A schema/envelope version does not establish a scanner
revision or prove its findings.

9. SOURCE REVIEW AND PROVENANCE
------------------------------

scripts/audit-stamp-sources.mjs consumes discovered source classifications
and their owners. It fingerprints inspected settings, resolved executors,
contracts and templates, then rechecks the files/discovery before saving.
It does not run discovered tools or exhaustively follow imported dependencies.
This source-review evidence is stronger than a descriptive sidecar alone,
but has an explicit inspection scope.

10. CURRENT LIMITS AND DOCUMENTATION GAPS
---------------------------------------

- Result descriptions are not runtime output validators. Tests and actual
  outputs must establish conformance; the file can drift from implementation.
- Optional contract.settings is display documentation, not the authoritative
  input schema. Calling both things settings can obscure that distinction.
- A missing contract is allowed by discovery. Authoring guidance expects
  truthful contracts and tests; installed availability alone is insufficient.
- source.kind does not determine runtime stamp/tool kind. Current authoring
  rules say a template-backed scaffold still has runtime kind Stamp.
- Moving an executor can change its inherited contract owner. A wrapper
  executor also changes the owner chosen by the loader; inheritance follows
  the resolved file, not JavaScript imports. Recheck after consolidation.
- docs/domains/tool-contracts.md mentions tracking v1, but the current owned
  tracking description is v2. Use the current owner for the concrete format.
- engine/src/README.txt refers to runtime.mjs, which was absent during this
  inspection. Do not present that historical module map as the current runner.
- The word contract also labels legacy stamp settings/bindings and question
  objects. /api/stamp and the UI's Contract & seats panel are not proof that
  every displayed contract came from a contract.json sidecar.

11. END GOAL
------------

Recorded goal: a capability describes itself at its implementation owner,
Box derives the catalog and previews, and tools can be added or moved without
maintaining duplicate output tables or fixed installed counts.

Broader architectural interpretation: connect understandable intent to explicit
inputs, controlled execution, useful returned values and inspectable evidence.
This interpretation follows the code and project purpose; it is not a claim
that contract.json alone implements or formally proves that entire chain.

12. RESEARCH METHOD AND READING ROUTE
-----------------------------------

Read boot/rules, searched contract.json references, traced loadToolContract
into discovery and execution, read the formatter/UI consumers and persistence
descriptions, inspected shared-engine examples, then compared local design
notes and tests. No Git history was used as evidence. No runtime tool or
service was started for this research, and no application code was changed.

Primary source paths (relative to L:/RAB.World/RAB.Box):
  bridge/tool-contract.mjs                 resolution and provenance
  bridge/tool-house.mjs                    discovery, binding, execution
  bridge/capabilities.mjs                  semantic capability matching
  bridge/session-planner.mjs               input resolution and questions
  bridge/service.mjs                       catalog and persistence previews
  bridge/tool-tracking.mjs                 saved result/reference packing
  bridge/rab-memory.contract.json          saved report description
  bridge/tool-tracking.contract.json       current execution description
  tools/audit/_output-shapes.mjs           descriptive formatter
  tools/audit/find/contract.json           metadata variant example
  tools/audit/_engines/line-pattern.contract.json  shared result example
  magic-box/index.html                     visible contract/output consumers
  scripts/audit-stamp-sources.mjs          scoped source fingerprinting
  docs/tools/RULE.txt                      current authoring requirements
  docs/domains/tool-contracts.md           consumer design documentation
  docs/todo/stamp-discovery-and-drift.md    recorded motivation/end goal

Tests inspected, not executed as part of this document:
  tests/tool-contract-discovery.test.mjs
    inheritance, explicit null, variants, refresh, no executor import,
    bounded references/cycles, saved compact metadata, classification owner
  tests/external-toolkits.test.mjs (reference search)
    external owner inheritance and boundary cases
  tests/toolbox-output-shapes.test.mjs (reference search)
    preview and persistence descriptions

This is a source-grounded research document, not a fresh full-suite pass or
an assertion that every installed tool's declaration matches its output.
