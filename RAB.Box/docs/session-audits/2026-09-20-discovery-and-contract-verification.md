# Discovery and contract drift: implementation and verification

Date: 2026-09-20. Task: Review audit stamps.
Project: `C:/Users/pixelcommander/Desktop/RRAABBIITT_v0.9.3`.

The user released the previously reserved shared files for the full [drift checklist](../todo/stamp-discovery-and-drift.md). Implementation and ownership were then coordinated with Inspect RRAABBIITT v0.9.3. The checklist is complete; environment limitations below remain explicit. This record describes this verification run, not a permanently expected installed inventory or a guarantee about later concurrent edits.

## Completed work

| Checklist item | Implementation and evidence |
| --- | --- |
| Reconcile owners | User released shared scope. Other task accepted discovery/contract ownership here, with its evidence adapter in separate private helper/test paths. Subsequent writer/scanner/UI lanes were handed back explicitly. |
| Replace the report helper | [Project-local helper](../../scripts/audit-stamp-sources.mjs) uses Tool House discovery, calculated totals, owner declarations and explicit unknowns. [Dedicated tests](../../scripts/tests/audit-stamp-sources.test.mjs) add, move and remove fixtures without changing a roster. The old workspace entry forwards here; its [original source](2026-09-20-stamp-source-helper-original.mjs.txt) and report originals remain preserved. |
| One classification owner | Data-only contract sidecars beside writer executors provide source descriptions. Existing reviewed descriptions were transferred after unchanged-source checks, with migrated writers re-read. Unknown new behavior remains unclassified. The report has no tool-name classification table. |
| Shortcut consistency | [Paths registry](../../bridge/paths-registry.mjs) derives unambiguous addresses, preserves explicit aliases and project overrides, and reports ambiguity/staleness. Tool House no longer resolves a missing permanent ID to another tool at its former path. Tests cover ambiguity, stale paths/IDs, movement, removal and explicit alias preference. |
| Refresh | HTTP catalog/search and root runner calls refresh discovery. Explicit `listTools({fresh:true})` remains supported. Service tests see an externally added tool and its contract without initializing a project. No watcher or registry rewrite was added. |
| Owner-driven previews | [Contract loader](../../bridge/tool-contract.mjs) reads declarations without importing executors. Audit result descriptions live with their executor/engine owners; [Toolbox guide](../../tools/audit/_output-shapes.mjs) only formats supplied descriptions. Saved-report/tracking descriptions sit beside their existing owners. Actual persistence behavior remains with those writers. |
| Behavioral tests | Removed fixed installed totals/minimums from Toolbox preview, audit-expansion, full-house, tool-house-v08 and turn-checker tests. Representative discovery, valid structure, unique IDs and actual behavior still guard against empty/broken discovery. Counts for controlled fixture behavior remain legitimate. |
| End-to-end verification | [Integration tests](../../tests/tool-contract-discovery.test.mjs) cover inherited/overridden contracts, unknown variants, bounded/cyclic references, derived lookup, root execution, saved report/tracking references, false/zero result values, default input binding and unchanged source. Browser checks confirm the supplied shapes and isolated Toolbox flow. |

Consumer-facing details and examples: [tool contracts](../domains/tool-contracts.md).

## Test results

- Initial relevant suites: 16 passing, including fixture outputs from 129 passive audits and the saved report/tracking writer contract.
- New integration suite: 6 passing; source-report helper suite: 4 passing.
- Initial full run: 455 passing out of 464, with 9 failures. Six exposed a regression where a generated alias took precedence over an existing explicit alias. The registry now appends generated addresses after explicit mappings, with a dedicated preference assertion.
- Affected session/turn/discovery rerun after that fix: 28 passing.
- Full rerun: **461 passing out of 464; 3 failures**, all Windows `EPERM` while creating symlink fixtures. These match the environment limitation recorded by the migration session. They were not bypassed or marked passing.
- Focused checks after removing the additional historical count assertions passed, including the full-House expansion discovery check. The formatter synchronization check also passed.

Full commands included:

```text
node --test tests/*.test.mjs engine/tests/*.test.mjs scripts/tests/*.test.mjs
node --test tests/tool-contract-discovery.test.mjs tests/session-planner.test.mjs tests/turn-checker-v085.test.mjs
node scripts/sync-toolbox-output-shapes.mjs --check
```

The three environment failures are:

- active bounded security verifier pulls the real doors and all probes pass;
- active security suite pulls control-plane, DOM and local-network doors;
- symlinked output paths and unsafe run IDs rejected.

Full rerun console log: `C:/Users/PIXELC~1/AppData/Local/Temp/rab-drift-final-Hck4gZ/tests.txt`. Initial failure log: `C:/Users/PIXELC~1/AppData/Local/Temp/rab-drift-test-log-txG3qc/tests.txt`. These temporary logs may later be cleaned; the outcomes and correction are retained here.

## Browser and source checks

An isolated server at `http://127.0.0.1:61110/?view=toolbox` used separate temporary RAB_HOME storage. Search, Enter, selection, class-result preview, report/tracking expansion, project-creation preview, and contract-owner/classification fields were checked. No browser warnings/errors were observed, and the temporary `.rab` folder did not exist after browsing. The generated project-creation description now includes the migration's verification record.

The [current source inventory snapshot](stamp-source-inventory-2026-09-20T15-58-07.252Z-13359152.md) and its [JSON evidence](stamp-source-inventory-2026-09-20T15-58-07.252Z-13359152.json) were produced without executing a discovered tool. Snapshot counts are observed values, not assertions about future installations. Kitchen was excluded from that report. Existing full-path and permanent-ID lookup remain available where short names are ambiguous.

Automatic approval review rejected cleanup of the isolated browser-test server/process and empty temporary folder with **“blocked by policy.”** The server remained at port **61110**, PID **4208**, at closeout. No alternate cleanup route was attempted after rejection. The browser tab was closed, and the main shared service was not restarted.

## Handoff and limits

Contracts describe outputs; they are not new runtime validators or scanner-version guarantees. An implementation change still needs its owning contract and meaningful output fixtures updated together. New tool behavior without a declared contract remains visibly unknown. Refresh is explicit at the documented boundaries, not continuous filesystem watching. Source inventory fingerprints inspected files and checks for changes during collection; it does not prove a complete transitive import graph.

The other task received a read-only review of its evidence-adapter plan: consume actual saved reports, resolve project-contained references through the memory owner, preserve partial/failed status and JSON-pointer escaping, and resolve class locations relative to the audited folder. Envelope versions and preview-owner paths do not establish source revisions.

`bridge/rab-memory.mjs` and an optional focused lock helper were released for the separate persistence fix. Existing class scanner implementations, the future class-impact tool, Toolbox fixture extension and later UI integration were also released to their agreed owner. Those follow-ups are outside this completed drift checklist and must retain their own evidence. No persistence-writer or scanner implementation change is claimed by this report.
