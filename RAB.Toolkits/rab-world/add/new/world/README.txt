NEW WORLD SCAFFOLD

Creates .rab/worlds/[name] under the executing user's home. Only name is
required. title defaults to name; description defaults to empty text.
id is allocated by the shared owner; date_added is generated in UTC.
The caller does not choose an arbitrary storage root through the form.

world.mjs calls helpers.runWorldStamp. Box's shared memory owner resolves
the destination; its node, template and artifact owners create and verify
the output. template/ owns settings.json and the generated README.txt.
Existing world folders are never overwritten. Failures preserve any partial
write information reported by the shared artifact writer.

The world describes one computer/user instance and holds shared information
that projects can refer to. It is not a React application or a copied server
registry. paths starts as an empty array. This tool does not migrate projects,
select a world, register scanner roots, or start services.

Related existing project tool: base/stamp-new-project with type magic-box.
That tool owns local project records and delegates other project families
to their own stamps. Its folder input controls the project source location;
the shared memory owner keeps its saved record under .rab/projects/[name].

This scaffold needs the updated Box helper. Its public discovery wrapper is at
../../tools/world/add/new/world and delegates to this implementation.

Verification (PowerShell, from the Box source root):
  $env:RAB_WORLD_STAMP = 'C:\RAB.World\RAB.Toolkits\rab-world\add\new\world'
  node --test tests/world-stamp.test.mjs tests/identity-storage/rab-node.test.mjs
Generated examples are retained under the user's .rab/tests folder.
