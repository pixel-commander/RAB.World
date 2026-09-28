New Container Atom

Creates a reusable CSS container skin scaffold with inset and float surface hooks, metadata and a React demo. Components own layout.

Box key: react/css/add/new/container-atom
Provide name and location. The tool creates location/name/name.css and
settings.json. Inputs and choices are declared in settings.json. The nearest
parent executor new.mjs renders this leaf's template and uses Box's shared
artifact writer. Existing atom folders are never overwritten.

Adapts the factory CSS and demo placeholders to Box templates. Uses JSON atom metadata and the current component/skin rules.

The template includes a React demo. Apply the class to a structural component
and fill its skin declarations with project tokens. Inset and float variants
use data-layer on the same class.

The generated atom settings.json uses the shared item fields id, name, title, description, settings and meta, plus the house atom kind, dates and indexed.

import_styles defaults to true and registers the generated CSS once in the owning project src/css/style.css. Explicit false skips stylesheet registration and does not require a project root. With registration enabled, the selected context project owns the stylesheet; without a selection, the nearest ancestor package.json identifies the project. Imports are inserted before style rules; existing text is preserved. A registration failure after atom creation reports the created folder in error details.
Container demo/Demo.tsx imports the atom CSS and returns a div with the atom class plus demo-atom, displaying the dot-prefixed class name. It exports Demo by name and as default.
