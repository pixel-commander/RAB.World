# Project paths, item manifests, and the shared listener

Project scaffolds provide named base paths. After registration, the saved
project's settings.json.paths is the runtime authority. The memory owner resolves
that file under the executing user's .rab/projects/<project>/ folder. Source
settings remain the scaffold defaults and provenance; path edits do not silently
write them or recover old PROJECT.json path facts.

A path may be a string or an object with path and descriptive metadata. Updates
preserve supplied metadata through bridge/rab-memory.mjs setProjectPath and the
existing project/add/paths Tool. Components, pages, atoms, tools and custom path
keys are global semantic categories. React, HTML and other platforms are item
metadata or implementation context; the indexer has no platform-specific branch.

## One item contract

Each item owns settings.json with id, name, title, description, settings (an input
array), and meta (an object), plus any item-specific JSON extras. The shared pure
makeItemSettings/assertItemSettings functions in bridge/rab-node.mjs validate this
shape. Creation uses the existing observed-timestamp allocator through the shared
createItemSettings helper. The scanner never assigns or replaces an item's ID.

indexed defaults to true only when absent. Explicit false excludes the owning
item; it does not stop listening or hide its descendants. Changing it back to
true restores the same source ID. A rename changes the location, not the ID.
Bare files/folders without settings are not invented into items. Invalid settings
and duplicate IDs are reported, and an incomplete scan preserves the previous
manifest. Symlinks, node_modules, .git, .rab, and template trees are excluded.

## Storage and lookup

Each configured path key has one derived manifest:

    USER_HOME/.rab/projects/<project>/manifests/<key>/manifest.json

The memory owner selects the project directory. Every manifest uses the same
id, name, title, description and items structure. items is an object keyed by
the source record ID; JSON keys are strings and each record's id stays numeric.
Components, pages and other collections do not get different collection keys.
The manifest's name and saved location identify its collection. It receives one
observed timestamp ID on creation and keeps it on subsequent updates.

The shared house settings/meta fields remain available. Scan version, source
path, conditions, time and count live in meta. Records retain their source
descriptor fields and project-relative locations, with empty items for leaves
unless their source descriptor already supplies children. Thus the same items
traversal works at each level. The reader adapts the saved map into the existing
Tool result list without introducing another saved manifest format.

The existing base/find/inventory Tool reads the saved manifest. Whole requests
list components, find components, scan components, and scan for components all
use that same lookup. Lookup does not enumerate source directories. Missing path
configuration leads to the existing question flow; an accepted path goes through
project/add/paths and the saved-settings owner, then attaches to the listener.
Configured roots without a manifest get a resumable listener question instead of
being treated as missing path configuration. Both chat yes/no and input-panel
answers resume the same step; declining cancels setup. Valid empty manifests do
not trigger setup. Stopped or unhealthy listeners label results as last saved.
Inventory-only planner turns skip the separate entity-resolution source scan.

A configured root without a manifest is not the same as a valid empty manifest.
Unavailable roots and malformed data are not reported as empty collections. Old
project-inventory/v1 and v2 manifests require an explicitly scoped backed-up rebuild;
they are never silently overwritten or used as current-format records. This
change does not migrate existing item metadata or historical records.
There is no automatic old-format migration route in this change.

## Listener controls

The discoverable controls inherit tools/base/watch/watch.mjs:

    base/watch/add     {"paths":["components","pages"]}
    base/watch/list    {}
    base/watch/remove  {"type":"components"}

Add takes an array of existing named project paths; the existing project/add/paths Tool
sets or changes the actual folder and then registers it. Saved registrations live
in listener.json beside saved project settings. Re-adding a key preserves its ID
and any conditions not explicitly supplied. Removing a watch leaves source and
the last saved manifest intact.

An entry can be a key or an object with type and its own conditions, for example
{"paths":["components",{"type":"pages","include":["public/**"]}]}.
Top-level conditions supply defaults; each entry may override them, including
false, zero and empty arrays. Each path writes its own manifest.json through
the existing memory owner's destination resolver. One entry uses a one-element
array. The parent validates the whole array before registering its paths.

Optional add inputs are recursive (default true), include (default ["**"]),
exclude (default []), debounce_ms (default 200; zero is allowed), and reconcile_ms
(default 30000; minimum 250). Patterns match folder paths relative to the watched
root, using forward slashes. * matches within a segment, ** crosses segments, and
? matches one non-separator character. Include/exclude select items, not parents
of a pruned tree. recursive:false checks the root and immediate child items.

tools/base/watch/watch.mjs is the shared lifecycle owner. It combines events,
serializes updates, ignores generated manifests, and reconciles periodically.
Settings writes, folder additions, removals and renames trigger reconciliation.
The listener keeps observing indexed:false items so they can be re-enabled.
Native-watch failures show polling status and an error; reconciliation continues.
See Node's filesystem-watch caveats for network shares:
https://nodejs.org/docs/latest/api/fs.html#caveats

Box initializes saved registrations on startup and closes watches on shutdown.
This is part of the existing Box process, not a separate installed daemon. Source
access and .rab storage belong to the machine actually executing that process.
Direct short-lived CLI calls cannot leave a process alive after they exit.

## Verification

Run tests/project-watcher.test.mjs, tests/project-inventory.test.mjs, and the
identity-storage descriptor/saved-project-path tests. They use isolated storage
under the current user's .rab/temp. Verify generated settings and manifest
contents, add/change/remove/rename, opt-out/re-enable, multiple roots, restart,
reconciliation, containment, malformed/duplicate identity handling, and runner
and question-flow integration. Dated outcomes belong in a test report.

