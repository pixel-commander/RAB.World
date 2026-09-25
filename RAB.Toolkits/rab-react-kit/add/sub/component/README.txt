Sub Component

Creates a new child React component inside its parent component folder, with source, settings and README.

Box key: react/add/sub/component
Inputs are declared in settings.json. The local template owns the shape.
Box supplies shared rendering and artifact-writing helpers; public child tools
run through helpers.runTool. Existing output is never silently replaced.
See contract.json for the result and SOURCE.json for the preserved identity.

Each child component owns settings.json with the shared item fields id, name, title, description, settings and meta, plus type, class, parent_path and indexed. The parent path is the containing component folder.
