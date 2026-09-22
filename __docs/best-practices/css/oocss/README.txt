OOCSS: STRUCTURE AND SKIN
========================

Components own structure: display, part layout, gap, padding and part
typography. Atoms own skin: color, background, borders, radius, shadow and
interaction states. Markup composes the two by stacking classes.

  atoms/   Skin families, their responsibilities and instance overrides.

Example: <article class="stat-card container-main">...</article>
stat-card supplies structure; container-main supplies skin. Grid topology
belongs to the shared grid system described in ../grid/README.txt.

Binding source: ../../../../ganglion/coding/css/oocss/RULES.txt, S1-S8.
