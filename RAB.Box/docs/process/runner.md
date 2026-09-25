# How the shared runner works

Source-reviewed: 2026-09-20, RRAABBIITT v0.9.3.
Canonical project: `C:\Users\pixelcommander\Desktop\RRAABBIITT_v0.9.3`.

This describes the current implementation, not a proposed architecture. The
runner is local Node.js code. Loading a script from a network share does not
make it execute on the server; execution stays on the machine running Node.

## 1. The short version

The runner takes a tool reference, supplied options and context. It resolves
the current tool, fills and validates its inputs, invokes its `run()` export,
tracks nested calls, collects returned seats, and records the outcome.

A stamp is a tool with a `template/` folder. It does not get a separate runner.
The runner does not automatically interpret a template or write generated files:
the stamp's implementation decides how to manufacture its output.

```text
Chat / session Turns        Workbench manual form        CLI
        |                           |                     |
session planner             ticket/input facade <---------+
        |                           |
        +------------+--------------+
                     |
       Tool House: resolve -> bind -> run -> track
                     |
              selected tool.run()
                     |
          helpers.runTool(child) --------+
                     ^                  |
                     +---- same runner -+
```

Programmatic callers can invoke the runner directly. That bypasses the UI's
confirmation layer; calling `runTool()` is an execution request, not a preview.

## 2. Owners and boundaries

| Owner | Responsibility |
| --- | --- |
| `bridge/tool-house.mjs` | Catalog discovery, reference resolution, binding, execution, scoped child calls, task outcomes |
| `bridge/tool-workbench.mjs` | Prepare/resume/answer tickets; fingerprint contracts; turn missing inputs into questions; invoke the runner |
| `bridge/session-planner.mjs` | Interpret Turns, select capabilities, maintain steps and the bag, collect gaps, execute confirmed steps |
| `bridge/service.mjs` | Server-facing run/session actions, revisions, confirmation and in-process locks |
| `bridge/paths-registry.mjs` | House/project direct addresses and project overrides |
| `bridge/rab-memory.mjs` | Project memory, saved paths/facts, sessions, execution records and audit result storage |
| `bridge/tool-tracking.mjs` | Execution identity, compact values, result references and report packing |
| `bridge/usage-ledger.mjs` | Usage/outcome events |
| `tools/_stamp-engines.mjs` | Shared implementations used by several stamps |
| `tools/_artifact-plan.mjs` | Optional shared template rendering, guarded file creation and byte verification |
| `engine/index.mjs` | Public `createRunner` alias for `createToolHouse`, plus Workbench exports |
| `engine/cli.mjs` | Command-line facade over the same runner |

`flow-runtime.mjs` supplies transition helpers and a separate flow utility.
Do not confuse a transition record or `runFlow()` with the Tool House executor.

## 3. Discovery: what becomes a public tool?

The scanner walks the configured `toolsRoot` (normally `<root>/tools`). A
directory owning `settings.json` is a public-tool candidate. Ordinary helper
modules without that settings file are not public capabilities.

Discovery skips `template`, `node_modules`, `.git`, `.rab`, and directory links.
For each candidate it derives its tools-relative path, tags and first-segment
domain. For example, `react/count/hooks/use-effect` inherits those four tags.

Required top-level settings keys are:

```text
id, name, title, description, settings, meta
```

`name` must match the leaf folder; `settings` is an array of input declarations;
`meta` is an object. A permanent ID must remain stable when moving a tool.
Duplicate IDs in the scanned house catalog make all conflicting entries
unavailable, rather than silently choosing one.

Executor lookup starts at the leaf with `<leaf>.mjs`, then walks upward for the
nearest `<parent-folder>.mjs`. This lets related public leaves share one
implementation. The selected executor receives the selected leaf's `tool`
metadata, not a substituted parent contract.

Having `template/` classifies a candidate as a stamp and requires a `stamp-`
leaf prefix. A `stamp-*` leaf without a template is rejected. This classification
does not prove the implementation is complete or its output is correct.

Path-derived domain/operation/target meaning cannot be contradicted by explicit
metadata. Invalid entries are returned in `unavailable` with their error code.
The catalog is cached; `fresh: true` refreshes it, and successful tool execution
invalidates the cache. Executor imports include the executor file's modification
time. That is not a general hot-reload guarantee for imported helper modules.

## 4. Exact lookup versus search

`getTool(ref, { context })` supports three reference forms:

| Reference | Resolution |
| --- | --- |
| Numeric permanent ID | House catalog first; then registered project-local entries if a project is loaded |
| Tools-relative path, such as `react/stamp-new-component` | Direct house catalog lookup |
| Flat key, such as a registered `count-use-effect` | Resolve the merged house/project PATHS address |

