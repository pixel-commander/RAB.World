CODE REVIEW SESSION STAMP
=========================
Creates a new session from template/ through Box shared rendering and artifact-plan
helpers. Preserves tool identity assigned by base/stamp-new-stamp.

Inputs: folder (new absolute session path), original_source (existing separate
original directory), title (optional). Existing destinations are always refused.
Source files are referenced only. Paths through links/junctions and destinations
inside original source or this tool tree are refused. No source writes occur.
Returns folder, numeric ID, settings, verified file hashes and downstream seats.

Use the nested new-training-round stamp to add rounds. Both templates own their
respective shapes. No model training, export, or lesson approval happens here.

CLI entry: node run.mjs session --box <Box folder> --folder <new session path>
  --original_source <original source folder> [--title <title>]
CLI round: node run.mjs round --box <Box folder> --session <session folder>
  [--title <title>] [--focus <focus>]
Quote paths/titles containing spaces. run.mjs delegates to the existing Tool House
runner; it is not a separate execution engine. No services are required.
This CLI scans the current toolkit source explicitly; live Box UI registration
and natural-language matching have not been changed or claimed.

For a source path owned by another machine, supply source_access at execution
time (CLI: --source_access <accessible share>). This explicit binding is never
saved into session settings; original_source.path retains the supplied drive path.
The caller is responsible for binding it to the corresponding source directory.

Capture entry: node run.mjs capture --box <Box folder> --session <session folder>
  --action baseline|begin|finish|status [--round round-001] [--reason <reason>]
Read capture-change/README.txt before editing. Original archives are never repeated
per round; exact file versions are stored once and linked into focused changes.

Training process: session template PROCESS.txt separates evidence, approved lessons,
held-out evaluation and press comparisons. Templates are not trainers or graders.
Round lesson candidates retain the existing teaching-format-v1 field contract.
