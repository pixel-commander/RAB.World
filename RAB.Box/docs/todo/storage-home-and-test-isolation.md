# Storage home reconciliation and test isolation

Update 2026-09-21: the live home is now the user's `.rab`. The Desktop and
AppData copies were retired into `.rab/backups/1789993051557`; saved work and
the conflicting test record were preserved. See
[the correction report](../session-audits/2026-09-21-user-storage-correction.md).
The original handoff below predates that completed recovery. Test-record
contamination cleanup remains open.

Recorded 2026-09-21. Implementation owner: **Inspect RRAABBIITT v0.9.3**.
This task is recording the handoff only; no parallel migration, cleanup or
service restart is underway here.

## Confirmed direction and evidence

The coordinating task relayed the user's confirmed boundary: Box-owned memory,
state, results and test output belong under `C:\Users\pixelcommander\.rab`.
Test output belongs in its `temp/test` namespace. Source projects and custom
toolkits retain their separately configured locations.

The former preview home
`C:\Users\pixelcommander\AppData\Local\Temp\rab-panel-browser-C3DLO9\.rab`
contains real work and must be preserved. Coordinator inventory reports:

| Saved project | ID |
| --- | --- |
| Preparation panel demo | 1789937505416 |
| Mock project | 1830000000042 |
| box-result-viewer | 1830000000063 |

This task independently read `box-result-viewer`'s settings and observed its
source `C:\magic\box-result-viewer` and saved session directory. The coordinator
reports that the normal home registers the same mock-project source under
**1830000000785**. The two project-root registries cannot be blindly merged.

The coordinator also found ordinary project registrations in the normal home
whose sources are test fixtures under `AppData\Local\Temp\rab-review-*`,
`rab-dom-edit-*`, `rab-stamp-maker-*` and similar locations, including recent
name-based entries. A source path or timestamp alone is not proof that a record
is disposable or attributable to one task. Preserve all records for now.

## Follow-ups

- [x] Inventory both homes and preserve their original records before reconciling
  projects, sessions, receipts, telemetry, report references and allocated IDs.
- [x] Resolve the known same-source/different-ID mock-project case explicitly.
  Check for other ID/name collisions and reference dependencies throughout both
  homes. Preserve original provenance; do not silently rewrite old receipts.
- [x] Move the live backend to the normal home only with a verified mapping of
  saved projects and sessions. Verify the user's real project can resume and its
  old results reopen before treating the old home as superseded.
- [ ] Trace test registrations leaking into normal `projects/`: fixtures,
  helpers, child tools and worker processes must receive the isolated test home.
  Root location alone does not establish isolation from the user's project list.
- [ ] Put test-owned homes/output beneath `.rab/temp/test/<run-id>/` and verify
  that an entire test run does not register fixtures in normal `projects/` or
  change existing user sessions/results. Separate intentional ID allocation
  from unintended runtime writes when checking this boundary.
- [ ] Classify existing contamination from evidence before proposing cleanup.
  No deletion is authorized by this checklist or by a temporary-looking path.

Related: [project-name storage report](../session-audits/2026-09-21-project-name-storage.md).
Actual runtime/audit records stay in their storage homes, not in `docs/`.
