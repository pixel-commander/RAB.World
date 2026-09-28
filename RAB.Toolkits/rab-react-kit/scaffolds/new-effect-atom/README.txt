New Effect Atom

Creates a named CSS effect token alias from an existing float or inset preset, preserving its elevation-token dependency and atom metadata.

Box key: react/css/add/new/effect-atom
Provide name and location. The tool creates location/name/name.css and
settings.json. Inputs and choices are declared in settings.json. The nearest
parent executor new.mjs renders this leaf's template and uses Box's shared
artifact writer. Existing atom folders are never overwritten.

Copies the existing effect token presets into the tool template. Creation renames the effect token and filename; it does not generate a class selector.

Import the generated CSS and reference var(--name) from another skin rule.
The project must supply the referenced elevation token.

The generated atom settings.json uses the shared item fields id, name, title, description, settings and meta, plus the house atom kind, dates and indexed.

import_styles defaults to true and registers the generated CSS once in the owning project src/css/style.css. Explicit false skips stylesheet registration and does not require a project root. With registration enabled, the selected context project owns the stylesheet; without a selection, the nearest ancestor package.json identifies the project. Imports are inserted before style rules; existing text is preserved. A registration failure after atom creation reports the created folder in error details.
