GRID, AREAS AND CELLS
====================

The shared grid owner defines layout vocabulary. Markup selects a topology
with data-grid and places children with data-area. Do not create a Grid
component, layout classes or per-component grid templates for an existing
topology.

THE VOCABULARY

  data-grid   holy-grail, shell, side-cols, header-main, main-footer,
              side-left, side-right
  data-cols   1 through 12
  data-rows   1 through 12
  data-gap    control, content, container, section

Use the area's exact name from the selected topology's owning system CSS.
Do not infer a new area set from a topology's label. data-area names are
lowercase; component names remain PascalCase.

EXAMPLE: STRUCTURE AND CELL OWNERSHIP

  <section data-grid="header-main" data-gap="content">
    <header data-area="header">
      <div class="inner pad">Heading</div>
    </header>
    <main data-area="main">
      <div class="inner pad scroll">Scrollable content</div>
    </main>
  </section>

This assumes the project's canonical grid and cell styles are loaded.
The example selects existing classes; it does not define a second grid system.

ONE CELL, COMPOSED VARIANTS

Use one cell per area. Stack inner, pad and scroll on the same element rather
than nesting wrappers for each behavior. pad uses var(--space-md). Remove pad
for a flush cell. Never put padding directly on [data-area] or raw px in cells.

Only the cell that owns overflow scrolls; header and footer never scroll.
Inside a cell use flex or block for its contents, not another page topology.

THE AREA-OWNING EXCEPTION

An area-owning page or component mounts directly in [data-area], without an
inner wrapper. A nested page topology belongs only inside the shell's main
area. Its root claims that shell cell with flex: 1 and min-block-size: 0.
Do not wrap a track-filling grid in flex: automatic height can collapse it.

KEEP OVERFLOW INSIDE THE SHELL

The shell is 100dvh with overflow hidden. Every scrolling track is guarded
with minmax(0, 1fr); even a column-only topology needs a guarded row. An auto
track must not grow the body instead of letting its cell scroll. These track
definitions belong in system grid CSS, not component or page stylesheets.

For responsive arrangements, change grid-template-areas in media queries.
Keep DOM order stable. Verify both small and large content: a layout that
looks correct with three rows can still fail with a hundred.

SOURCE
  ../../../../ganglion/coding/css/oocss/RULES.txt -- G1-G6, C1-C5
