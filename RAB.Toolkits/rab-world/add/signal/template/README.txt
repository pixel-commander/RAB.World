__TITLE__

This folder is a signal scaffold. settings.json describes its identity,
location, type and transmitting state. A signal can describe a component,
atom, function, tool or another item; this scaffold does not create that
item's implementation.

contract.json belongs to this signal. Fill in its actual inputs and outputs
as the implementation is defined. It is separate from the maker's contract.

transmitting defaults to true. Set it to false to declare the signal inactive.
A future beacon-aware scanner must honor that flag; this scaffold neither
starts a scanner nor changes the existing settings inventory's behavior.

Keep id stable. With a selected world, path is relative to its root;
without a selection, path is absolute. Generated settings also carry the
common settings/meta fields used by the existing item contract.
