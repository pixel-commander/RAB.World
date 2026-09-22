RAB.BOX PROJECT KEYS
===================

Box applies the house vocabulary to its runtime nodes and saved project work.
Its node contract is stricter than the optional DataKeys vocabulary: a saved
node must satisfy its owner's validation.

COMMON NODE KEYS

  version        "rab-node/v1" for the current node format.
  id             Positive numeric timestamp from the shared ID owner.
  name           Nonblank short name.
  title          Nonblank display title.
  description    String; an empty string is allowed.
  settings       Array of named, typed input declarations.
  meta.kind      Node role: app, project, session, request, group, step,
                 turn, execution, receipt or failure.
  meta.parent    Optional typed reference: { kind, id }.

An item descriptor or toolkit is not automatically one of these runtime node
roles. Use the item validator for item settings and the node validator for
nodes. Do not manufacture a new meta.kind merely to fit a folder name.

PROJECT KEYS

  meta.kind: "project"   The record's role in Box.
  type                   Nonblank project type; separate from its node role.
  paths                  Object of named locations owned by this project.

Components, pages, atoms and tools can be named collection paths. A path value
may be a string or an object carrying path and descriptive metadata. After
registration, saved project settings are the runtime path authority; scaffold
settings describe initial defaults. Preserve metadata when updating a path.

Do not confuse project type with the optional second argument of a UI handler.
The key is interpreted within its own contract; there is no universal object
that merges all these domains.

CONFIGURATION AND WORK HISTORY

Box-owned saved work lives under the executing user's .rab home. Actual source
edits belong in the selected source project. Within saved project memory:

  settings.json             Project configuration and named paths.
  sessions.json             Derived map of session summaries.
  sessions/<id>/settings.json
                            Session identity and typed project parent.
  sessions/<id>/state.json   Session bag, groups, steps, turns and state.
  runs/<session-id>/        Separate execution records.
  manifests/<collection>/manifest.json
                            Derived collection of identified source items.

Session history is not embedded in project settings. A session's numeric ID
is its identity; its name is a label and can repeat in another project.
Selecting a saved session does not mean replaying completed tools. Saved
records and descriptions do not grant permission to execute them.

DEFAULTS AND EVOLUTION

Guard input, preserve supplied values and keep defaults with their owner.
Use the current format. When a contract changes, an authorized migration must
preserve original records; do not silently rewrite history or add another
runtime path just to accommodate old data.

SOURCES
  ../../../../RAB.Box/bridge/rab-node.mjs -- node and item contracts
  ../../../../RAB.Box/AGENTS.md -- storage, identity and migration rules
  ../../../../RAB.Box/docs/process/project-inventory.md
  ../../../../RAB.Box/docs/process/sessions.txt
  ../../../../RAB.Box/docs/process/session-storage.md
