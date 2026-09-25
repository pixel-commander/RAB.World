# RRAABBIITT Magic Box v0.9.3 — Construction Composition

## README rule: no indexes or counts

WE DO NOT INDEX OR COUNT SHIT IN THE README. EVER.

Duplicated inventories and counters cause drift and wobbles. READMEs explain contracts, storage, and workflows; they must not maintain tool catalogs, inventory tables, or test/tool totals, including historical release totals. Link to the authoritative generated index and its rescan tool instead. Keep dated verification results in their reports, not in a README. This rule applies to every README in this project.

v0.9.3 builds on the verified v0.9.2 nested-scope/construction-seat release. It adds the missing page, dashboard, grid-application, component-placement, and vertical-scroll construction capabilities while keeping the Runner generic.

## Recorded release baseline

The figures below preserve the original release receipt. For the current installed catalog, open Toolbox; discovery derives its inventory from tool folders. Current contract behavior and refresh rules are documented in [tool contracts](docs/domains/tool-contracts.md), with a [dated verification report](docs/session-audits/2026-09-20-discovery-and-contract-verification.md).

- **249 public capabilities**
  - **17 Stamps**
  - **232 non-Stamp Tools**
  - **25 Kitchen Tools**
  - **4 Food Process Tools**
  - **0 unavailable**
- **389 / 389 Node tests passing** across the complete `tests/*.test.mjs` and `engine/tests/*.test.mjs` surface
- Language audit passing
- Main browser harness: **18 checks**, 0 JavaScript errors
- Turn Checker harness: **3 checks**, 0 JavaScript errors


## Recovery review hardening

The recovered v0.9.3 package received a focused code-review hardening pass without changing stable Tool IDs or Runner semantics:

- `react/insert/component-into-area` now distinguishes the expected component import source from a same-name binding imported from another module. A collision fails closed with `IMPORT_COLLISION` and leaves the target file unchanged.
- `react/apply/grid-layout` now accepts `seat_id` or `area` so the existing grid composition can target an exact nested construction container. Nested area seats receive deterministic scope suffixes to avoid colliding with root area seats.
- live engine wording no longer presents the removed legacy writer species as current architecture.
- release packaging restores a single top-level `RRAABBIITT_v0.9.3/` folder.

## New construction capabilities

### Stamps
- `react/stamp-new-page` — creates an addressable React page root
- `react/stamp-new-dashboard` — compound dashboard generator

### Tools
- `react/apply/grid-layout` — applies a known grid topology and creates addressable areas
- `react/insert/component-into-area` — inserts a React component into a named/exact area and adds its relative import
- `react/apply/scroll-y` — applies the canonical vertical-scroll utility
- `react/add/scroll-wrapper` — wraps one target in a vertical-scroll container

The dashboard Stamp composes the smaller capabilities through Runner-owned child Tool calls:

```text
Dashboard
  -> New Page
  -> Apply Grid Layout
  -> New/Reuse SiteNav
  -> Insert SiteNav Into Area(header)
```

It does not duplicate their engines.

## Order / confluence behavior

The release includes a direct construction-order test:

```text
page -> grid -> SiteNav -> insert
```

and:

```text
SiteNav -> page -> grid -> insert
```

Both converge to the same final page source.

The compound Dashboard Stamp is also checked against the equivalent primitive sequence and converges to the same result.

## Construction seats and cleanup

Generated page/grid structures may retain exact `data-rab-seat` construction addresses while work is in progress. Later Tools can target those seats without asking the human to remember internal addresses.

The **Scaffolding Cleanup Pass** remains strip-only. It removes RRAABBIITT construction markers after semantic work is complete; it does not resolve seats, infer values, move content, or otherwise edit application semantics.

## Scroll behavior

Canonical Grid CSS now includes:

```css
.scroll-y {
  min-block-size: 0;
  overflow-y: auto;
}
```

`Set Scroll Y` applies that utility to an exact target. `Add Scroll Wrapper` creates a wrapper carrying the same utility and may leave its own construction seat for later work.

## Architecture remains one machine

Everything invokable is a **Tool**. A **Stamp** is the template-backed Tool subtype.

The v0.9.2 nested scope law remains unchanged:

```text
Bare-name inheritance: PROMOTED/session state only
Task-local values: explicit Runner-controlled boundary crossing only
```

Domain-specific structure stays in Stamps/Tools instead of growing artifact-specific Runner logic.

## Run

Node 22+:

```bash
npm start
```

Windows:

```text
RUN_UI.cmd
```

## Verify

```bash
npm test
npm run language:audit
```

Optional browser verification:

```bash
python tests/browser_interaction.py
python tests/browser_turn_checker_v085.py
```

## Start reading

- `START_HERE.txt`
- `docs/CHANGES_v0.9.3.txt`
- `docs/CONSTRUCTION_SEATS.md`
- `docs/GLOSSARY.md`
- `TEST_REPORT.txt`
- `MERGE_LEDGER.md`

The verified v0.9.2 package remains the rollback floor for v0.9.3.
