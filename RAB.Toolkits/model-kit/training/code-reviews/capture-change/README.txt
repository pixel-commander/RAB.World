CAPTURE REVIEW CHANGES
======================
Use the parent run.mjs capture entry with --box and --session.
The session settings must link working_copy.path to a separate extracted working
folder. Neither the original ZIP nor the working folder belongs inside the session.

ONE FOCUSED EDIT
1. baseline: once, before the first edit, save every original working file by hash.
2. begin --round round-001 --reason "one focused correction": checks that the
   working copy still equals the last capture, then opens one change record.
3. Make that single correction in the working folder. Do not edit originals.
4. finish: save exact changed bytes, before/after references and a readable patch.
5. Save actual test commands/results in the change's completed/verification.json.
6. Save conversation turns and curate the round summary with supporting change IDs.

Add --source_turns '["turns/turn-001.json"]' to begin when those turns exist.
Add --renames '[{"from":"src/Old.ts","to":"src/New.ts"}]' to finish for a
reviewer-declared rename. Never infer a rename from similarity. Code splitting is
one change with all affected files; its reason explains the responsibility moved.

This is explicit capture, not an editor watcher: begin and finish must surround
EACH edit whose intermediate state should be retained. Several edits inside one
capture preserve only that capture's endpoints. One session may have one active
change at a time. status reports the active change. begin rejects uncaptured drift.
No code correctness, approval, or training eligibility is inferred from a hash.

STORAGE
session/evidence/objects/<sha256>: exact file bytes, stored once per distinct version.
session/evidence/baseline/: initial manifest and provenance.
session/evidence/state.json: current capture pointer and active change, not history.
round/changes/change-NNN/settings.json: begin reason, turns, identity, before manifest.
round/changes/change-NNN/completed/manifest.json: complete lightweight after map.
round/changes/change-NNN/completed/changes.json: only changed file before/after hashes.
round/changes/change-NNN/completed/change.patch: readable diff, binary capable.
round/changes/change-NNN/completed/verification.json: actual checks, initially not_tested.

Before/after entries contain sha256 and bytes; resolve a hash under the session's
 evidence/objects/ directory. Missing entries mean a created or deleted file.
Files retain exact bytes, including CRLF, Unicode and binary data. No ZIP is copied
per round and unchanged versions are not duplicated. Git scratch files are temporary
verification artifacts under user .rab/temp/test; durable review evidence stays in
the caller-selected training folder. Git must be installed for finish.

Scope is every regular file in working_copy, with no silent exclusions. Links,
unsafe paths, more than 4096 files or more than 32 MiB fail before a snapshot is
accepted. Keep installed dependencies outside this focused source working folder.
Empty directories and filesystem permissions are not code-content snapshots.

Incomplete writes retain evidence and report failure. A stale evidence/.lock after
a killed process requires inspection before removing it; do not guess or overwrite
records. Historical evidence is never automatically imported as training material.

TRAINING UNIT
Default to a coherent code block plus enough context to understand the correction.
Use one file when appropriate; include multiple files when the lesson is splitting
or shared ownership. Whole-file snapshots are evidence, not mandatory prompt payloads.
The round summary selects relevant blocks and explicit human-approved outcomes for
later SFT examples. Rejected attempts remain evidence, never automatic SFT targets.