Project overrides use `{ id, path }` entries. They must stay within the project,
including their resolved physical tool directory, and their settings ID must
match the registration. A flat address in both the stamps and tools maps is
ambiguous and rejected. A direct house path does not automatically select a
project override with a similar name.

`findTools()` is different: it ranks candidates using path tags, text and parsed
semantic seats. Domain filtering includes the requested domain plus `base`.
Search returns `authority: 0`; finding a likely tool does not execute it or
authorize its side effects. Exact binding/selection still has to follow.

## 5. The invocation contract

Illustrative direct call, from a module at the project root:

```js
import { createRunner } from './engine/index.mjs';

const runner = createRunner({ root: absoluteHouseProjectRoot });
const done = await runner.runTool({
  key: 'react/stamp-new-component',
  options: { name: 'Panel', location: absoluteComponentsDirectory },
  context: {
    rab_home: absoluteTrackingDirectory,
    project: { id: 'my-project', name: 'My project', root: absoluteProjectRoot }
  }
});
```

This example executes and writes a component. It is not a dry-run API.
`root` identifies this installed Tool House; `context.project.root` identifies
the project being worked on. They need not be the same folder.

Each executable exports:

```js
export const run = async ({ options, context, tool, root, toolsRoot, helpers }) => {
  // Validate tool-specific semantics, perform the work, return a result.
};
```

The runner rejects modules without `run()`. Retired `plan()` return contracts
are not implicitly adapted by the active runner.

## 6. Input filling: precedence and missing seats

The runner's effective sequence is:

1. Resolve saved result-reference values in supplied options, where project
   memory is available.
2. For empty inputs, consider the audit-folder rule, promoted bag seats, then
   saved project paths.
3. Bind declared settings and apply defaults only to `undefined` values.
4. For still-missing required inputs with `try`, invoke the named child tool.
5. Extract and explicitly bind the child value, then bind again.
6. If required inputs remain missing, throw `INPUT_REQUIRED` before invoking
   the selected tool's `run()`.

Here, an input eligible for filling is `undefined`, `null`, or a required empty
string. Explicit valid `false`, `0`, and optional `''` are not replaced. A
nonempty explicit option takes priority over saved bag/path values. Saved file
and folder paths are made absolute relative to the project when needed.

For audit projects, an absent `folder` uses the validated audit scan folder.
The audit root is checked before executing the root tool. Audit-folder validation
is not a universal path policy for every possible tool input.

`bindSettings()` rejects undeclared option names. It checks Boolean, finite
number, and declared text/path field types, plus membership in `field.enum`
when present. It is not a full schema validator: an `options` list alone is
not the same as an enforced enum, and nested object shapes need their own
validation. Tool-specific validators still own names, ranges, allowed paths,
cross-field rules and other semantics.

Workbench preparation calls binding, not the full runner. Its initial questions
can therefore appear before runner-only path recovery or `try` resolution occurs.
Do not assume preview and execution do identical amounts of work.

## 7. Two ways to resolve missing inputs

### A. Declarative `try` child

A required setting can name a tool in its `try` field. The runner calls that
tool, forwarding only inputs declared by the child. It then looks for a value
in this order:

1. `provided.seats[missingName]`
2. `provided.value`, `provided.path`, or `provided.file`
3. A matching `continuation.seat` and its `value`
4. A same-named result field, then `path`, then `file`

The value is rebound to the parent's missing input and validated again. Prefer
an explicit `provided.seats` contract over relying on generic path fallbacks.
`try` performs actual execution, so use appropriate resolver children; it is
not automatically read-only merely because it fills an input.

### B. A tool discovers a conditional requirement

For example, a component stamp with `ensure_atoms: true` may discover that an
atom is missing and need `background_token` before creating anything.

```js
throw Object.assign(new Error('A background token is needed.'), {
  code: 'INPUT_REQUIRED',
  details: {
    safe_to_resume: true,
    missing: [{
      name: 'background_token',
      type: 'text',
      title: 'Background Token',
      description: 'Which registered token should the missing atom use?'
    }]
  }
});
```

Workbench checks that dynamic questions name declared settings. It keeps the
same ticket, records `runtimeMissing`, accepts answers for pending seats only,
and revalidates. Turns similarly keep the pending step and its input gaps.

Set `safe_to_resume` only before mutation. The runner revokes it when another
completed task in the shared trace has authority other than the literal `read`.
This is deliberately conservative, but it cannot detect arbitrary writes made
inside a tool or wrongly declared authority. It is not transaction rollback.

