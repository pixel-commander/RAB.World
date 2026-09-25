CODE REVIEW TOOLS
=================

Open Toolbox, search code-review, and choose Review Proposed Code or one group.
The form is generated from each tool's settings.json by the existing Toolbox.
Select a project/session on Projects before running through the UI.

tools/code-review/            Review Proposed Code: all or selected groups
tools/code-review/guards/     Existing bag-guards and prop-renames
tools/code-review/grids/      Existing grid-continuity
tools/code-review/atoms/      Existing css-tokens and css-states
tools/code-review/conventions/ Exact plural collection to singular map item
tools/code-review/write/      Review and Write New File

INPUT
  file: project-relative intended path, including its real extension.
  code: exact proposed source, pasted into the textarea.
  css: optional supporting CSS for class-based grid/flex layout in JSX.
  checks: parent/writer only. Omit for all; or ["guards","grids"], ["atoms"].
  confirm: writer only. Must be true; defaults to false.

EXAMPLE
  file: src/labels.ts
  code: const labels = items.map(item => item.label);
  Result: failed, three findings from the current bag checker.

  code: const labels = items?.map(item => item?.label ?? "");
  Result: passed for the applicable selected checks.

RESULTS AND LIMITS
  Runner completed means the tool executed. result.passed is the review verdict.
  The parent finds read-only code-review children by their existing meta.group,
  runs the selected children in order through Tool House, and returns one verdict.
  Each child keeps its own execution ID, duration, verdict, and evidence link.
  checks: ["all"] selects every available review child and is the review-only
  default; a checks array can select one or several by group name. The writer
  always requires ["all"], regardless of the caller. New children must accept the same
  submission fields and return the same code-review/v1 verdict shape.
  The legacy auditors can return status:ok with findings; this adapter uses their
  rows and verifies files_scanned/match counts instead of trusting that status.
  Inapplicable checks are skipped, never counted as passing checks. Zero applicable
  checks means passed:false. Findings from selected checks block this writer.

  These are existing static patterns, not a compiler or complete code review.
  The bag checker recognizes particular map callbacks, not every property access.
  Grid checks accept JSX/TSX and use explicit layout hints plus supplied CSS.
  They do not resolve the project's imports or automatically read its styles.
  Atoms checks accept CSS; token-definition folders retain existing exemptions.
  Rules are the current installed auditors, not dynamically interpreted RULES.txt.
  The code is never imported/evaluated. A pass is not proof of safe or correct code.

EVIDENCE
  Each group saves source and results under the memory owner's
  <RAB_HOME>/temp/test/<numeric-id>/ directory (default user-home/.rab).
  The parent saves an aggregate report with child report references.
  settings.json uses the house keys; source/ keeps the intended relative path.
  Code/CSS hashes, findings, checker execution IDs and durations are retained.
  Staged file hashes are verified after checking. Evidence is not auto-deleted.
  The runner separately retains the usual project execution records and, for
  audit projects, its usual top-level report. Parent results omit shared task
  objects so nested execution does not produce circular JSON.

WRITE
  Review and Write New File reruns all installed reviews on the current code,
  requires at least one applicable check and zero findings, matches the content
  hash, then calls the existing shared artifact writer. Only a new file inside
  the selected project can be created. Existing files, path escapes, alternate
  streams and symlink/junction paths are refused. Written bytes are verified.
  Supporting CSS is context only and is not written into the destination.
  This is an opt-in reviewed writer. Other tools and external editors are not
  automatically intercepted. Replacement/patch workflows remain future work.

RUNTIME
  The shared runner needs runScratchTool (bridge/tool-scratch.mjs). An older
  running backend reports RUNNER_UPDATE_REQUIRED until restarted. Refreshing
  the browser only refreshes the catalog, not the server's imported runner.

AUTHORING
  These tools were scaffolded with base/stamp-new-tool in isolated staging.
  The numeric scaffold receipt is in docs/session-audits/. The one-segment
  code-review parent has one explicit PATHS address; children use full paths.
  See docs/help/tools/toolbox/README.txt for the shared authoring method.
