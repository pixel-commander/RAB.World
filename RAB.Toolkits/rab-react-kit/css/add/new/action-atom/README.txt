New Action Atom

Creates a tag-neutral CSS skin for interactive elements, including navigation links and controls, with hover, active, persistent is-active, focus and disabled states plus a React link demo.

Box key: react/css/add/new/action-atom
Provide name and location. The tool creates location/name/name.css and
settings.json. Inputs and choices are declared in settings.json. The nearest
parent executor new.mjs renders this leaf's template and uses Box's shared
artifact writer. Existing atom folders are never overwritten.

Adapts the original interactive-skin mold to the house action-atom type. The class is independent of HTML tag. Shared :active/.is-active token styling, focus-visible and aria-disabled styling follow current React rules; component code owns behavior and semantic state.

Import the CSS and apply its class to the interactive element. The demo uses
navigation links. Derive .is-active and the appropriate ARIA state from the
same component value. Disabled appearance does not prevent activation;
the component owns that behavior. Project skin tokens must be available.

The generated atom settings.json uses the shared item fields id, name, title, description, settings and meta, plus the house atom kind, dates and indexed.
