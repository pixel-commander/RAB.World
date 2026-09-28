FIRST-MACHINE DATABASE SETUP

Run on the machine that will own the SQLite database. Importing a tool from the server share does not execute it on the server.
The existing tool is:
\\Desktop-t72isdi\l\RAB.World\RAB.Toolkits\world-audit\scaffolds\add-audit-db\add-audit-db.mjs

PREREQUISITES
Node with node:sqlite support (Node 24.15.0 was tested).
An existing, correctly named world under the executing machine's .rab/worlds.
Its settings.json must already exist. This scaffold does not create a world or another house anchor.
Access to the tool source over the share, or an intentionally installed package with its template/schema.sql beside it.

CALL THE TOOL
Save the following as an .mjs script and execute it with Node on the destination machine.
Change world to the exact existing world name. This example uses laptop.

import { run } from 'file://Desktop-t72isdi/l/RAB.World/RAB.Toolkits/world-audit/scaffolds/add-audit-db/add-audit-db.mjs';
import { homedir } from 'node:os';
import path from 'node:path';

const result = await run({
  options: { world: 'laptop' },
  context: { rab_home: path.join(homedir(), '.rab') }
});
console.log(result);

DEFAULT OUTPUT
<executing-user-home>/.rab/worlds/laptop/audits/audits.sqlite
On PIXEL: C:/Users/pixelcommander/.rab/worlds/laptop/audits/audits.sqlite

CUSTOM LOCATION
Set options.path to a LOCAL destination DIRECTORY; the tool appends audits.sqlite.
Example: options: { world: 'laptop', path: 'D:/rab-data/laptop/audits' }
The UI currently reads the default laptop location; custom output does not automatically reconfigure the UI endpoint.
Do not give path a report filename or a network share.

WHAT THE SCAFFOLD DOES
Checks the existing world's settings.json, validates a local destination including realpath,
creates the database exclusively if missing, creates schema v2 in a transaction,
and records the world in audit_meta.
If the file exists, opens read-only and verifies schema version, exact schema,
world identity and SQLite quick_check. It does not overwrite existing records.
Return status is created or existing, with path, world, schema_version and tables.
A mismatch throws an error; do not delete an existing database just to clear that error.

VERIFY
Expect schema_version: 2 and tables:
audit_meta, runs, folders, folder, run_folders.
Calling the scaffold again with the same options should return existing.
This initializes storage only. It does not scan the machine, populate a map,
start the UI, or create a fake history record.

POPULATING THE MAP
The runner executes folder-list with explicit context.rab_home for this machine.
Its completed report is imported with importFolderReport(databasePath, report)
from audit-runner/audit-store.mjs. The current UI reads that imported map.
Use a deliberate path/depth/exclusion choice before executing an actual scan.
See 04-tools and 03-database for the call contracts and stored result shapes.