Answering and executing again starts another execution attempt with a new
execution ID. It does not resume a suspended JavaScript stack. Tool authors must
keep pre-question work safe to repeat and inspect partial failures before retrying.

## 8. Nested calls and bag ownership

Use the provided helper instead of directly importing another tool's executor:

```js
const child = await helpers.runTool({
  key: 'css/stamp-new-atom',
  options: { name: 'container-panel', token: '--surface-main' }
});
const childResult = child.result;
```

The helper preserves the shared trace, parent execution/task links, tracking
session and seat state. The child goes through the same lookup, binding,
validation and tracking lifecycle. Children can call children in turn.

Seat state has promoted run-level values and task-local values. Local values
take precedence when a tool calls `helpers.getSeat(name)`. A child's local
values do not indiscriminately overwrite its parent's bag.

`helpers.fillSeat(name, value)` fills the current task; root-task promotions
become shared on successful completion. Explicit `try` return binding is the
bridge from a resolver child's returned value into the parent. Root result
`provided.seats` and `continuation` values can also be promoted. Ordinary
result fields are not all automatically turned into bag seats.

Other helpers expose tool listing/search/lookup/binding and project fact
load/get/set. Persisting a fact requires project context. Internal `__rab_*`
fields are runner plumbing, not a tool-author API.

No general recursion limit, cancellation protocol, or cross-process scheduler
is enforced here. Avoid recursive resolver cycles and unbounded child fan-out.

## 9. Execution lifecycle and return envelope

Every invocation creates a task and a UUID execution record before lookup.
The runner loads project tracking context, identifies the tool, binds inputs,
imports its executor, and awaits `run()`. On success it packs returned seats,
builds a before/returned/after transition, and returns an envelope including:

```text
tool, options, result, seats, authority, transition,
tasks, execution, session_id, tracking_file
```

`result_file` is present when an audit report was saved. `result` is the tool's
own output; `tasks` contains the shared parent/child trace; `execution` describes
this invocation. Do not mistake the tool's payload for the entire envelope.

A returned object, even one containing a domain-specific error/status property,
does not automatically fail the runner. The normal path is completed when
`run()` returns without throwing. A tool must throw when execution should fail,
and consumers must inspect domain findings separately. Likewise, planner
completion/verification events are not proof that generated software builds.

Errors with `INPUT_REQUIRED`, `AUDIT_PATH_REQUIRED`, `DENIED`, or `PLAN_GAPS`
mark the execution blocked; other thrown errors mark it failed. The original
error is rethrown with execution/tracking references. Finalization records end
time, duration and outcome events even on failure, provided persistence succeeds.
A tracking-storage failure itself can reject the call; successful disk mutation
does not guarantee successful receipt persistence.

## 10. Tracking, reports and receipts are different things

| Record | Purpose |
| --- | --- |
| Execution tracking | Who ran, parent link, inputs summary, timing, status, result pointer/error |
| Audit report | Actual audit findings and child results, with shared object references packed once |
| Workbench/session receipt | Outcome presented to the caller; binds the request/step to execution and artifacts |
| Usage events | Start, use, terminal and loss events for aggregate diagnostics |

With project context, execution records live under the selected `.rab` project:
`runs/<session-id>/<execution-id>.json`. Options exceeding the compact-value
limit (normally 2048 serialized bytes) become size/hash summaries. This is size
management, not secret redaction; do not put credentials into ordinary seats
assuming they will be hidden.

Automatic full result reports are currently saved for read-authority tools in
audit projects, under configured `paths.results` (default `audit-results`),
grouped by session. Large/object returned seats can become result references;
later calls resolve those pointers instead of duplicating whole reports.

Ordinary write stamps do not automatically receive the same audit-report file.
Their receipts and generated artifact verification are separate. Without a
project context, the runner still returns an in-memory task trace but does not
set up this project-based persistence.

## 11. Confirmation and replay boundaries

Workbench tickets contain project identity, capability, options and a source
fingerprint. Resume/answer/execute validate the ticket version, project and
fingerprint. The fingerprint covers settings, executor, template, assets and
the two shared stamp helpers; it is not a lock on every transitive dependency
or external input. A hash is not a signed authorization token.

The server service requires a ready request and `confirm: true`, checks the
revision, locks the run while updating, and saves running state before execution.
Completed/failed terminal runs cannot simply be executed again. A saved running
record without its live lock is treated as interrupted and requires inspection.
These locks are in-process, not a distributed lock across multiple servers.

Turns have their own session lock and execution-confirmation path. The CLI
requires `--execute`; direct `runTool()` does not ask for confirmation. The CLI
is not a durable exactly-once queue. Never assume a direct call is replay-safe.

