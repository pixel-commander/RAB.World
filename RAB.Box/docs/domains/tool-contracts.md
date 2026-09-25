# Discovered tool contracts

Updated 2026-09-20. Owner: Tool House discovery. Related work and verification: [drift checklist](../todo/stamp-discovery-and-drift.md).

## One description at its implementation owner

Tool House discovers `settings.json` and the nearest executable as before. It also reads a data-only `contract.json` beside that executable. A leaf with an inherited executor may supply its own `contract.json` to override explicitly supplied fields. Missing keys inherit the executor owner's defaults; an explicit `result: null` clears an inherited result description. Discovery never imports an executor to obtain a contract.

```json
{
  "version": "tool-contract/v1",
  "source": {
    "kind": "internal",
    "description": "Builds a result by inspecting source files."
  },
  "result": {
    "status": "string",
    "rows": [{ "name": "string", "count": "number" }]
  }
}
```

`source.kind` may be `template`, `internal`, `hybrid`, `composite`, `file-operation`, or `unclassified`. These are owner declarations, not automatic proof of implementation behavior. Undeclared classifications remain unclassified. Observed template paths stay separate from these declarations. Existing writer classifications were transferred from the source review after checking unchanged executor hashes and re-reading migrated owners; there is no runtime list of tool names in the report generator.

`result` and optional `settings` use the existing Toolbox description notation: strings describe types, objects describe fields, and one-item arrays describe an item shape. A key ending in `?` is optional; `{ "$nullable": ... }` represents a nullable shape. These descriptions are not JSON Schema and do not add runtime result validation. Actual fixture outputs must still be checked against the descriptions.

Shared engines can select descriptions using existing metadata:

```json
{
  "version": "tool-contract/v1",
  "select": "meta.engine",
  "variants": {
    "line": { "extends": "../_engines/line-pattern.contract.json" }
  }
}
```

A selector is `name` or a dotted path under `meta`; variant names match its string, number, or boolean value. A selected branch may supply fields or another selector. `extends` reads a relative contract file, which must declare the same contract version and resolve within the tool boundary. Cycles and invalid references produce unavailable-tool diagnostics. Unknown variants supply no extra fields: they never borrow another variant's result shape.

The catalog's `tool.contract` retains `consumes` and `returns`, and adds any declared `result`, `source`, and `settings`, plus `files` and `owners` provenance. The runner keeps saved tool metadata compact: it writes only `consumes` and `returns` there. Sidecar paths identify descriptions, not an executable revision or a source-content hash.

## Shortcuts and refresh

The paths registry derives unambiguous shortcuts from discovered semantic paths, dropping the domain and a `stamp-` prefix. For example, `audit/inspect/example` is reachable as `inspect-example`. No registry file is written for this derivation. Permanent IDs and full tool paths remain available.

Explicit house aliases retain precedence and planner ordering. Project overrides retain their existing semantics. A derived name shared by multiple capabilities is ambiguous unless an explicit mapping resolves that name; use the ID or full path otherwise. Explicit registrations must match both the permanent ID and current path. A removed ID never silently falls back to a different tool occupying its old path. `pack().diagnostics` and the catalog HTTP response's `address_diagnostics` expose ambiguity/staleness; no automatic registry rewrite occurs.

`listTools({fresh:true})` is the explicit refresh API. The HTTP catalog/search and top-level runner calls refresh discovery. Toolbox reloads its catalog when opened again; typing filters the loaded snapshot. This is explicit refresh, not a filesystem watcher. Long-running callers using a cached catalog must request a fresh scan after external changes.

## Previews and persistence

The Toolbox receives result contracts from the catalog. Its embedded guide only formats supplied descriptions; it has no per-tool result lookup table. The UI formatter's sync/check command remains:

```text
node scripts/sync-toolbox-output-shapes.mjs --check
```

Saved-report and tracking descriptions live beside their existing owners in `bridge/rab-memory.contract.json` and `bridge/tool-tracking.contract.json`. They describe existing `audit-result/v1` and `tool-execution/v1` behavior. No new writer, save format, or runtime validator was introduced. Selecting tools and expanding previews does not execute them or initialize project memory.

Actual audit results and tracking stay in the selected `.rab` project through the existing writer. Composite references can point into `#/result/...` or `#/child_results/...`; consumers must resolve saved references through the memory owner and preserve failed/partial status. An envelope version alone does not establish a scanner revision.

## Source-inventory helper

```text
node scripts/audit-stamp-sources.mjs
node scripts/audit-stamp-sources.mjs --root C:/path/to/box --output C:/path/to/working-reports
node --test scripts/tests/audit-stamp-sources.test.mjs tests/tool-contract-discovery.test.mjs
```

The helper reuses Tool House discovery, calculates current totals, reads owner classifications, and records unknowns and diagnostics. It fingerprints inspected settings, executors, contracts, and template files, then rechecks them and discovery before saving. It does not execute discovered tools. Shared-catalog scope excludes kitchen; legacy project registries, packaged examples, and transitive implementation dependencies are explicitly outside this inventory.

Default output is the selected Box root's `docs/session-audits/`, because this is a session source-review helper, not an audit-tool execution. Dated Markdown/JSON snapshots are never overwritten or treated as live registration requirements. The previous ChatGPT-workspace helper forwards to this owner; its original source and original reports are preserved.

Adding a new tool to an existing engine can inherit that engine's contract. A genuinely new output or behavior needs a declaration at its new implementation owner and meaningful fixture coverage; no installed-count expectation needs updating.
