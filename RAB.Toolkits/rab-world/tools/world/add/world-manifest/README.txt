ADD WORLD MANIFEST

Creates manifest.json in an existing folder. The manifest describes the
folder's contents. It is separate from a beacon: it does not declare a path,
require a beacon, or control beacon behavior.

Every new manifest uses the same manifest/v1 shape. It indexes direct child
folders that have valid settings.json files, including signal records. Existing
manifest.json files are never overwritten. This one-shot tool does not start a
watcher, register a project, or alter any other file in the folder.
