React UI Toolkit

React UI toolkit with semantic creation paths and the shared container-atom, action-atom, effect-atom and grid-atom types.

The toolkit root owns its identity and settings. Its tools directory contains
the react domain and the shared semantic folder structure.

Fill the empty tool folders with implementations using the current Box
authoring contract. add/new creates a new artifact; add/sub/component creates
a new component within a parent's folder; insert/component places an existing
component in rendered markup. The optional css subject holds styling tools.

The house atom types are container-atom, action-atom, effect-atom, and grid-atom.
Components own structure. Atoms own reusable skin; the grid owner supplies
registered layout structure. Keep framework-neutral logic at one owner.

Tool settings describe their inputs and authority. Tool contracts describe
their actual source and result. Empty placeholders have no public settings,
so they do not advertise unfinished tools to Box.

Connect this root through Box's existing toolkit link mechanism.
Discovery is explicitly refreshed by Box; a folder's presence alone does not
establish executable behavior. Keep README files about contracts and workflow.

Moved tools retain their numeric identities. Toolkit executors receive shared
helpers from Box; they do not import files using paths out of this toolkit.
Skin classes compose with component structure. Action atoms apply to interactive
elements such as navigation links and controls; semantic state and behavior
belong to the component. Effect and grid creation use the provided presets.
