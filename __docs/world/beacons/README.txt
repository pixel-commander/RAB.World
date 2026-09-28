BEACONS

A beacon calls attention to a folder so an updater can maintain its index.
The declaration is beacon.json inside that folder. Creating the file alone
does not run an updater; beacon discovery is still to be connected.

The scaffold is RAB.Toolkits/rab-world/paths/beacons, with its own template/.
Only name and path are required form inputs. ID and date_added are automatic.
Optional title defaults to name, description to empty text, types to an
empty array, beacon to on, and reach to ["world", "project"].

With a world selected, its root is prepended to the relative path. Without
one selected, enter the full absolute folder path. The tool writes beacon.json
there and never replaces an existing beacon.

types can contain ui, docs, tools, audits and functions. These are selectable categories,
not values that must all appear in every beacon. reach declares scanner
visibility using the exact words world and project. It defaults to both.
Whether project means the owning project or all projects remains undecided.

Each beacon has a separate identity, so two components folders can coexist.
The current Box form uses JSON-array inputs for types and reach.
