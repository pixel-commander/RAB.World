# DETERMININTELLI / RRAABBIITT — CURRENT ARCHITECTURE

## 1. Core model

RRAABBIITT is a deterministic house/factory around Tools and Stamps. The model/LLM should spend intelligence on understanding and orchestration only where needed. Proven behavior should move into cheap deterministic machinery.

The recurring self-similar runtime law is:

```text
CURRENT
↓
CHILD
↑
RETURNED SHAPE + CURRENT
=
NEW CURRENT
```

This applies to folders, Tools, Steps, Stamps, Bag state, and generated products.

## 2. Tool House

Everything invokable is a **Tool**. A **Stamp** is a Tool that materializes a known shape from a `template/` folder.

Public capability folders may be arbitrarily deep. A public Tool owns `settings.json`.

Canonical indexed identity:

```js
{
  id: 1789501234567,
  path: 'react/count/hooks/custom',
  tags: ['react', 'count', 'hooks', 'custom'],
  script: 'count.mjs'
}
```

Meaning:

```text
id     = permanent identity
path   = current semantic/physical position
tags   = path-derived inherited meaning
script = current relative executable
```

A Tool may move. The ID must survive. Moving changes path/tags and therefore current semantic shape, but not historical identity.

### Path-tag law

> Path tags are inherited truth. Explicit metadata may add meaning, but must never contradict the path.

Path evidence is intended to be the heaviest deterministic Tool-discovery match.

Example:

```text
react/count/hooks/use-effect
```

implies at least:

```text
react
count
hooks
use-effect
```

A candidate that has one meaningful extra matching tag compared with otherwise average/tied candidates should win/propose. The user may confirm, deny, redirect, or add more evidence; the same Step remains alive.

### Many precise keys, few engines

Example:

```text
tools/react/count/
  count.mjs
  hooks/
    state-hooks/settings.json
    use-effect/settings.json
```

Both public leaves may inherit the nearest parent executor `count.mjs`.

Do not create implementation bloat just because the semantic catalog is rich.

## 3. PATHS.json

The filesystem remains deep for semantic inheritance. `PATHS.json` should be a **small flat direct address book**, not a nested filesystem mirror.

Preferred conceptual shape:

```js
{
  stamps: {
    'add-atom': {
      id: 1789501001,
      path: 'css/atoms/stamp-new-atom'
    },
    'new-chart': {
      id: 1789501003,
      path: 'react/charts/stamp-new-chart'
    }
  },

  tools: {
    'find-components': {
      id: 1789502001,
      path: 'react/find/components'
    },
    'count-state-hooks': {
      id: 1789502002,
      path: 'react/count/hooks/state-hooks'
    }
  }
}
```

The short key is the stable House address. Deep path supplies current semantics.

### Project override / hijack

The Box checks the loaded project's `PATHS.json` before falling back to its own House binding. A project may bind the same House key to a different ID/path.

Conceptually:

```text
HOUSE PATHS
+
PROJECT PATHS
=
EFFECTIVE PATHS FOR CURRENT BAG
```

This lets `add-atom` mean the same stable intention while a particular project supplies a project-specific Stamp.

Do not literally depend on object spread; the architectural law is broad/default knowledge packed first, local/project knowledge over it, immediate Step/Turn evidence strongest.

Keep provenance so an overridden House implementation is still inspectable as shadowed.

## 4. Bag / Turn / Step / Run / Project

Terminology:

```text
RUN   = whole working session
GROUP = one branch/context of related work
STEP  = one semantic unit/nest of work; may span many Turns
TURN  = one user submit/Enter; may contribute to one or more Steps
TASK  = one Tool/Stamp invocation inside a Step
```

Scopes:

```text
TURN
= newest explicit evidence

STEP
= working truth for the current unresolved semantic unit

RUN / BAG
= working facts/context for the session

PROJECT
= durable reusable project knowledge
```

Resolution strength is approximately:

```text
explicit current Turn
→ current Step
→ context / parent chain
→ Bag / Run facts
→ project facts / .rab memory
→ previous receipts
→ legal default
→ field resolver / child Tool
→ ask human
```

A user correction in the current Turn beats stale project memory. If the corrected fact is project-worthy, persist it after the Step can already use it.

## 5. Project memory and automatic persistence

Useful reusable facts such as these should be persistable:

```text
css-path
css-entry
components-path
pages-path
source-root
script-type / script-extensions
```

Do not create one save Stamp per fact. Use generic project Tools such as:

```text
project/set-setting
project/remove-setting
project/find-setting
```

A resolved setting may optionally declare that it should be persisted to project scope.

Automatic internal work is allowed. It must not be secret. The right column is the live trace showing Tasks, nested calls, reasons, receipts, Bag changes, and project writes.

## 6. settings.json / settings[]

Keep `settings[]` sacred: these are invocation seats/fields.

House-reserved structural field names currently include:

```text
id
name
title
description
type
path
file
required
```

Likely additions now being designed:

```text
try
save
```

A setting's minimum useful shape:

```js
{
  name: 'css-path',
  type: 'path',
  required: true
}
```

Richer:

