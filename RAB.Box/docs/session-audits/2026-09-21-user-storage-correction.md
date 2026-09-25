# User-home storage correction

The user's rule is explicit: all Box-owned saved data belongs under
`C:\Users\pixelcommander\.rab`. Actual source work belongs in the selected
project, such as `C:\magic\box-result-viewer`.

## Cause and ownership

Activate rraabbiitt copied a former preview home to the Box installation on
Desktop and hardcoded `path.join(defaultRoot, '.rab')` in `server.mjs`. That
task subsequently confirmed there was no explicit user authorization for the
Desktop destination. Inspect RRAABBIITT v0.9.3 preserved that location during
the disabled-field restart instead of resolving the conflicting instruction.
This was a coordination and implementation failure, not a user requirement.

## Corrected behavior

- The standard launcher resolves the user's home through the memory owner and
  ignores stale preview environment overrides. It never saves beside the code.
- New Workbench runs use the existing project memory directory's
  `runs/workbench/<run-id>/run.json`. Legacy installation runs are read-only.
  The actual installation had no saved legacy run directories at cutover.
- The handshake identifies its storage home. A tab clears cached project and
  session selections when that home is different or previously unknown, so a
  bare ID cannot silently reopen an unrelated record after a home change.
- New IDs are actual observed `Date.now()` numbers with exact reservations.
  Future catalog IDs no longer push runtime IDs into a synthetic counter.

## Preserved data and mappings

Recovery directory:
`C:\Users\pixelcommander\.rab\backups\1789993051557`.

The original 59 files were copied and SHA-256 verified before applying 47
planned writes. An independent review recomputed source, staged and destination
hashes. The only existing file replaced by that import was the project-root
registry; its prior bytes are retained. Ledger conversion has its own backup.

- Project `1830000000063` remains box-result-viewer, with source unchanged at
  `C:\magic\box-result-viewer`. Its memory is now `projects/box-result-viewer`.
- Its session `1830000000065` conflicted with an older test session. The imported
  session is now `1789993051575`; session-qualified files and structured links
  were remapped. Revision 15, 11 turns, 4 groups and 5 steps were preserved.
  All original turn text/reply pairs were checked for equality. The unrelated
  original test session remains available under its existing project.
- The imported Mock project's history was associated with the existing Mock
  project `1830000000785`, rather than registering the same source twice.
- Preparation panel demo's owned source was rebased into the user home.
- Request `1830000000068`, "Audit stamps for dups", is readable at
  `.rab/feature-requests/1830000000068/settings.json`.

Historical origin coordinates, before-history-repair files, snapshots and prose
were preserved. `plan.json` gives the mappings; `original/` preserves exact
source bytes. The old Desktop and AppData preview `.rab` directories were moved
to `retired-desktop-home/` and `retired-preview-home/` in the recovery directory.
Neither former location remains an active or present storage directory.

The ledger inventory read 7,197 current JSON/JSONL files and 52 source files one
at a time, finding 906 known IDs plus the recorded legacy boundary. Its v1
backup is retained. The old schema did not record unmaterialized reservations;
that information cannot be reconstructed and is explicitly recorded as a
limitation, not silently invented.

## Verification

- Migration/startup/tab-context checks: 7 passed.
- Allocator/node/session-directory checks: 23 passed (Activate rraabbiitt).
- Workbench/server checks: 26 passed (Review audit stamps).
- Live API and browser resumed the preserved 11-turn session and displayed
  `C:\Users\pixelcommander\.rab\projects\box-result-viewer` as Local memory.
- One normal Box listener remains on port 52814. The old Box listeners on
  49415 and 60899 were stopped. Other applications were left alone.
- Full suite: 676 passed, 0 failed, 0 skipped, in 279,148.5296 ms.
  Log: `.rab/temp/test/1789993540634/full-test.log`. Its process-local
  TEMP/TMP/RAB_HOME were isolated beneath that test directory. The normal
  project-root registry was unchanged before and after the run.
- Saved-session inventory: 254 records, 254 unique numeric IDs, no duplicates
  or invalid IDs. Receipt: `backups/1789993051557/session-id-uniqueness.json`.
- The two conflicting sessions were originally created more than ten hours
  apart (2026-09-20T22:29:35.403Z and 2026-09-21T08:48:05.090Z). Independent
  counters and split stores caused the duplication, not simultaneous user input.

First attempts retained separately: the new launcher test initially missed
creating its fixture parent (fixed test setup); the first recovery dry run
exposed a Windows short/long temp-path alias mismatch (fixed before applying
any live records). The Workbench lane's initial fixture cleanup used the wrong
filesystem removal function; its corrected case passed. None are reported as
first-pass successes.

## Remaining boundaries

This recovery does not delete or hide the older test records already present
in the user project collection. Their provenance and cleanup require a separate
review. Existing unrelated legacy record formats are preserved. The recovery
transform was reviewed for this exact dataset; it is not a general-purpose
unreviewed numeric-ID replacement tool.
