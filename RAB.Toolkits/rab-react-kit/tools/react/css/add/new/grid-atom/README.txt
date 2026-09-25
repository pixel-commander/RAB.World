New Grid Atom

Creates a named CSS grid definition from an existing grid preset using data-grid and data-area selectors, retaining its area names and track topology.

Box key: react/css/add/new/grid-atom
Provide name and location. The tool creates location/name/name.css and
settings.json. Inputs and choices are declared in settings.json. The nearest
parent executor new.mjs renders this leaf's template and uses Box's shared
artifact writer. Existing atom folders are never overwritten.

Copies the existing grid templates into the tool template. Creation renames the data-grid selector and filename while retaining area names and topology. The shared grid installer remains in Box.

Import the generated CSS alongside the shared grid baseline installed by
css/grid/stamp-install. Apply data-grid=name and preserve the preset data-area
keys in the structural markup. This tool creates a CSS definition; adding
a layout to the shared grid catalog is a separate operation.

The generated atom settings.json uses the shared item fields id, name, title, description, settings and meta, plus the house atom kind, dates and indexed.
