ADD BEACON MANIFEST

Creates manifest.json beside an existing beacon.json. The beacon folder is
the manifest's ownership and indexing scope; no project ID or project record
is used. The result begins with items {} and is not a scan result.

Existing manifest.json files are never overwritten. This tool does not start
a scanner, register a watcher, or modify the beacon.
