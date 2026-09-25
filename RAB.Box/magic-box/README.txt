ONE-FILE OPERATOR UI
====================

index.html contains all browser HTML, CSS and JavaScript. No external assets,
frameworks, fonts, package installs, CSS Flexbox, or minmax tracks are used.
CSS values are centralized as :root tokens. Functions in the client are arrows.
Explanations live here, not in code comments.

URL query parameters hold view and run selection.
Toolbox sits beside Chat and opens with ?view=toolbox. Its header-main and
nested side-left grids start from html/add/grid/stamp-new. The list column is
auto, the details column is 1fr, and both areas scroll independently. Tool names
retain max-content minimum width inside the scrolling list. Narrow windows cap
the left scroll area so details remain reachable without changing the topology.
Search filters the shared catalog as you type. Enter and Search only reapply that
filter; they do not navigate, submit a turn, bind inputs, or execute a Tool.
Selecting an entry opens Fields and Details tabs. Fields uses the existing shared
field controls and executes through /api/tools/run only when Run tool is submitted.
It uses the current session, or restores this window's saved session on submission;
if neither exists, select a project/session on Projects first. Browsing does not
initialize project storage. The runner resolves defaults and missing inputs.
Write tools really write files; the authority notice precedes execution. Results or
errors appear below the form as escaped JSON and remain when switching tabs.
Details retains description, declared inputs/defaults, contract, metadata,
inherited semantics, file locations, and full catalog record. Tabs support arrow
keys, Home, and End. Unavailable tools have details but no executable form.
Audit entries also show a compact result shape, followed by expandable saved-report
and separate tracking shapes and their project-relative path patterns. These are
documentation, not actual results, sample findings, or runtime schema validation.
Optional fields use ?, arrays show one item shape, and ChildResult refers to the
corresponding child tool. Project creation shows its returned result and settings
file instead because write stamps do not receive an audit-result report.
The shared documentation owner is tools/audit/_output-shapes.mjs. After changing it,
run node scripts/sync-toolbox-output-shapes.mjs to embed it in this one-file UI;
--check detects a stale embed. Tests check catalog coverage and compare shapes to
real scanner results and reports from disposable fixtures. Browsing never runs a
scanner or opens saved results. Empty returns metadata is labeled Not declared.
Toolbox is independent of project settings. A direct Toolbox visit performs only
the server handshake and the existing /api/tools read. It does not create or load
a project/session, resolve project defaults, inspect settings, or load history.
The shared catalog loader also supplies Workbench; Toolbox selection is separate
from the runner selection. Opening Chat or Workbench resumes their normal flow.

The top navigation opens Chat, Workbench, and Language lab. Chat uses ?view=chat
and hides the workbench chrome. Conversation is on the left; live groups and steps
are on the right (stacked on narrow screens). Each message calls /api/turn through
the same submission helper as Workbench. Box bubbles report the local planner's
actual questions, gaps and readiness, not simulated answers or remote-model output.
Both views render the same server session with one shared group renderer; Chat
keeps seats and bound values inside expandable details. Project lifecycle turns use
the local resolver chain: intent -> contract questions -> explicit confirmation ->
create or load. Other stamp execution still uses Workbench confirmation.
Saved turns and project-resolver replies reload from the server session. Earlier
client-only simulated replies are not reconstructed as real history. Session groups
and steps persist on the server and reload for the browser's saved session.
Enter sends; Shift+Enter adds a newline. The input modes below belong to Workbench.

The Chat right column has Steps and Project tabs. Steps retains the live Tool Finder,
health summary, groups, and execution controls. Project shows the selected project's
name, default audit folder, storage paths, full settings.json, and current session.
Project settings are read from disk through the existing project inspection route
when the tab opens, on Refresh settings, after Box actions while the tab is open,
and when returning focus to Chat. Missing or invalid settings display an error;
the saved session snapshot is not presented as current disk settings. Tab selection
is remembered in the browser. Arrow keys, Home, and End navigate the tabs.

Start new project beside the Chat sidebar tabs begins the existing project
conversation with the Audit project type already selected. The Box asks for
the project name, then the existing folder to audit, and confirms before creating it.
base/stamp-new-project delegates to audit/stamp-new-project and the shared project
Stamp engine. The resulting .rab/projects/<project-key>/ folder owns settings.json,
PATHS.json, sessions, receipts, failures, telemetry, and audit-results. settings.json
stores the name, paths.folder (the absolute input folder), and paths.results.
Source files stay untouched. Drive roots and parent folders containing .rab are
allowed: .rab is excluded from scanning and remains the only audit output location.
A new session remembers the selected audit folder.
Chat and the Tool runner save completed read results through the same memory writer;
each report records the Tool, options, result, and execution trace. Composites save
one report containing their child results. Later turns ask for missing inputs.
New session and Clear Bag still create fresh conversations under the current project.

A single busy flag prevents concurrent UI submissions. The server additionally
uses revisions and per-run locks; a button state is not the authority boundary.

Turn Checker hides the left stamp sidebar and uses the full workspace width.
It is input-only diagnostics: requests contain text alone and use the shared
language dictionary and house Tool addresses. Project vocabulary, project PATHS,
session Bag, current target, and project settings do not enter a check. Opening
the checker directly performs only the server handshake; project/session loading
waits until another workspace view is opened. Checks do not execute or save work.
Each new check clears the previous result and evidence before sending the request.
Errors and empty results cannot retain the previous output. Teaching controls live
outside this diagnostic view; previously saved vocabulary remains intact.

Two input modes:
- Text uses the engine's existing bounded language parser.
- The manual form is generated from current stamp settings and sends the same
  canonical request type.
Required unanswered fields use the returned question and explicit stamp/key address.
Text answers have their own optional control; typed answers remain available.

Project creation requires an explicit yes plus name and full folder path. For audits
this is the existing input folder; other project types use a destination parent. Other
execution requires reviewing the ready result and clicking Execute & verify.
Output files are displayed as plain escaped text,
not evaluated or embedded as live HTML.

All project labels, questions, imported definitions and output code use textContent.
The HTTP server hashes the current inline script/style for its CSP. No inline event
attributes, remote CDN scripts, polling intervals, or remote models are used.

Draft localStorage is best-effort and tied to this browser origin/port. Changing
ports does not carry that browser draft. Prepared run state is kept on server disk.
The top Refresh world button is deliberate; every operation revalidates separately.

Opening the HTML via file:// shows a server-needed message; browser code cannot
silently bypass the Node bridge to execute filesystem operations.
