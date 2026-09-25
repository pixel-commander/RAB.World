# Shared stamp runner migration

Date: 2026-09-20. Working project: `C:\Users\pixelcommander\Desktop\RRAABBIITT_v0.9.3` on PIXEL.
No project changes were made in the Documents/ChatGPT copy.

## Active contract

Session Turns, Workbench manual stamp requests, the public engine entry point,
and the public CLI now call `bridge/tool-house.mjs`. Public tools export
`run({ options, context, tool, root, toolsRoot, helpers })`.
Nested work calls `helpers.runTool(...)`, preserving child tasks and receipts.
Workbench is a confirmation/input facade, not another executor.

`mock-project/PATHS.json` no longer registers old `plan()` stamps.
Old saved planner tickets are rejected; prepare a new native request.
The former `/api/plan` route returns RETIRED_CONTRACT instead of falling back.
Current Tool House IDs were preserved. Historical IDs remain in reference
fixtures, not aliases that silently dispatch to different implementations.

## Disposition

| Former stamp | Current home / disposition |
| --- | --- |
| ReactProject | `tools/react/stamp-new-project`; current runnable scaffold retained, optional `starter: style-guide` and `add_database: true` preserve useful payloads |
| Component / NewComponent | `tools/react/stamp-new-component`; one current implementation, metadata and caller prop/class composition preserved |
| SubComponent | `tools/react/stamp-sub-component`; shared component generator and native child path |
| NewPage | `tools/react/stamp-new-page`; content, text output option, construction seats |
| Atom | `tools/css/stamp-new-atom`; flat CSS output, optional registered token input |
| Div / SubDiv | Existing `tools/react/add/element`; nested elements now mutate the actual parent source using construction seat IDs, rather than disconnected scaffold files |
| ComponentNote | Test-only text artifact retained in fixtures; no redundant public note stamp added |
| StampMaker | Existing `tools/base/stamp-new-stamp`; creates the current contract skeleton, not the retired planner contract |

The new-stamp tool creates a skeleton: presence of template/ is a catalog
classification, NOT proof that the generated tool's TODO behavior is implemented.

## Preserved reference material

- Original default-project stamps: `tests/fixtures/stamp-contracts/stamps/`.
- Former planner: `tests/fixtures/planner-reference.mjs`.
- Former executor/CLI/demo: `engine/tests/fixtures/*-reference.mjs`.
- Older engine example projects remain reference-test data, not live catalog entries.
- Recoverable pre-migration snapshot: `verification/pre-stamp-migration-20260920.zip`.

The earlier source audit is a historical snapshot. Its links into
mock-project/stamps refer to the pre-migration locations above.

## Adding or changing tools

Use the current stamp mold and settings vocabulary. Keep a stable ID and a
single owner for shared behavior. Required fields produce questions through
binding; preserve supplied false, zero and valid empty values.

A dynamic missing input must name a declared setting and throw INPUT_REQUIRED
with `details: { safe_to_resume: true, missing: [...] }` only before mutation.
The runner removes safe-resume permission if a previous child write completed.
Workbench and Turns keep the same pending request/step; they do not blindly
repeat partial writes. Component `ensure_atoms` demonstrates this: ask for
background_token, then call the native atom stamp through helpers.runTool.

Migrated project/component/page/atom builders use `_artifact-plan.mjs` to render,
preflight paths/duplicates/overwrites, write with exclusive creation, and compare
written file hashes. This helper is not an executor. Partial write failures
report what was written; there is no automatic rollback. Hash verification
proves emitted bytes match the plan, not that the program is semantically correct.

Workbench fingerprints settings, executor, template, assets and the two shared
stamp helpers. This is not a complete transitive dependency/environment lock.
Server-managed runs retain confirmation, revision, locking and replay protection.
The standalone CLI is not a durable exactly-once queue; don't replay successful
mutation tickets. Builder no-overwrite checks remain enforced.

## CLI

Inspect: `node engine/cli.mjs --project mock-project --inspect`

Prepare: `node engine/cli.mjs --project PATH --canonical request.json`

Execute: add `--execute` after inspecting the result. `--ask` collects missing
inputs. `--ticket-out FILE` and `--result-out FILE` refuse overwrites.
Use `--rab-home PATH` to isolate verification tracking.

Example request:

```json
{
  "mode": "command",
  "capability": "react/stamp-new-component",
  "options": { "name": "Panel", "location": "C:/my-project/src/components" }
}
```

## Verification and limits

Targeted migration tests generate and inspect real project/component/child/page/
atom output, optional StyleGuide/SQLite payload, preflight failures, native CLI
prepare/execute, and same-ticket missing-atom recovery with a tracked child call.
Session tests execute nested div insertion and preserve explicit target overrides.
Server tests cover confirmation/replay, stale settings, receipts and file reads.

Full-suite runs reproduced only the three existing Windows EPERM symlink-fixture
failures (dom-edit-security-v085, full-house-v085, and server symlink output test).
These security probes did NOT pass; the operating system prevented fixture setup.
Do not describe this as a fully green suite. Full-suite result: 454 tests,
451 passed, 3 failed, 0 skipped. All eight targeted migration tests passed,
including a rerun after expanding Workbench fingerprints to cover assets and
shared stamp helpers.

Browser smoke check: Workbench displays 18 native stamps and correct component
fields; Toolbox remains available; no captured browser error logs. No visual
redesign was performed. Backend execution is verified separately by tests.

No dependencies were installed and no generated React production build was run
in this migration. Template/source/output checks are not a replacement for that
build. The optional SQLite file is a seed, not a running database service.

The user's server on 4318 was not restarted. Browser verification used an isolated
temporary local server, now stopped and its browser tab closed. Restart the normal application when ready to load these
changes; no server-host drive letters were treated as local PIXEL drives.
