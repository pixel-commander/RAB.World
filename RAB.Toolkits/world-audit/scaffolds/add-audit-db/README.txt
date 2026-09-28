Add Audit DB
Requires Node with node:sqlite (verified on Node 24). No Base runtime dependency.
Inputs: world (required), path (optional destination folder).
Uses context.rab_home or the executing user's home/.rab. Requires an existing world settings.json.
Creates audits.sqlite locally; existing databases are opened read-only and checked, never overwritten or migrated.
The runner is not connected by this scaffold. JSON reports are unchanged.
Folder IDs are database-local stable IDs. The writer must normalize path_key consistently and enable foreign_keys on each connection.

Schema v2: folders is the map (id, path, parent). Child folders are derived by querying parent; never stored a second time.
folder is optional enrichment keyed by the same folders.id. Reuse HouseKeys names and epoch-millisecond date fields.
settings and meta retain the existing JSON array/object shapes. Detailed scan metrics and tagging contracts are not invented here.
Refreshing the map must preserve IDs by normalized path and must not replace folder enrichment. Path normalization is the future writer's responsibility.
The runs table uses date_start/date_end; the current JSON runner's start_date/end_date must be translated when connected.
This scaffold does not import reports or wire the runner/UI to the database.