Authority metadata is descriptive and feeds reporting/flow behavior. It is not
an operating-system sandbox. Tools run trusted JavaScript with the permissions
of the Node process. Discovery validation cannot prove that a tool declared
`read` will never write.

## 12. File-producing stamps and output verification

Migrated project/component/page/atom builders use `writeArtifactPlan()`. Other
tools may use different write helpers; these guarantees are not automatically
applied to every tool merely because it uses the shared runner.

The artifact helper:

- Resolves the destination and rejects existing symlink/junction ancestors.
- Checks containment in the supplied allowed root.
- Accepts 1–4096 relative file entries, with a 32 MiB aggregate payload limit.
- Rejects traversal, case-insensitive duplicate paths, file/parent collisions,
  malformed base64, and ambiguous text-plus-base64 entries.
- Preflights existing targets and creates files exclusively (`wx`).
- Reads emitted files back and compares their SHA-256 hashes to planned bytes.
- Reports destination and written files on a partial failure; it does not roll back.

The stamp chooses the allowed root, so this is not a global workspace sandbox.
Byte verification does not replace typechecking, a build, tests, accessibility
checks, or inspection of intended behavior. It also is not protection against
all concurrent filesystem races from another process.

## 13. Checklist for adding a tool or modifying a stamp

1. Read `tools/README.txt` and applicable project rules. Pick the canonical
   domain/path and reuse the existing mold rather than introducing a new runner.
2. Assign a unique permanent ID once; keep it during moves. Match settings.name
   to the leaf and describe the inputs/returns accurately.
3. Declare defaults, required seats and input types; validate semantics in code.
4. Export `run()`. Compose through `helpers.runTool()` when invoking a capability;
   share non-public implementation functions where appropriate.
5. Ask conditional questions before writing. Distinguish safe retries from
   partial execution. Do not silently supply invented answers.
6. Return useful evidence and explicit seats; declare authority truthfully.
7. Test discovery, malformed inputs, absent inputs, false/zero/empty values,
   child traces, errors, overwrite protection and actual output destinations.
8. For stamps, generate a fresh example, inspect its contents, then build/test
   the output when applicable. A catalog entry or successful exit is insufficient.
9. Check Workbench/Turns behavior as well as direct execution. Document any
   limits instead of extending claims beyond the checks performed.

## 14. Current references

### Selected-folder batch audits (2026-09-20)

The existing `audit/run/folder-index` tool accepts optional `folder_paths`
(JSON array). For example, supply `index_id` and
`folder_paths: ["src/components", "src/pages"]`. Paths are relative to that
saved index's source root; `"."` selects only the root. Windows separators are
normalized to `/`, but names otherwise match the index exactly.

- Omit `folder_paths` to retain whole-index behavior. An empty array or null
  is rejected, never interpreted as "audit everything".
- Selection is bounded to 1000 entries and 16 KiB encoded input; duplicates
  are collapsed. Absolute paths, traversal and unknown index paths fail before
  a batch or worker is created.
- Validation streams saved index records, not the source directory tree.
  Execution follows index order, not selection order. Parent selection never
  implicitly includes children; selecting both runs each direct folder once.
- Only declared `direct-folder`, read/pure tools are eligible. The worker uses
  the shared Tool House runner and rechecks the source path. Deleted/unsafe
  folders fail explicitly; indexed exclusions remain skipped. A saved index
  is not proof of current filesystem freshness.
- Selected paths are retained in the batch descriptor's `meta.folder_paths`.
  Existing progress, per-folder execution IDs, bounded results, cancellation
  and timeout handling are unchanged. Selection preflight has its own timeout
  bounded by `max_duration_ms`; execution has the existing batch timeout.

The Toolbox's schema-driven form exposes this JSON input. A future checkbox
picker can submit the same field using paths from paged index records. This
change does not add that picker, watchers, descriptions, or a new runner.

- [Tool House contract](../../tools/README.txt)
- [Runner implementation](../../bridge/tool-house.mjs)
- [Workbench tickets](../../bridge/tool-workbench.mjs)
- [Session planner](../../bridge/session-planner.mjs)
- [Service confirmation and revisions](../../bridge/service.mjs)
- [Tracking/storage contract](../../AUDIT_TRACKING.txt)
- [Artifact writer](../../tools/_artifact-plan.mjs)
- [Migration decisions and verification](../session-audits/2026-09-20-shared-stamp-runner.md)
- [Migration behavior tests](../../tests/stamp-migration.test.mjs)

Historical `plan()` implementations remain under test/reference fixtures, not
as a second active stamp execution route. Re-check this document against the
owners above whenever those contracts change.
