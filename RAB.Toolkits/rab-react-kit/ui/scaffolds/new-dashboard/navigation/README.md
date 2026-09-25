# New Navigation

The shared React component engine owns identifier validation, directory reservation, template materialization and duplicate protection.

Inputs: name (PascalCase), location (components folder), rows (nonempty JSON array of unique {id, name, path} records), label (defaults to Main navigation). Legacy links {label, href} are accepted when rows is absent.

Example Tool request:

```json
{"tool":"react/add/new/navigation","options":{"name":"SiteNav","location":"C:/my-app/src/components","rows":[{"id":"overview","name":"Overview","path":"/overview"},{"id":"runs","name":"Runs","path":"/runs"}]}}
```

Output is an accessible nav component with typed default rows, `selected`, `handleClick`, native DOM prop forwarding and className composition. `selected` is a row ID and sets both `aria-current="page"` and `is-active`. `handleClick(row)` prevents native link navigation when supplied; without it, links follow their paths. The existing `activeHref` prop can select by path. Pass `linkClassName` to compose action atoms on each link; `className` composes the nav root. Styling belongs in components' structural CSS and reusable skin atoms. Executable schemes, protocol-relative destinations, control characters, duplicate IDs and duplicate destinations fail before output is written. Components own no mutable state.

Action atoms share a token-based rule for :active and .is-active. The former is temporary pressed feedback; the latter reflects the existing selection owner. Keep aria-current for semantics. See ../../css/add/README.md for state-tool inputs and Box wording.

Use react/insert/component-into-area to place the result in an existing canonical data-area. react/add/new/dashboard composes this stamp for its default navigation and reuses an existing same-named component without overwriting it. A URL-backed dashboard should read selection through the UI kit's `useURL` hook and pass `selected` and `handleClick` here.

The generated navigation component owns settings.json with the same shared item fields as other components. Its source contains the link structure and accessible navigation behavior.
