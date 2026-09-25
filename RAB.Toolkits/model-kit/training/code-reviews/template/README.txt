CODE REVIEW SESSION
===================
One folder holds one package-review session. settings.json identifies the session
and links original_source.path to the separate untouched original source folder.
The stamps never copy or modify that folder. The read-only label records policy;
it does not change filesystem permissions or prevent outside edits.

CONTENTS
settings.json: identity, source-folder reference, and the rounds contract.
rounds/: numbered review rounds, added using the nested new-training-round stamp.

Use new-training-round with this session folder. It creates round-001, round-002,
and so on, always above the existing maximum. It never overwrites an earlier round.
Each round links back here through ../../settings.json, so the original-source path
has one owner. Source paths are machine bindings, not portable teaching rules.

Keep the external original folder unchanged throughout the review. If you move it,
update original_source.path deliberately. The session stamp checks initial access; later round creation is entirely local.
Actual source edits belong in a separate working copy. Saved messages and code
blocks preserve each turn; they are not automatic snapshots of that working copy.

Save exact messages including code blocks in their original positions. Corrections
become new turns; do not rewrite earlier turns. Round summaries are derived records.
Only explicitly approved material can become training examples for future presses.
Raw evidence may include wrong answers and must not be trained on indiscriminately.
Model-specific exports are derivatives; they never replace these original records.

For a source path owned by another machine, supply source_access at execution
time (CLI: --source_access <accessible share>). This explicit binding is never
saved into session settings; original_source.path retains the supplied drive path.
The caller is responsible for binding it to the corresponding source directory.

CHANGE CAPTURE
Link working_copy.path to a separate working folder, then use capture-change
baseline once and begin/finish around every focused edit. No ZIP is copied per
round. The session evidence store saves each distinct file version once by hash.
A capture is not a watcher: intermediate edits require their own begin/finish.

TRAINING AND EVALUATION
Read PROCESS.txt. rounds/ holds evidence and draft lessons; evaluations/ holds
unseen cases; presses/ holds model/configuration/comparison records. Blank template
files are scaffolds only and must never be included in a training export.
