CONTAINER ATOMS
===============

A container atom supplies a surface's skin. It does not set padding, size,
display or layout. A component supplies that structure, and markup adds the
container class to select the surface.

The binding vocabulary includes container-main, container-inset,
container-float, container-grid-cell and container-grid-area. Reuse the exact
name. Do not prepend the element's tag or role to a container atom name.

EXAMPLE

  <article class="stat-card container-main">...</article>

stat-card owns the card's structure. container-main owns the skin. Removing
container-main removes that surface without removing the card's structure.

INSTANCE OVERRIDES

Change an instance through the atom's custom property, not a selector that
redeclares the atom's border or background:

  .calendar__day { --container-inset-border: none; }

This is the exact override example in rule S4. Before applying an override,
check the chosen atom exposes that variable and what its template consumes.
Do not invent a variable and assume it affects an existing atom. When the
template and rule disagree, resolve that source mismatch within the task.

Every atom property uses its own variable with a shared-token fallback.
Border declarations use explicit border-width, border-style and border-color;
base and variant skin stay in @layer atoms. Component CSS must not reset them
from a later layer. Themes redefine tokens only.

GRID CELL IS STILL A SKIN ROLE

A container-grid-cell class does not replace data-area or create a layout.
Grid tracks belong to system CSS; cell padding and scroll behavior follow
the cell rules. Read ../../../grid/README.txt for that structure.

CHECK
Inspect the composed element with and without its atom class. Structure must
remain with the component, and atom variables must affect only the intended
skin property. Verify theme and border variants without adding competing skin
declarations to component styles.

SOURCE
  ../../../../../../ganglion/coding/css/oocss/RULES.txt -- S1-S8, T1-T3, C1-C5
