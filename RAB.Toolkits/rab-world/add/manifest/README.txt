ADD MANIFEST

manifest.mjs renders template/manifest.json. settings.json declares the
tool inputs for forms; contract.json describes its output.

Required inputs: name (collection key), path (save folder), source_path
(indexed folder relative to the project root). project_id must be supplied
unless a selected project provides its numeric ID. title defaults to name;
description defaults to empty text. The shared identity owner allocates id.

path is relative to the selected context.project.root, or absolute without
a selection. The name is not appended. Output is path/manifest.json.
source_path is stored separately in meta.path; it is not the save location.

The template retains the existing project-inventory/v3 fields: identity,
settings, indexed, meta and items. meta contains kind, version, collection,
project_id, path, conditions, scanned_at and count. items is an object keyed
by item IDs. A fresh manifest has items {}, count 0 and scanned_at null:
no scan has occurred. Default conditions match the existing indexer.

This tool only stamps an empty manifest. It does not scan, start a watcher,
register paths, or replace an existing manifest. The existing project indexer
still owns refreshes and uses .rab/projects/[name]/manifests/[key]/manifest.json.
It will not discover arbitrary output locations. World/beacon integration
is not implemented. The project_id field still means a project, not a world.

The public discovery wrapper is at ../../tools/world/add/manifest and delegates
to this implementation. Run through the Box helper contract; the executor is
not a standalone CLI.
