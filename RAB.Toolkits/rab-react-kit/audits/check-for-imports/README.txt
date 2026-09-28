Check for Imports

Pass path (source folder) and name (filename including extension).
Scans top-level static JS/TS imports, including type imports, multiline imports, aliases, namespaces, and side-effect CSS imports. React and react-dom imports and their subpaths are excluded.
Each local imported binding produces {id: "", name, path}; side-effect imports use the source basename as name. Paths retain the source module specifier.
Adds missing pairs to required in adjacent settings.json. Preserves all existing keys and requirements, including stale ones. Creates settings.json when absent. Does not resolve modules, recursively scan, or inspect require/dynamic imports. Uses a dependency-free text scan for static imports.



Only records imports outside the source component folder. Relative and absolute paths inside that folder (including nested folders) are skipped. Package/alias imports remain external because no alias configuration is inferred. Existing required entries are preserved.
