ACTION ATOMS
============

An action atom skins an interactive element. The component owns structure,
label arrangement, sizing and padding; the atom owns color, background,
border, radius, shadow and interaction states.

The binding UI vocabulary includes action-main, action-muted and action-nav.
Reuse an existing atom for the intended surface. The complete action- prefix
is supplied by the caller; a stamp validates it rather than guessing it.

EXAMPLE

  <button className="nav-item action-nav" onClick={handleClick}>Library</button>

nav-item supplies structure. action-nav supplies skin. handleClick remains
the house callback; onClick is the native DOM socket.

Hover, active, focus-visible and disabled styling belongs to the action atom,
not component CSS. Do not fight it with a more specific component selector.
Stamps do not add aria-current/aria-selected styling or selection precedence;
selection styling requires an explicit request.

Each atom property reads its own custom property with a shared-token fallback:
  var(--atom-part-property, var(--token))
This is the naming pattern; use the actual property's established names.
Theme changes redefine tokens. Instance changes set the owning atom variable.

Keep atom CSS in @layer atoms. Use border-width, border-style and border-color
separately. Base and variant skin belong in the same owning layer so a later
shorthand or layer cannot reset a selected border color.

CHECK
Verify that removing action-nav removes its skin while nav-item structure
remains. Inspect keyboard focus and disabled behavior as well as hover, and
confirm the component has not redeclared the atom's states or raw colors.

SOURCE
  ../../../../../../ganglion/coding/css/oocss/RULES.txt -- S1-S8, T1-T3, R7
