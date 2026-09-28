WORLDS

A world represents one computer/user instance on that machine. It holds the
shared information that projects can refer to, so each project does not need
its own copy of the same knowledge and definitions.

Its saved root is .rab/worlds/[name] under the user's home. On this machine:
  C:\Users\pixelcommander\.rab\worlds\[name]

Each world has settings.json with its name, numeric ID, title, description,
creation date and paths. paths is an array so repeated folder roles do not
have to compete for a single key such as components.

The new-world scaffold lives at:
  RAB.Toolkits/rab-world/add/new/world
Its template/ supplies the initial files. Only a name is required; the shared
Box owners allocate the ID, resolve storage and verify the generated files.
It creates a world record, not a React application or a running scanner.

The existing non-React project tool is base/stamp-new-project with type
magic-box. Projects have their own .rab/projects/[name] records. A world
provides shared context for those projects; creating a world does not move
existing projects into it. Project-to-world linking remains to be defined.

beacons explains folder declarations used to announce indexing participation.
view describes the interface for working with world information.

This local world record does not replace the server-owned house registry.
The scaffold exists but rab-world is not yet registered in Box's tool picker.
