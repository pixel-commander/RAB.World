EFFECT ATOMS
============

An effect atom contributes skin, such as a visual depth treatment, while the
component retains structure. Its complete family prefix is effect-, even
though this documentation folder is named effects.

Reuse the chosen project's existing effect atom and its documented variables.
The shared rules establish the effect- family but do not enumerate a fixed
list of effect classes. Do not invent a class name here and treat it as an
installed capability.

OWNERSHIP

Stack an effect class on the element that needs it. Do not add wrappers only
to obtain another skin variant. The effect must not introduce padding, sizing,
display, grid tracks or component part layout. These remain structural work.

Effect skin and any owned interaction states stay in @layer atoms. Each
property reads an atom-specific custom property with a shared-token fallback.
Use an exposed variable for an instance override instead of fighting the
effect with a component selector. Themes change tokens rather than hardcoding
new colors into components.

When two stacked atoms touch the same property, inspect their owning rules
and choose the intended composition. Adding !important or a later component
skin declaration is not a substitute for resolving ownership.

CHECK
Remove the effect class and confirm only its intended visual treatment goes
away. Component sizing and layout must remain intact. Check token/theme
changes and any supplied state rules against the actual effect implementation.
If changing a stamp, generate and inspect an example from its template.

SOURCE
  ../../../../../../ganglion/coding/css/oocss/RULES.txt -- S1-S8, T1-T3, ST1-ST3
