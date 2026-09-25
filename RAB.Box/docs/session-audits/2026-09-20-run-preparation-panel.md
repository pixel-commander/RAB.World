# Temporary runner input panel

Date: 2026-09-20. Project: `C:\Users\pixelcommander\Desktop\RRAABBIITT_v0.9.3`.
This is a session development report. Executed audit results remain with the
existing `.rab` memory owner; they are not saved into this docs folder.

## Behavior

Chat's right column renders a `run-preparation/v1` view of the current action.
Tool declarations are captured with their planned Step; the view combines their
types, defaults already bound by the planner, choices, values, sources, and gaps.
Missing inputs stay visible; known inputs collapse. The UI handles text, numbers,
booleans, choices, and JSON. It preserves false/zero and explicit optional empty
text, validates edited fields, and retains drafts when a submission fails.

The receiver uses the narrow HouseKeys handler shape from
`C:\stand-alone-react\src\HouseKeys.types.ts`, declared locally without importing
React or depending on another project's runtime:

```ts
type HandlerKey<Data = unknown, Type extends string = string, Result = unknown> =
  (data?: Data, type?: Type) => Result;
// This panel's owner narrows Data to Record<string, unknown>.
handleSubmit({ answers: [{ step_id, values: { name: 'PanelExample' } }] }, 'session-inputs');
```

The component is transport-agnostic. The Magic Box owner submits to
`POST /api/session/answer` with `session_id`, required `expected_revision`, and
`answers`. Fields must address pending questions in the current action; unknown,
foreign, duplicate, stale, or already resolved targets are rejected. Every value
is validated before any answer or project-path setting is saved. Shared session
locking and optimistic revisions remain in force. Values do not get parsed as
chat commands. Answers are retained in the existing session/turn records.

Saving never runs tools, even with YOLO enabled. The existing explicit execute
route owns Run. The existing `nevermind` handler owns Cancel. Project setup stays
Chat-guided. Dependency/helper states are displayed as supplied by the planner;
this does not add a general dependency scheduler. Receipts are projected as
IDs, dates, duration, and file references, without copying their result payloads.

## Owners changed

- `bridge/run-preparation.mjs`: derived receiver view, compact receipt summary.
- `bridge/session-view.mjs`: includes the view in session responses.
- `bridge/session-planner.mjs`: stores input declarations with Steps and accepts
  validated structured answers; re-resolves pending Steps in order.
- `bridge/service.mjs`: locked, revision-checked answer operation.
- `server.mjs`: authenticated answer route and exact local module asset route.
- `magic-box/run-preparation.mjs`, `magic-box/HouseKeys.types.d.ts`,
  `magic-box/index.html`: reusable receiver, house vocabulary, Chat integration.
- Dedicated tests: `tests/run-preparation.test.mjs` and
  `tests/run-preparation-ui.test.mjs`.

The UI subagent owned only its receiver, local types, index integration, and UI
tests; the parent owned backend/schema, route, integration tests and this report.
The main Box process was not restarted and no other project's files were edited.

## Verification

Isolated fixtures cover multi-Step answers, partial saves, Chat/panel continuity,
false/zero/JSON preservation, defaults, enum UI decoding, cancellation, required
revision, foreign fields, atomic validation failure, rooted/escaping project
paths, no execution on submit, explicit later execution, receipt projection,
authenticated HTTP, and the module route. UI fixtures cover Enter submission,
stale detached forms, draft retention, busy/double-submit guards, safe text,
collapsed known inputs, and terminal state controls.

The first backend fixture incorrectly assumed `find class` asks for a class
name; it actually lists definitions. `add component` was also ambiguous in an
audit context. The fixture now uses `create component`. Its first execution used
a lowercase React name and correctly failed the executor's identifier rule;
the valid fixture uses `Sample`. A project-path test was adjusted to begin with
the setting absent, rather than removing a setting after it was already bound
in the session. These were fixture corrections, not ignored assertions.

The broader backend/session/server run produced 50 passes and one CSS contract
failure: the new UI initially used `minmax()`, which this Box's existing server
test forbids. The layout was changed to ordinary `1fr` tracks without weakening
the test. Its focused rerun passed. The final combined preparation/backend/UI
and existing workspace UI rerun passed **36/36**, with no failures or skips.
After trimming whitespace before checking rooted project paths, the focused
path validation test passed again. Syntax checks and the Toolbox output-shape
sync check also passed. The broader 51-test run's other 50 tests passed; the
entire broader suite was not repeated after the focused CSS correction.

The real browser preview used a separate server and disposable home:
`C:\Users\pixelcommander\AppData\Local\Temp\rab-panel-browser-C3DLO9`.
The browser loaded a saved pending action, accepted `PanelExample` using Enter,
displayed ready without execution, then completed the explicit Run. The generated
component and numeric timing receipt were inspected on disk; source `sample.css`
remained unchanged. A subsequent action queued two steps; the panel's Cancel
button submitted `nevermind` and the browser displayed both as cancelled. A
fresh, unexecuted form was left for preview. Only the isolated preview helper
was reloaded after final code edits, at `http://127.0.0.1:52814/?view=chat`.

The existing shared server on port 4318 still reports the earlier string-ID
session runtime. It was left alone under the shared-service coordination rule;
the new API requires a coordinated reload before use there.

## Follow-up

See [shared preparation checklist](../todo/run-preparation-and-input-panel.md)
for universal preparation, child requirements, declared value constraints, and
general result dependencies. This slice supplies the live UI receiver and
structured Chat input path; it does not claim those remaining items are done.
