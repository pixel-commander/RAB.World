# Shared preparation and temporary input panel

Recorded 2026-09-20 in the Magic Box project. This is a development checklist,
not audit output and not a tool registry.

## Completed first slice

- [x] Derive a temporary requirements view from the current session's Tool
  declarations, bound values, value sources, and pending questions.
- [x] Render that view in Chat's right column. Keep questions visible, collapse
  known inputs, and retain access to history and project settings.
- [x] Use narrow HouseKeys-compatible handlers: `handleSubmit(data?, type?)`,
  `handleCancel(data?, type?)`, and `handleClick(data?, type?)`.
  The submit owner narrows data to `Record<string, unknown>`.
- [x] Accept typed, partial answers for multiple Steps through one endpoint.
  Validate every supplied value before saving any answer; reject stale revisions.
- [x] Save answers without executing, including when YOLO is enabled.
  Keep explicit Run separate. Cancel uses the existing `nevermind` flow.
- [x] Show compact receipt locations/timing and failure/interruption summaries.

## Remaining shared-runner work

- [ ] Give Chat, manual Workbench, and folder batches one reusable preparation
  owner. This slice projects Chat's existing planner; it does not replace all
  preparation implementations.
- [ ] Represent general result-to-input dependencies explicitly, e.g. an
  `index_id` produced by an earlier Step. Keep a missing human answer distinct
  from a value waiting for a producer. Do not invent a value or ask the user
  for a value the plan itself will generate.
- [ ] Enumerate declared helper/composite requirements before execution where
  possible. Dynamic `settings.try` children still resolve at execution time.
- [ ] Surface the folder batch's missing-field details, including selected
  child-tool options, instead of its current generic `INPUT_REQUIRED` message.
- [ ] Expose tool-specific value constraints in reusable declarations or a
  pure validator. Required/type/enum checks do not currently catch every rule
  inside an executor (e.g. a React component's identifier format).
- [ ] Make project creation/loading eligible for the generic form only through
  its existing conversation owner. Those actions currently remain Chat-guided.
- [ ] Reload the shared Box server when coordinated. This work was verified on
  an isolated preview; the existing process on port 4318 was not restarted.

## Scope

The panel owns unsaved drafts only. Session Steps own accepted answers. Tool
settings own field declarations. Existing runner/memory owners retain execution,
tracking, and results. No audit report writer or saved-tool-count registry was
introduced. Cancelling a pending action does not cancel an already running
audit or undo completed work.

See [implementation and verification](../session-audits/2026-09-20-run-preparation-panel.md).

## Clarification: runner-driven fields as Chat develops — 2026-09-21

User clarification (paraphrase): The side column must interact with the Box
runner, which gathers the fields needed to execute as the chat input grows.
This also governs the proposed literal-code review input in TR-0006.

Current source distinction: typing in Chat calls the live tool finder only.
The requirements panel derives from accepted session Steps after submitted
turns; panel answers return through `/api/session/answer`. The full preparation
view does not yet refresh from an unsubmitted draft. General composite/child
requirements are still incomplete as listed above.

- [ ] Connect Chat's developing request to the shared preparation owner so the
  runner's selected tools, declared fields, supplied values and missing inputs
  drive the panel. Preserve declared defaults and project-path binding.
- [ ] If preparing while typing, use a debounced, non-executing draft preview.
  Do not save a turn, run input resolver tools or mutate accepted session state
  per keystroke. Reject stale preview responses when text/project/session changes.
- [ ] Reconcile supplied Chat values and panel answers against the same Step
  bindings; preserve drafts without silently overwriting conflicting values.
  Distinguish unknown human inputs from values awaiting an earlier tool result.
- [ ] Render literal-code fields from the selected tool's declarations. Pass
  code as its typed value, bypassing language normalization, through the same
  answer validation and execution flow. Code review uses this generic mechanism.
- [ ] Keep readiness separate from execution: collecting fields does not run
  the tool. Once required information and declared prerequisites are resolved,
  the existing authorized execution flow can run; cancellation uses the current
  flow owner. Do not advertise a complete dependency plan for undeclared needs.

These additions record the remaining intended behavior. They do not mark live
draft preparation or the code-review panel as implemented.

## Delivered form and history correction — 2026-09-21

The user requested visible, editable fields instead of the collapsed Known inputs
list, required labels, readable action replies, and a collapsed history entry
when an action completes or is canceled. This supersedes the earlier collapsed
known-input presentation; that earlier entry is retained as history.

- [x] Show all declared inputs in the active form, prefilled from the plan.
  Label Required/Optional and render multiline code as a textarea.
- [x] Allow supplied/default/optional values to be edited before execution,
  through the existing typed answer endpoint. Keep runner-owned and pending
  producer/helper fields locked, and completed/running work uneditable.
- [x] Validate all supplied edits before saving, refresh planned parent/child
  resources after renames, and disable Run until edited values are saved.
- [x] Use action names in Chat readiness messages rather than numeric group IDs.
- [x] Hide preparation and execution controls after terminal outcomes. Keep
  group history collapsed with Completed, Canceled or Errored labels, retaining
  individual outcomes, values, error detail and saved-report paths inside.
- [x] Number steps across the saved session instead of restarting for each group.

Full preparation while typing, general nested requirements, and the in-memory
review extension remain separate unfinished work. Implementation and validation:
[Editable preparation forms](../session-audits/2026-09-21-editable-preparation-forms.md).
