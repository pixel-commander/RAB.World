Update Base Manifest

Invoke base/index/manifest through Box with no options. The tool scans only
Box's tools/base folder and atomically updates tools/base/manifest.json.
It preserves the manifest ID and original tool IDs. Grouping folders and
template folders remain visible; template settings do not become tools.
Files are listed by name only. Symlinks are not followed. The manifest and
temporary output files are excluded. Invalid source JSON aborts the update.
No beacon, watcher, or automatic scan is installed.
