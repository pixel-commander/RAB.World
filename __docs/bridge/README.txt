BRIDGE
======

bridge/ is the RAB.Box coordination layer between the UI/chat, selected
project, saved session state, and executable tools.

It plans turns, gathers required inputs and confirmation, resolves toolkits,
invokes tools, and records results in the executing user's .rab directory.

LAYOUT
------

Keep RAB.Box/bridge flat for now. Its modules are direct collaborators inside
one coordination boundary, not separate feature-owned tool folders.

PROJECT CREATION
----------------

The generic new-project chooser belongs in bridge/project-conversation.mjs.
It selects among React, HTML, Audit, and Magic Box project types, then
delegates to the selected creator.

React-only creators belong in RAB.Toolkits/rab-react-kit/ui/scaffolds.
Putting the generic chooser in that toolkit would make shared project
selection incorrectly React-owned.

WORKING PARTS
-------------

project-conversation.mjs owns project selection and the generic new-project
conversation. session-planner.mjs turns user text into planned steps.
seat-parser.mjs and seat-reducer.mjs interpret and reduce structured turn
state. tool-house.mjs discovers, validates, and runs Box tools and linked
toolkits. toolkit-links.mjs reads TOOLKITS.json and resolves each enabled
toolkit's declared scaffold root.

service.mjs owns the HTTP-facing saved-run adapter. rab-memory.mjs,
rab-folder-records.mjs, rab-id.mjs, and rab-memory-lock.mjs own user-local
.rab records, identities, and write coordination. language.mjs owns shared
language-resource lookup and import.

TOOL BOUNDARY
-------------

Bridge does not implement project artifacts itself. It invokes tools through
tool-house.mjs. Box's built-in tools live in RAB.Box/tools. Enabled external
toolkits are listed in RAB.Box/TOOLKITS.json; the current React toolkit exposes
its creation leaves from RAB.Toolkits/rab-react-kit/ui/scaffolds.

The generic project chooser delegates by project type. For React it selects
new-react-project; that stamp creates the project from its local template and
can then use the React creation scaffolds. HTML, Audit, and Magic Box retain
their own creators under the Box-owned tool boundary.

RELATED
-------

Direct World Hands MCP actions, configured world location, and one/many
beacon manifest requests: ../world-hands/README.txt

The direct read actions route to toolkit-owned index functions without a
generic Tool House discovery round-trip. They do not create run records.

Operational bridge API and persistence details:
RAB.Box/bridge/README.txt
