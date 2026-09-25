# Scoped feature-request storage

Implemented 2026-09-21 in `C:\Users\pixelcommander\Desktop\RRAABBIITT_v0.9.3`.
This is an implementation report, not another saved feature-request record.

## Destinations

The Requests page now offers **Global / shared** and **Selected project**.
New request records have only these destinations under the configured RAB home:

```text
<RAB_HOME>/feature-requests/<request-id>/settings.json
<RAB_HOME>/projects/<existing-project-directory>/feature-requests/<request-id>/settings.json
```

New named project directories use the project name; existing numeric directories
stay in place. The registered numeric project identity resolves the owning
directory. No arbitrary output path is accepted. The source folder being audited
or developed is never a request destination. A missing or unknown project is an
error for project scope, not a reason to save globally.

The shared server on port 52814 was observed with PID 25576. Its configured home,
reported by the deployment owner earlier in this task, is the repository's
`C:\Users\pixelcommander\Desktop\RRAABBIITT_v0.9.3\.rab`. This change preserves that
override; it does not switch the server to `%USERPROFILE%\.rab` or move records.

One actual legacy record was found at
`.rab/apps/1830000000022/requests/1830000000068/settings.json`. Existing global
records remain readable and unchanged. An uncertain retry of an already saved
legacy submission returns that original record. New requests never use the old
app request directory. Migration is not part of this change.

## Owners and behavior

- `bridge/rab-memory.mjs` remains the single request writer. It owns scope
  validation, registered-project lookup, contained paths, identity allocation,
  per-scope locking, scoped retry reservations and compatibility reads.
- `bridge/service.mjs`, `server.mjs`, and the existing create/list/read request
  tools pass `scope` and optional `project_id` through that owner. Their existing
  identities and shared runner stay in use; no registries were regenerated.
- `magic-box/index.html` adds the scope selector and exact destination display.
  Project requests use the top project selector. Without a selected project,
  project scope disables Save and explains the missing selection.
- Pending retries pin the destination and submitted fields. Changing project
  selection cannot redirect an uncertain submission. Scoped listing and detail
  responses discard stale results from a previous selection.
- Request payloads retain the shared node shape, with `scope` and an owning
  `project_id` for project requests. Responses add `settings_path`. Retry
  reservations are inside the destination's `.submissions/` directory.
- The storage guide and historical feature/tool request logs now direct new
  requests to this owner. Historical entries were not rewritten or migrated.

## Verification

41 distinct focused tests passed: 7 request-scope tests, 6 fresh-workspace tests,
and 28 workspace UI tests. The first combined run passed 39; the UI suite passed
28 after adding two more scope tests. Syntax checks passed for memory, service
and server modules. The full repository suite was not run for this change.

Coverage includes real HTTP routes, public Tool House calls, exact save paths,
cross-project isolation, malformed identities/output overrides, concurrent
retries, changed-payload conflicts, legacy reads/retries, symlink containment,
noninitializing reads, pending scope binding and stale UI response rejection.

Browser verification used an isolated server on port 53589 with home
`C:\Users\pixelcommander\.rab\temp\test\1789987782741\preview-home`:

- Global save worked without selecting a project and wrote request 1830100001005
  in `feature-requests/`.
- Project scope without a project disabled Save.
- Selecting `Request preview` enabled project saving and wrote request
  1830100001007 inside `projects/Request preview/feature-requests/`.
- Switching back to Global / shared showed only the shared request.
- The form displayed the actual destination and returned saved file path.
- Disk inspection confirmed both files and their owning scope/parent. The
  disposable source folder still contained only its original `settings.json`.

Only disposable preview records were created. No live request was submitted.
The preview tab and process were closed after verification.

## Deployment boundary

The source implementation is complete. The shared backend still needs to load
the updated modules. The other task reported its shared-server restart was
blocked by environment policy; this task did not retry or work around it. No
shared service was stopped, restarted or reconfigured here. The isolated preview
verified this implementation, not deployment to the running shared backend.
