TRAINING FROM PACKAGE REVIEWS
=============================

PURPOSE
-------
This folder holds code-review sessions that can become reusable training lessons
for future fine-tuning presses. One folder is one package-review session.
We review together, preserve exact evidence, approve focused lessons, and later
compare how different models perform before and after training.

Saving a review does not train a model. Captured code, a passing test, an accepted
implementation, and a lesson approved for training are separate states.

WHERE THE FILES BELONG
----------------------
training/: session records, turns, change evidence, lesson candidates, held-out
           evaluation definitions, and press records.
../sources/: original packages or ZIPs, kept untouched and referenced by a session.
../working/: separate working copies where the actual code edits happen.

Session settings.json owns original_source.path and working_copy.path. Read those
values instead of guessing a location. The session stamp takes an explicit output
folder, so other training destinations can use the same structure. Real training
records do not default to .rab; temporary tool verification files do live there.

Extract a package once into a separate working copy. Do not copy its ZIP into every
round. Capture saves each distinct file version once by hash and links changes to
those versions. The existing package baseline was captured before code edits.

INSIDE A SESSION
----------------
settings.json identifies the session and its source/working paths.
PROCESS.txt explains lesson curation, grading, held-out cases and press comparisons.
rounds/round-NNN/ holds one focused review round:
  settings.json: round identity, focus and parent session link.
  turns/: exact messages and code blocks, in order.
  changes/: individual before/after capture records and patches.
  summary.json: derived findings, lesson, supporting evidence and review state.
  lesson.template.json and lesson-review.template.json: blank lesson molds.
  lessons/: filled draft candidates and their review sidecars.
evidence/ holds the baseline, exact file versions and current capture pointer.
evaluations/ holds unseen validation/test cases, separate from training examples.
presses/ holds planned or completed model/configuration/comparison records.

Preserve original turns, code and rejected attempts. Corrections become new turns
and new changes; they do not rewrite the earlier evidence. Summary files are derived
interpretations and must link to the evidence supporting them.

TOOLS AND THEIR OWNER
---------------------
The tool source and reusable templates live outside this training data folder:
  C:\RAB.World\RAB.Toolkits\model-kit\training\code-reviews

The parent code-reviews tool stamps a named session from its template/ folder.
Its nested new-training-round tool stamps the next numbered round without replacing
an earlier round. Round numbering starts at round-001 and does not reuse gaps.
Its nested capture-change tool saves a baseline, opens a focused change before an
edit, and captures exact after versions and a patch when the edit is finished.

The entry point is run.mjs in that tool folder. It calls the existing Box Tool House
runner at C:\RAB.World\RAB.Box; it is not a separate runner. Node.js is required;
Git is required to produce change patches. No running model or service is required.
Live Box UI registration and natural-language matching are not claimed here.
Read the owning tool README.txt and capture-change/README.txt for current contracts.

POWERSHELL USAGE
----------------
Set these variables to the locations you intend to use:

$reviewTool = 'C:\RAB.World\RAB.Toolkits\model-kit\training\code-reviews\run.mjs'
$boxRoot = 'C:\RAB.World\RAB.Box'
$sessionFolder = 'C:\RAB.World\RAB.FineTuning\training\your-package-review'
$originalFolder = 'C:\RAB.World\RAB.FineTuning\sources\your-package'

Create a NEW session (existing destinations are refused):
node $reviewTool session --box $boxRoot --folder $sessionFolder --original_source $originalFolder

The session command initially validates an existing original directory. For an
archive-based review, preserve the ZIP, extract once, then explicitly record the
archive path/hash and separate working_copy.path in session settings before capture.
The session stamp itself does not extract archives or configure a working copy.
For server-native paths, optional --source_access supplies a temporary accessible
share binding; it does not replace the stored original-source reference.

Add a round:
node $reviewTool round --box $boxRoot --session $sessionFolder --title 'Review one responsibility'

Capture the baseline ONCE, after linking the separate working copy and before edits:
node $reviewTool capture --box $boxRoot --session $sessionFolder --action baseline

Before EACH discrete edit:
node $reviewTool capture --box $boxRoot --session $sessionFolder --action begin --round round-001 --reason 'Describe one specific correction'

Make the edit in working_copy.path, then immediately capture the result:
node $reviewTool capture --box $boxRoot --session $sessionFolder --action finish

Inspect capture state:
node $reviewTool capture --box $boxRoot --session $sessionFolder --action status

This is explicit capture, not an editor watcher. Several intermediate edits inside
one begin/finish preserve only the endpoints. Use a separate capture for each state
we need to retain. Only one change can be active in a session. Starting a new change
rejects uncaptured drift rather than silently accepting it.

A capture saves bytes and hashes; it does not run code tests. Record actual commands,
results and limitations in the change's completed/verification.json. Complete the
conversation turns and round summary as the review proceeds. Turn saving and lesson
curation are currently manual; there is no automatic transcript recorder.

FOCUSED TRAINING
----------------
Use one coherent lesson per example, often a code block with enough surrounding
context. A code-splitting lesson may need several files in the same example.
Whole-file snapshots provide evidence; they need not all enter the training prompt.
Keep explanations checkable: finding, rule, reason, correction and verification.

Fill copies of the round's lesson molds into lessons/. The canonical lesson retains
the existing teaching-format-v1 shape. Its review sidecar records selected blocks,
scope, boundaries, supporting changes and grading criteria. Do not export folders
by wildcard: blank templates, sidecars, raw histories and rejected answers are not
automatically valid SFT training examples. Explicit human approval is required.

Evaluate behavior and observable requirements, not merely expected keywords.
Keep unseen evaluation cases and near-duplicate task families out of training.
Compare each model against its own pre-press performance on the same held-out suite;
record improvements and regressions. Store model-specific formatting and training
settings in exports/press records rather than hardcoding them into durable lessons.

CURRENT BOUNDARY
----------------
The tools create sessions/rounds and capture file changes. The lesson, evaluation
and press files are preparation templates, not an implemented fine-tuning engine,
automatic grader, approval service or export compiler. PEFT/LoRA versus full tuning
is selected later for the chosen model and hardware. See each session's PROCESS.txt.
