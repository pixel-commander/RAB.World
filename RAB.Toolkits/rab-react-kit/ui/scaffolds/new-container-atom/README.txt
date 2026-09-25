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
