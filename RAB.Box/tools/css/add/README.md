# CSS style and state updates

The existing atom/class leaves share add.mjs. State names live in ../_states.mjs and are also used by Box binding and the CSS state audit.

Action atoms own interactive skin. Compose the atom in markup, then add is-active while selected. Group :active and .is-active for their shared token-based skin; keep focus-visible feedback. Semantic attributes such as aria-current and aria-pressed remain tied to the same selection owner.

```css
.ui-nav-link:active,
.ui-nav-link.is-active {
  --nav-bg: var(--surface);
  --nav-ink: var(--ink);
}
```

Tool input: css/add/state/atom with atom_name="ui-nav-link", state="active, is-active", styles="--nav-bg: var(--surface); --nav-ink: var(--ink);". The class leaf takes class_name and an explicit CSS location instead. Existing IDs are unchanged.

State accepts a comma/space/and-separated list. :active and .is-active prefixes are accepted. A single active still means only :active; a single is-active means only the class. Other supported states: hover, focus, focus-visible, focus-within, disabled, checked, visited. Arbitrary selectors are not state names.

Grouped updates normalize order, consolidate matching root rules, retain other selectors in a group, and leave media/nested scopes in place. Existing properties merge in source order, then supplied declarations win. Pairing two previously different states intentionally gives both the merged skin. Repeating an identical update makes no file change. Updating one member later splits it from the group, allowing explicit pressed-only feedback.

Box turns (each line is a separate turn; styling is requested if omitted):

```text
make active and is-active match on atom ui-nav-link
--nav-bg: var(--surface); --nav-ink: var(--ink);
```

Also accepted: `add css state :active and .is-active to atom "ui-nav-link"`, `add css state is-active to class "ui-button" at "src/atoms/actions.css"`, and `make active and is-active match on this atom` when the current target is an atom. Missing targets or styles are questions, not guesses.

The CSS state audit checks each grouped selector independently within its scope, including .is-active, and reports duplicate properties. It does not require every pseudo-state to have a class alias or treat pressed and selected semantics as identical.