```js
{
  name: 'grid',
  title: 'Grid',
  description: 'Grid layout to add',
  type: 'select',
  required: true,
  options: {
    source: './grids.json',
    use: 'keys'
  }
}
```

### `try` for missing fields

Current preferred direction:

```js
{
  name: 'css-path',
  type: 'path',
  required: true,
  try: 'find-folder',
  save: 'project'
}
```

Meaning:

```text
field missing
→ check Turn / Step / Bag / project / receipts first
→ still missing
→ resolve PATHS key named by `try`
→ spawn child Tool/Stamp
→ child's receipt fills the same named seat
→ optionally persist
→ resume parent Task
```

The field `name` is the socket identity across setting, Bag value, child return, and receipt.

Do not misuse `description` as resolver machinery.

A broader `meta.requires` may still exist for non-field environmental/capability dependencies, but field-level `try` is the cleaner mechanism for ordinary missing seats.

## 7. Nested execution: no callback in every Stamp

Callback/continuation belongs to the **runner**, not Stamp contracts.

Execution frame concept:

```js
{
  runId,
  stepId,
  taskId,
  parentTaskId,
  toolId,
  returnTo: {
    taskId: 412,
    name: 'css-path'
  }
}
```

Runtime actions:

```text
start
suspend
spawn child
return receipt
pack returned value
resume parent
complete
```

Arbitrary nesting:

```text
A
└─ B
   └─ C
      └─ D
```

Each child returns to its parent through the Task stack. The right column should render this chronology/tree.

## 8. Tool-local resources

A Tool may own local resources that move with it. References are relative to Tool root.

Example:

```text
tools/html/add/grid/
├─ add-grid.mjs
├─ settings.json
└─ grids.json
```

`settings.json` may source options from `./grids.json`; `grids.json` is the authority for the inventory.

This generalizes to chart types, icons, themes, etc. Do not copy all local inventories into global language or metadata.

## 9. Grid system concrete design

### HTML grid Tool

A normal Tool can insert known grid markup and leave explicit seats for future Stamps.

Examples supplied by Knighthawk include:

```text
header-main
main-footer
shell
side-left
side-right
side-cols
holy-grail
```

Example mold:

```html
<div data-grid="shell">
  <header data-area="header">[area-header]</header>
  <div data-area="main">[area-main]</div>
  <footer data-area="footer">[area-footer]</footer>
</div>
```

Important distinction:

```text
data-area="main" = runtime/layout identity
[area-main]       = manufacturing seat for a later Stamp
```

The options must come from the Tool's `grids.json`, not be duplicated in `settings.json`.

### Grid CSS Stamp

Knighthawk supplied a canonical `grid.css`. Installing that known file is a Stamp because it materializes a known artifact, even if the file is copied unchanged and never renamed.

Possible path shape:

```text
css/grid/stamp-install
```

or House name such as `grid-css`.

The Stamp must know the project's CSS destination. If unknown, resolve it via Bag/project facts/child Tool/user, then persist if useful.

Never silently overwrite a different existing `grid.css`.

### Import CSS Stamp

A generic import Stamp needs at least:

```text
source file (e.g. grid.css)
import target / CSS entry file
```

If a previous Stamp just created `src/css/grid.css`, use the previous receipt instead of searching again.

If `css-entry` is unknown, use a child `find-file`/detector, persist the result, and resume.

## 10. Generic manufacturing engines

As with `count`, do not create one copy implementation for every semantic product.

Likely generic mechanical Stamps:

```text
base/stamp-file
base/stamp-folder
css/stamp-import
js/stamp-import
base/stamp-text-seat
base/stamp-json-value
```

Then many meaningful House capabilities can delegate to a few boring mechanical operations.

Bad extremes:

```text
500 nearly identical Stamps
```

or:

```text
one mega Stamp with 47 unrelated settings
```

Desired:

```text
many meaningful semantic House shapes
→ few mechanical engines
```

## 11. React hook House language

House folder names stay normalized/kebab-case:

```text
use-state
use-effect
use-memo
use-callback
use-ref
use-context
use-reducer
```

Native framework names stay in descriptions/templates/scanners:

```text
useState
useEffect
useMemo
useCallback
useRef
useContext
useReducer
```

Shape 1 maps accepted surface/native forms to the normalized House form.

`use-effect` can be a React-scoped reserved House term.

## 12. Stamps as future-control points

Stamp templates may eventually be entire component systems or complete applications.

Stable intention:

```text
new chart
```

Stable House key / ID identifies the capability, while the template can evolve across generations.

The shipped customer product need not know RRAABBIITT exists. The House is the factory, not necessarily a runtime dependency.

Stamped products should leave lawful seats for future Stamps, allowing deterministic extension instead of AI re-generation/churn.

## 13. Right column

The right column exists specifically to show what happens under the hood while the conversational left side stays fluid.

It should be able to expose:

```text
current Step
current context
resolved seats
missing seats / typed holes
candidate Tools and ranking evidence
nested Task tree
which Tasks auto-fired
why each Task fired
receipts
Bag changes
project-memory writes
training/correction events
```

Automatic is acceptable. Opaque is not.
