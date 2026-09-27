ManifestViewer

House keys: id, name, title, description, manifest, path. Direct manifest
data takes precedence over path. path is a JSON URL, not a filesystem path.
Manifests contain items as an array or object, with optional nested items
and files. Native details/summary provides keyboard expansion. Loading,
invalid data and empty results are displayed. No tools execute in the viewer.
Container-cell supplies skin; className accepts additional container atoms.
Layout is in css/manifest-viewer.css; loading state is in hooks/useManifest.ts.

World reads /manifests/base.json, published by sync:world from the saved Base
manifest. npm run update:base invokes the Box tool, then republishes its output.
