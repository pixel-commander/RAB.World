# DETERMININTELLI / RRAABBIITT — START NEXT CHAT HERE

This is a continuity handoff for Knighthawk's deterministic-intelligence / Magic Box project.

## Do not restart the architecture discussion

The current actual packaged baseline is **RRAABBIITT Magic Box v0.8.4 — Flat PATHS**.
The conversation moved materially beyond that package. The next implementation pass should incorporate the decisions in `ARCHITECTURE_CURRENT.md` and `PENDING_IMPLEMENTATION.md` rather than redesigning from scratch.

## Immediate next engineering goal

Build the missing **typed-composition / Montague-inspired logic layer**, **nested Step/Task runtime**, and **guided inline training** into the current package.

The language pipeline should become:

```text
Shape 0 raw input
→ Shape 1 lexical candidates / phrases / known forms
→ Shape 2 typed composition + order + context + typed unknown holes
→ Shape 3 canonical semantic seats
→ Shape 4 Tool/Stamp candidates from path tags / PATHS
→ Shape 5 resolved/proposed capability
→ Shape 6 fill settings; child Tools/Stamps resolve missing seats; execute; receipt
```

The critical correction is that Shape 2 must no longer be only hand-written “find verb / find noun / adjective-before-noun” rules. It must use explicit type compatibility and composition so an unknown word can have a deduced **role/type** without inventing its meaning.

Example expected behavior:

```text
find fuck-off hooks
```

Should preserve:

```js
{
  operation: 'find',
  target_type: 'hook',
  predicate: {
    value: 'fuck-off',
    type: 'predicate',
    known: false
  }
}
```

The Box may say it knows the word is functioning as a hook predicate/modifier but does not know what `fuck-off` means.

Another required guided-training example:

```text
hack a new component named 'do-it'
```

Desired interaction is approximately:

```text
I know you want to add/create a component named do-it,
but I don't know what "hack" means here.
```

The user can teach/correct it. The correction should be stored with provenance, rerun the same Step, and become a regression/contrast case.

## Current known resolver failure that must be fixed

The UI produced capability gaps even though the semantic seats were mostly resolved:

```text
find all hooks
find hooks
find state hooks
count hooks
count files
count components
```

Examples of resolved seats included:

```text
operation=find
 target_type=hook
 quantifier=all
 output=list
```

and:

```text
operation=count
 target_type=hook
 output=count
```

The Tool resolver must use path tags as the heaviest deterministic evidence. Existing deep Tool paths must resolve from these frames when the capability exists. If a matching capability truly does not exist, that should remain a clean capability gap and may generate a missing-tool specification.

## Most important laws

- **ID = permanent implementation identity.**
- **Path = current semantic position.**
- **Tags = derived/inherited from path.**
- **Path tags are inherited truth. Explicit metadata may add meaning but may not contradict the path.**
- Filesystem may be deep; `PATHS.json` is a small flat direct address book grouped by `stamps` and `tools`.
- Project `PATHS.json` may override/hijack a House key with a project-specific implementation.
- A Stamp is a Tool that materializes a known shape from `template/`; templates may eventually be whole products.
- Stamped products may leave explicit seats for future Stamps.
- The Box owns Step/Task chronology and child-return/resume behavior. **Do not put callback code into every Stamp.**
- Automatic internal Tools are allowed, but the right column must expose everything that ran, why, what returned, Bag changes, and what was persisted.
- Tool-local resources travel with the Tool and use relative paths.
- Keep stable House language while implementation evolves.

Read `ARCHITECTURE_CURRENT.md` next.
