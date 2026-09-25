# Page stamp

`react/add/new/page` accepts a capitalized `name` and optional `location`; the default location comes from project `settings.json` → `paths.pages`.

It creates one main landmark, native DOM props, caller className, children, and a stable `data-rab-seat` root. The seat is a construction address; `data-page` and `data-area` carry the page/area semantics. The shared descriptor fields have visible roles: `name` identifies the page for navigation, `title` renders as its heading, and `description` renders as its opening body text. Optional `content` follows that text unless caller children replace it.

Example Box turns:

```text
create react page called RunsPage
apply grid layout "header-main" to component "RunsPage"
```

Use `react/apply/grid-layout` for a registered topology. Use `react/insert/component-into-area` with the page file, component name and canonical area to place existing components. Use the existing cleanup pass to remove construction markers after composition; semantic page and area keys remain.

`react/add/new/dashboard` composes this page stamp, the grid owner, the navigation stamp, and the insertion Tool. The same existing nav may be reused without replacing its contents.

Tests: `tests/construction-composition-v093.test.mjs` exercises order independence, compound/primitive agreement, import identity, exact seats and cleanup.

Each generated page folder owns settings.json with the shared item fields id, name, title, description, settings and meta, plus page content and indexed.
