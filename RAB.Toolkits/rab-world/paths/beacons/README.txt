FOLDER BEACON SCAFFOLD

settings.json owns the tool's form inputs, required fields and allowed choices.
The executor fills the beacon template and uses Box's shared identity and
artifact-writing helpers. Each generated beacon gets its own numeric ID.

Required inputs: name and path only.
Optional: title (defaults to name), description (empty), types (empty array),
beacon (on), and reach (["world", "project"]). Supplied empty strings and
empty arrays are kept.
Generated fields: id from the shared owner; date_added as a UTC ISO 8601
creation timestamp. Neither is a user-editable form input.
With a world selected, its source root is prepended to the relative path.
Without a selected world, supply an absolute destination. The beacon stores
its destination relative to the selected world when one is provided, otherwise
as an absolute location. Missing folders are created. Existing
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

Every scaffold owns a template folder containing its source templates.
The scaffold follows run({options, context, tool, helpers}).

Verification uses the scaffold's test module and the configured Box runtime.
Test artifacts belong under the executing user's .rab.
