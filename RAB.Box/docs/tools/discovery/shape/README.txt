WHAT IDENTIFIES A TOOL
=====================

Example folder shape, relative to a scanned tools tree:

  tools/react/components/add/
    settings.json
    add.mjs

settings.json needs the house keys:
  { id, name, title, description, settings, meta }

name matches the folder leaf; title and description are nonempty. settings is
the input declaration array, and meta is an object. IDs follow the shared
observed-timestamp rule; a renamed or moved tool keeps its identity. Declared
domain/operation/target metadata must agree with recognized path meaning.

The executor is <leaf>.mjs or the nearest parent <folder>.mjs within the same
tools tree. The execution contract is run({options, context, tool, helpers, ...}).
Discovery checks the definition and executor path without importing or running
the executor. contract.json can add declarative source/result information;
it does not automatically validate the runtime result.

template/ makes a tool a Stamp internally. Semantic scaffold names do not need
a stamp- prefix. If the name does start with stamp-, template/ is still required.
See ../../scaffolds/README.txt and ../../generators/README.txt for authoring.

Source: ../../../../bridge/tool-house.mjs (validateTool, nearestExecutor, scan),
../../../../bridge/tool-contract.mjs (loadToolContract).
