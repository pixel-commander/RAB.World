# Investigation UI verification — 2026-09-20

This is a development-session report, not an audit result. Runtime evidence remains under the selected audit project's `.rab` results folder.

## Scope

The Investigation UI task changed [magic-box/index.html](../../magic-box/index.html) and added [its dedicated tests](../../tests/audit-evidence/ui.test.mjs). The coordinating task owns the backend, scanner, evidence records, default test command, and generated demo. No shared service was restarted by this task.

The new `Investigations` tab uses the active `state.session` and matching project settings. It loads saved investigations through `POST /api/investigations`, displays definition/consumer locations, conclusions, coverage gaps, source freshness, human declarations, and raw evidence. It prepares one paired `:active` / `.is-active` custom-property change in an observed CSS file, displays the plan and recorded prior file, requires explicit approval, and shows verification and local handoff records.

Selection and approval clear when project, session, or audit folder changes. Responses from the prior context are ignored. Unknown intent and stale/unknown source freshness block planning. Edited drafts invalidate approval. An attempted plan is not retried automatically; uncertain execution errors tell the operator to inspect the saved state. The backend remains the final authority for writes.

## Browser walkthrough

Used a separate backend at `http://127.0.0.1:58929`, owned by the coordinating task. Its `.rab` lives in the retained disposable demo at `verification/audit-factory-2026-09-20T16-13-42-711Z/`. Shared server `4318` was not restarted.

1. Opened `?view=investigations` without an audit session. The page showed the audit-project setup guidance and disabled actions.
2. In Chat entered `load project evidence-demo-audit`. Returned to Investigations; project name, saved folder, and existing reports loaded.
3. Reopened the prior plan. It showed stale evidence (new package lock and changed target bytes); approval and apply were disabled.
4. Ran `action-main`. The fresh result showed four selector occurrences, one assignment in `src/components/Button/Button.tsx`, partial coverage, and unresolved dynamic usage. These counts describe this fixture, not installed inventory requirements.
5. Saved an **Intentional** decision with reason: “Verify the Investigation UI by changing the generated demo action-main paired state skin to the existing surface-main and content-main tokens.”
6. Prepared `src/atoms/action-main.css` with:

   ```css
   --action-main-background: var(--surface-main);
   --action-main-color: var(--content-main);
   ```

7. Reviewed plan `plan:7e2bfbb98e5f847deecd4872cae40ca8`. Apply was disabled until the explicit approval checkbox was checked. Applied once through the UI.
8. All five reported verification checks passed: consistent post-scan coverage, expected target bytes, unchanged other captured source, retained consumers, and the prepared writer operation. The page retained the separate application-build/visual-verification limitation.
9. Prepared a local handoff, reloaded the page, and reopened it successfully. No handoff was transmitted externally.
10. Used **Clear Bag** to create a new session in the disposable project. Selection, class input, and approval cleared; the project remained selected. Reopening the existing project-owned handoff in the new session worked.

Final browser inspection showed readable layout and no captured warning/error console entries. Browser testing found a malformed option tag that prevented selecting Intentional; fixed it and added a dedicated markup regression check. The broader suite found disallowed `minmax(...)` in the new grid; replaced it with `1fr 3fr` plus logical shrink guards. Empty-list copy now distinguishes an unloaded list after session change from a loaded, empty list.

## Saved evidence

All paths below are relative to:

`verification/audit-factory-2026-09-20T16-13-42-711Z/.rab/projects/evidence-demo-audit/audit-results/1789920825354-59d4a85d/`

- Prepared plan: `audit-inspect-class-impact-1789921261450-3c2ae3eb.json`
- Verification: `audit-inspect-class-impact-1789921282828-0c68d98c.json`
- Handoff: `audit-inspect-class-impact-1789921288515-08130153.json`

Independent file inspection confirmed paired selectors and preserved focus styling. Target SHA-256 exactly matched the prepared plan:

`91a1b695b822f5b9f2c63b7a12b52d6840d634232d2b15599ce6da6f403d53cc`

## Checks and limits

- Dedicated controller/markup checks: 11 passed. They cover scope mismatch, delayed responses after session changes, approval/draft coupling, uncertain execution without retry, stale evidence, typed decisions, local handoff, and text rendering.
- Embedded Toolbox output guide synchronization check: passed.
- `node --test tests/server.test.mjs tests/audit-evidence/ui.test.mjs`: 31/32 passed. The only failure was the existing Windows `EPERM` while creating the symlink fixture in “symlinked output paths and unsafe run IDs rejected.” The test did not reach its application assertion. The server HTML contract passed after the grid correction.
- The coordinating task owns the full-project suite and the generated application's build/visual verification. This UI report does not claim runtime equivalence from static class evidence.

The temporary browser tab was closed after final verification. Isolated backend lifecycle remains with the coordinating task. UI file ownership was released at handoff; no further implementation is pending in this bounded UI task.
