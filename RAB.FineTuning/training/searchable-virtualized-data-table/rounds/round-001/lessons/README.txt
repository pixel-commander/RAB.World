REVIEWED LESSON CANDIDATES
=========================
Fill copies of ../lesson.template.json and ../lesson-review.template.json here.
Use a stable lowercase letters/digits/hyphens lesson ID as the lesson filename.
Keep the associated metadata in <id>.review.json. Both begin as drafts.
Do not export this directory by wildcard: select explicitly approved lesson files,
validate their schema/hash, and exclude *.review.json and all *.template.json.
Blank templates, raw turns, histories and held-out evaluations are never SFT targets.
The canonical lesson format is teaching-format-v1, already used by rraabbiitt-v2.

selected_blocks entries in the review sidecar have:
  source_change: relative path to the change record
  file: source-relative filename
  side: before or after
  sha256: exact file version in the session evidence store
  start_line/end_line: inclusive one-based lines for UTF-8 text
These locate source evidence. The canonical lesson messages contain the actual
selected text and enough surrounding context; they are not machine-path references.
For binary files use the change evidence, not pretend text line selections.
source_turns and source_changes retain provenance; reinforces contains lesson IDs.

Behavior checks describe setup, inputs, expected outcome, executable checker when
one exists, and its evidence. Reviewer rubrics describe criteria and pass/fail/unknown
conditions. No file here automatically approves a lesson or executes a check.
Read the session PROCESS.txt before curating or exporting.
