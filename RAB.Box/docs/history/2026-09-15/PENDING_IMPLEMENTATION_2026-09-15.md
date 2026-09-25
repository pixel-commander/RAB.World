# NEXT IMPLEMENTATION PASS — DO NOT LOSE

## A. Typed / Montague-inspired composition is now required

The current v0.8.4 parser mostly uses hand-written Shape-2 rules. That was an implementation shortcut and must be corrected.

We do **not** need to prove academic Montague semantics or reduce every utterance to truth values. We need the compositional/type discipline.

Use the useful core:

```text
pieces have explicit types
operators/functions declare what type they accept
legal neighbors/order constrain type
composition only occurs when types fit
missing arguments remain visible slots
unknown lexical values may survive when their role/type is deducible
```

### Operational types rather than only e/t

Classic Montague can inspire the algebra, but House types should be operational, e.g.:

```text
Operation
TargetType
TargetExpr
Predicate
Relation
Quantifier
Name
Value
Reference
Path
File
Scope
Output
Command
Question
Statement
```

Composition signatures can be explicit. Examples (illustrative, not final syntax):

```text
FIND        : TargetExpr → Command
COUNT       : TargetExpr → Command
ALL         : TargetExpr → TargetExpr
STATE       : TargetExpr → TargetExpr
NAMED       : Name → TargetExpr → TargetExpr
IN          : Container → TargetExpr → TargetExpr
ADD         : TargetExpr → Command
```

Or curried signatures if that is cleaner:

```text
NAMED : Name → (TargetExpr → TargetExpr)
```

The important behavior is typed functional application, not the notation.

### Typed unknown holes

Input:

```text
find fuck-off hooks
```

Known:

```text
find  → operation=find
hooks → target_type=hook
```

Position/order can establish that `fuck-off` occupies a predicate/modifier role.

Do **not** invent the meaning of `fuck-off`.

Carry:

```js
{
  value: 'fuck-off',
  type: 'predicate',
  known: false
}
```

The Box can then ask/train specifically on the hole.

Input:

```text
hack a new component named 'do-it'
```

The phrase `new component named do-it` can independently establish something like:

```js
{
  operation: 'add/create',
  target_type: 'component',
  name: 'do-it'
}
```

while `hack` remains an unknown typed lexical occurrence. Desired guided response:

```text
I know you want to add a component named do-it,
but I don't know what "hack" means here.
```

The user can map `hack` to a known sense, mark it as filler/alias if appropriate, or teach a new sense.

## B. Do not implement type logic with `try { left(right) } catch TypeError { right(left) }`

The online feedback/toy code used Python exception-driven application. That is not sufficient.

The Box should explicitly know:

```text
left output/input signature
right output/input signature
legal composition direction
result type
```

Use deterministic compatibility checks. An invalid combination should become a typed unresolved state, not an exception-driven guess.

## C. Preserve Shape pipeline

Recommended adapted pipeline:

```text
Shape 0 — raw exact input
Shape 1 — lexical/phrase candidate inventory; preserve ambiguity
Shape 2 — typed composition, grammar/order, phrase-span selection, context narrowing, typed unknown holes
Shape 3 — canonical semantic seats
Shape 4 — Tool candidates from PATHS/path tags
Shape 5 — resolved/proposed Tool with evidence
Shape 6 — fill Tool settings, nested child resolution, confirm/YOLO, execute, receipt
```

Montague-style composition belongs primarily in Shape 2, feeding Shape 3. It does not replace Tool resolution, Bag state, or Steps.

## D. Capability resolver must be fixed

The current UI showed:

```text
step-1 capability-gap NO CAPABILITY — find all hooks
operation=find
target_type=hook
quantifier=all
output=list

step-2 capability-gap NO CAPABILITY — find hooks
operation=find
target_type=hook
quantifier=all
output=list

step-3 capability-gap NO CAPABILITY — find state hooks
operation=find
target_type=hook
quantifier=all
predicate=state
output=list

step-4 capability-gap NO CAPABILITY — count hooks
operation=count
target_type=hook
output=count

step-5 capability-gap NO CAPABILITY — count files
operation=count
target_type=file
output=count

step-6 capability-gap NO CAPABILITY — count components
operation=count
target_type=component
output=count
```

When a matching Tool exists, these frames must resolve against path tags / Tool shape. Path tags are the heaviest match.

When a Tool genuinely does not exist, keep a clean capability gap:

```text
all semantic/context seats complete
+
Tool = null
=
missing capability/tooling problem, not language failure
```

## E. Guided inline training

This is a missing major feature.

When a typed hole cannot be resolved, the Box should explain exactly what it knows and what it does not know.

Example:

```text
I know:
  operation: add
  target_type: component
  name: do-it

I don't know what "hack" means in this position.
```

User correction should:

1. apply to the current Step immediately;
2. rerun/reduce the same Step;
3. store a training receipt with raw input, token/span, inferred type, prior candidates, user correction, resulting canonical sense/shape, scope, and provenance;
4. generate a regression/contrast test where possible;
5. update the appropriate reviewed/project lexicon only under the chosen training policy.

### Training scope

Support at least:

```text
project-only vocabulary/correction
House/global proposed vocabulary
```

Do not silently convert one casual correction into irreversible global truth. Keep receipts/reviewability.

## F. Training / Re-phrase UI

Add or expand a tab where Knighthawk can type commands and inspect/fix them without executing project work.

Desired panes/state:

```text
raw input
Shape 1 candidates
phrase spans
composition/type tree
canonical seats
unknown typed holes
Tool candidates + ranking
selected/proposed Tool
training corrections
contrast/regression cases
re-run result
```

Re-phrase should share the same language logic rather than a separate pile of hardcoded whole-sentence replacements.

## G. Nested Step/Task runtime

Do not add callbacks to every Stamp.

Runner must own:

```text
parentTaskId
returnTo seat name
suspend parent
spawn child
receive child receipt
pack result
resume parent
```

A setting with `try` may trigger this automatically only after ordinary context resolution fails.

Example:

```js
{
  name: 'css-path',
  type: 'path',
  required: true,
  try: 'find-folder',
  save: 'project'
}
```

If `css-path` is already known, no child runs.

If missing:

```text
find-folder child Tool
→ returns name=css-path, type=path, path=src/css
→ parent setting filled
→ project/set-setting auto-task (because save=project)
→ parent resumes
```

## H. Grid implementation slice

Use supplied `resources/grid.css` as the canonical grid system input.

Implement/prototype:

```text
html/add/grid
  local grids.json
  settings grid option sourced from grids.json
  inserts markup and leaves [area-*] seats

css/grid/stamp-install (or House key grid-css)
  template/grid.css
  resolves css-path
  copies canonical file
  does not silently overwrite conflict

css/stamp-import
  generic import operation
  requires/fields source file + css entry file
  computes relative import path
  uses prior receipt / Bag / project facts before searching
```

Prefer generic mechanical Stamps underneath semantic capabilities.

## I. Reserved House/native words

Keep normalized House forms such as:

```text
use-effect
use-state
```

Descriptions/scanners/templates use native forms:

```text
useEffect
useState
```

Shape 1 should map accepted native/surface forms to the House form.

## J. User confirmation / ambiguity loop

If one candidate meaningfully outranks otherwise average candidates, propose it. Do not silently pretend ambiguity disappeared.

User may:

```text
yes        → confirm
no         → reject this candidate and rerank
redirect   → add evidence and rerank
more info  → add evidence and rerank
```

Clarification Turns remain part of the same unresolved Step.
