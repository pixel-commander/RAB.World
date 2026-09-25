# Editable preparation forms and compact outcome history

Date: 2026-09-21. Task: Review audit stamps.
Project: `C:\Users\pixelcommander\Desktop\RRAABBIITT_v0.9.3`.

## Requested behavior and changes

The user reported that numeric group IDs in readiness messages were noise and
that the right-side panel hid the useful fields as text under Known inputs.
They also requested that completed/canceled forms disappear into collapsed
history, that step numbers continue across groups, and that supplied fields
remain editable when appropriate.

The active panel now shows prefilled declared fields, Required/Optional labels,
typed controls, and multiline textareas for code/JSON. Previously supplied and
optional values can be changed through the same structured answer endpoint,
including a ready action. False, zero and optional empty strings remain values.
Runner-owned fields and unresolved producer/helper dependencies remain locked.
No edit executes a tool; unsaved drafts disable Confirm & run.

The planner validates the full submitted answer batch before saving and
rebuilds unexecuted dependent steps. Obsolete unverified resources are removed
before rebuilding a renamed parent; completed/verified work is preserved.

Chat names the action and supplied name in its readiness response. Terminal
preparation forms and execution controls disappear. History contains a closed
disclosure per finished group, with session-wide step numbers and explicit
Completed/Canceled/Errored outcomes. Mixed outcomes and interruption remain
distinguishable, with original step detail retained inside. An execution error
refreshes the persisted session without automatically retrying the run.

## Changed production owners

- `magic-box/run-preparation.mjs`: visible fields, typed initial values, edit
  handling, textarea controls and terminal-panel cleanup.
- `bridge/run-preparation.mjs`: shared eligibility for editing Step inputs.
- `bridge/session-planner.mjs`: answer validation and unexecuted-plan rebuild.
- Narrow sections of `magic-box/index.html`: readiness reply, outcome history,
  session-wide numbering, terminal controls and error-state refresh.

The coordinator confirmed no active overlap. No project migration, registry
rebuild, stamp change or shared service restart was performed.

## Verification

Focused automated checks: **66 passed, 0 failed** across preparation UI (15),
workspace UI (26), preparation integration (10), and related session/planner/
builder regressions (15). The full repository suite was not run for this change.
Integration checks include actual generated component output after editing a
ready plan, preserved source, typed answers, parent rename propagation,
cancellation, stale revisions and refusal to edit completed work.

Tests explicitly set `RAB_HOME` and temporary-directory environment variables
under `C:\Users\pixelcommander\.rab\temp\test\1789985280685\`.
The browser preview used its own `preview-home` and `preview-source` under that
same test run, with an ephemeral server at port 61503. Its setup script is
`preview.mjs` there. These are test-only records; no real project was activated
or modified for verification.

Browser observations: all six New Component fields were visible, required fields
were labeled, changing the name disabled Run, saving updated the accepted form,
and cancellation removed both the form and YOLO controls. Closed history entries
retained Completed/Canceled labels and continuous step numbering. A fresh request
displayed “New Component ‘FreshPanel’ is ready” with no numeric group identifier.
The controlled existing-destination attempt returned `EEXIST`; the UI refreshed
the saved failure, removed the form/YOLO controls, and showed a closed
“Step 4: Errored” entry alongside the earlier completed/canceled entries.

The browser also exposed an existing language-resolution ambiguity when asking
to create a component whose name was already a known completed resource. That
request was canceled in the test session; changing a fresh action's name through
the form provides a controlled destination-collision test instead. No parser
change is included here.

## Deployment and remaining scope

HTML/module changes need a page reload; already-running backends need a
coordinated restart to load the new preparation/answer logic. The user's real
saved sessions are untouched. Full preparation while typing, general nested
requirements, persistence of every generated chat reply and review without
scratch source files remain separate work.

### Live deployment confirmation — 2026-09-21

The coordinator (Inspect RRAABBIITT v0.9.3) subsequently reported a restart
confirmed by the runtime owner: port 52814 changed from PID 25332 to PID 25576,
preserving the actual existing runtime home
`C:\Users\pixelcommander\Desktop\RRAABBIITT_v0.9.3\.rab`.
This is the verified home for that process, superseding assumptions based on
older previews; no storage consolidation was performed.

For session 1830000000065, revision 7, ready group 1830000000742 (IDEViewer),
the API changed from six `editable:false` fields to six `editable:true` fields.
The coordinator's browser check found all six controls enabled, Save answers
disabled until an edit, and Confirm & run enabled. The saved `state.json` hash
remained `A6E7C1876194BE23F77E5FD3DC143BDF9E211E53271B93FB9EF25B15900479B1`.
No tool execution or code change was required for that deployment. The existing
user tab needs a reload for the new token and data. These live observations are
attributed to the coordinator; this task verified its own isolated preview.
