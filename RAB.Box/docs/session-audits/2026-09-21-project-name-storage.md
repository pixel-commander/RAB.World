# Project folders named for the project

User direction: the first directory under `.rab/projects` should be the project
name, for example `.rab/projects/magic/`. Numeric identity remains metadata.

## Implemented behavior

- New audit projects put their settings, sessions, tracking, indexes and results
  together in `.rab/projects/<project-name>/`.
- New development projects retain their selected source location. Their saved
  Box memory uses the same project name under `.rab/projects/`.
- The existing memory owner and `project-roots.json` own the mapping. `roots`
  still maps canonical source roots to numeric IDs; optional `directories`
  maps numeric IDs to directory names. No additional project registry was added.
- Project IDs, session parents, execution lineage, ID-based lookup and API URLs
  stay numeric. Sessions, indexes, batches and scratch folders keep their current
  numeric directory conventions.
- Valid folder names retain their spelling, spaces and case. Unsafe names are
  rejected with a name-field error. Existing names, including case-only clashes,
  cannot be overwritten. Project stamps check and reserve through the memory
  owner's registration lock before writing source artifacts.
- Registered numeric project directories remain readable in place. There is no
  automatic move of existing user folders, historical receipts or saved paths.
  Unsupported older string-ID record formats remain excluded.
- A read-only report inspection can resolve an unregistered app-owned folder
  without creating memory records. Missing allocator state cannot silently
  restart allocation when current named project descriptors exist.
- Registration preserves the exact generated settings bytes for a project whose
  source is its memory folder, including extension fields and artifact hashes.

## Owners changed

- `bridge/rab-memory.mjs`: name validation, ID/directory lookup, registration,
  discovery, read-only resolution and allocator-loss checks.
- `tools/_stamp-engines.mjs`: shared name validation and registration preflight
  around project artifact creation.
- `tools/audit/stamp-new-project/stamp-new-project.mjs`: named destination.
- `bridge/service.mjs`: saved Workbench history/list/file inspection does not
  enroll a copied source merely to initialize telemetry.
- Dedicated naming/lifecycle tests and fixtures; the current
  [workspace/storage guide](../vision/PROJECT_WORKSPACE_AND_FOLDER_RUNNER.md).

The quoted-path and project-type inference bugs are outside this change.

## Verification

The first focused run passed 55/58. Two failures were tests still requiring the
superseded duplicate-label/unsafe-label creation behavior. The third exposed a
real numeric-directory assumption in read-only report inspection. Those cases
were corrected while retaining historical duplicate-label lookup coverage.
The next regression run passed 25/25, including fresh-owner restoration,
concurrent naming collisions, current numeric-folder compatibility, junction
refusal, cross-process memory saves and allocator-state loss.

The separate CSS-filter and saved-investigation chain passed 7/7, including
declarations, approved writing, verification, handoff, and stale-source checks.
The full suite passed 623/626 on its first run. Two fixtures still supplied old
string project IDs inside app-owned source folders; they now use the allocator
and named-path API. One real failure was saved Workbench history inspection
trying to register a relocated copy through telemetry. Read/list/file inspection
now avoids that enrollment, with a registry-preservation assertion. The final
affected suite passed **43/43**, with no failures or skips, covering all three
initial failures plus naming, legacy numeric directories, HTTP/workspace behavior,
output contracts and the public folder-index/batch pipeline. The entire 626-test
suite was not repeated after those targeted fixes.

Logs:
- [First focused run](2026-09-21-project-name-focused-tests.txt)
- [Regression run](2026-09-21-project-name-regression-tests.txt)
- [Evidence chains](2026-09-21-project-name-evidence-tests.txt)
- [Full suite](2026-09-21-project-name-full-tests.txt)
- [Final affected suite](2026-09-21-project-name-final-tests.txt)

No existing user project was moved or rewritten. Verification uses disposable
homes; executed audit results remain there rather than in this docs directory.
No running backend has been restarted by this change. A backend must load the
updated modules before its new-project actions use named directories.

## Existing live preview memory: preserve

The user subsequently did real work in the former preparation-panel preview.
Its `RAB_HOME` is
`C:\Users\pixelcommander\AppData\Local\Temp\rab-panel-browser-C3DLO9\.rab`.
Read-only inspection on 2026-09-21 confirmed project `1830000000063`, name
`box-result-viewer`, source `C:\magic\box-result-viewer`, and saved sessions.
This particular old temporary home is now user data, not disposable test output.
This change neither moves it nor switches the running backend's home. Any future
home migration must preserve and reconcile its projects, sessions and receipts.

## Follow-up correction: whole-suite isolation was not established

Later on 2026-09-21, the coordinating task reported test-source registrations in
the normal user `.rab/projects`, including recent named entries. Therefore the
earlier statement that verification uses disposable homes is too broad: the
dedicated naming fixtures explicitly isolate their homes, but isolation of every
test in the broader suite was not established. Passing behavior checks do not
prove the absence of writes to normal user storage. The report's original
statement is retained above with this explicit qualification.

The coordinator also reported a same-source/different-ID conflict between the
preview and normal homes for Mock project. These findings are recorded in the
[storage-home and test-isolation follow-up](../todo/storage-home-and-test-isolation.md),
with provenance and the known IDs. No cleanup, migration or backend restart was
performed by this task in response to that handoff.
