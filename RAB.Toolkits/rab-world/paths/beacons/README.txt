FOLDER BEACON SCAFFOLD

settings.json owns the tool's form inputs, required fields and allowed choices.
beacons.mjs fills template/beacon.json and uses Box's shared identity and
artifact-writing helpers. Each generated beacon gets its own numeric ID.

Required inputs: name and path only.
Optional: title (defaults to name), description (empty), types (empty array),
beacon (on), and reach (["world", "project"]). Supplied empty strings and
empty arrays are kept.
Generated fields: id from the shared owner; date_added as a UTC ISO 8601
creation timestamp. Neither is a user-editable form input.
With a world selected, its source root is prepended to the relative path.
Example: C:\RAB.World + src/components saves
C:\RAB.World\src\components\beacon.json. Without a selected world, supply
an absolute folder path. The beacon stores a relative path in the first
case and an absolute path in the second. Missing folders are created. Existing
beacon.json files are never overwritten. Duplicate folder roles are allowed;
their beacons have separate identities and locations.

types selects zero or more of ui, docs, tools, audits, functions. These choices belong
to the tool's input declaration, not to every generated beacon. Box's current
form renders this field as a JSON textarea, not a multi-select control.
Example input: ["ui", "docs"]. Unsupported and repeated values are rejected.
beacon is an on/off dropdown, defaulting to on. The ID is not a form input.

reach declares scanner visibility. Its exact allowed words are "world" and
"project"; it defaults to both: ["world", "project"]. Whether "project"
means only the owning project or all projects is not yet decided. Do not
infer visibility rules from the name. The scaffold records this declaration;
scanner enforcement is not implemented here. The current form uses a JSON
array input. A supplied empty array is preserved, with its visibility meaning
also left to the future scanner contract.

The template is valid JSON; null/empty values are filled by the executor.
This scaffold only creates the declaration. It does not start a listener,
write a manifest, or change existing project records. Updater discovery of
beacon.json is not implemented by this scaffold.

This source is at rab-world/paths/beacons. Its public discovery wrapper is at
../../tools/world/paths/beacons and delegates to this implementation. The
scaffold follows the existing run({options, context, tool, helpers}) contract.

Verification (PowerShell, from this folder):
  $env:RAB_BOX_ROOT = 'C:\RAB.World\RAB.Box'
  node --test beacons.test.mjs
Test artifacts remain under the user's .rab/tests folder.

