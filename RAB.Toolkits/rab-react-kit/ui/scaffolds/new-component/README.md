# Component creation

This tool creates a structural React component with native div attributes and an optional canonical grid. Conversation input asks for the name, grid and container class. An empty grid or `none` skips the grid; an empty class skips skin. Optional display title, description, indexed and save_as_text inputs preserve supplied values.

Grid layouts and area names come from Box tools/html/add/grid/grids.json. Grid areas are default children, so supplied children (including false, zero and empty text) pass through unchanged. The default skin and the caller className are composed without losing the caller expression.

Class resolution reads the container-atoms manifest first. When its manifest is absent it inspects only the saved configured path. If no specific container-atoms path exists, the saved atoms path is used. An unreadable, unavailable or old-format index is an error, not evidence that the class is missing.

A missing class produces a resumable create decision. No drops the class. Yes asks for an available class-producing atom kind and its missing declared inputs. Choices are carried as atom_decisions[className] = {create, kind, options}. Container and action stamps supply classes; grid and effect stamps have different contracts and are not offered as class skin. All dependency inputs must be complete before any child runs through helpers.runTool. Direct programmatic callers may explicitly set ensure_atoms:false when atom resolution was already handled.

The component folder owns source, README.txt and settings.json with the common item fields and a plain numeric ID. Skipped class and grid metadata are omitted. Existing folders are never overwritten. The receipt exposes final component seats after child atoms, so later population targets the component file. Planned bytes are finalized before artifact verification.
