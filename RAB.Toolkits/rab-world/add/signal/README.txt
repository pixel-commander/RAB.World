ADD SIGNAL

Source: rab-world/add/signal. signal.mjs is the executor; the tool's permanent
ID is unchanged by its move. Destination validation remains shared with the
beacon tool through ../../paths/_destination.mjs.

Required inputs: name and path. ID is automatic. Optional title defaults to
name; description and type default to empty text; transmitting defaults to
true. A supplied false remains false. type is free text, such as component,
atom or function; it is not the beacon's list of broad content categories.

path is the final folder, not a parent to which name is appended. With a
selected world, its root is prepended to the relative path. Without one,
provide an absolute path. Box currently supplies selection as context.project.

template/ owns settings.json, contract.json and README.txt. The tool creates
missing folders and preserves existing files. A collision with any of the
three filenames is rejected before writing; other files may already exist.
Returned output includes the shared writer's verification receipt.

The generated contract describes the signal. The outer contract describes
this tool. Generated settings retain settings/meta for the common item
contract; the shared owner also supplies indexed, which is separate from
transmitting. No scanner or signal implementation is created by this tool.

The public discovery wrapper is at ../../tools/world/add/signal and delegates
to this implementation. This source follows the runner's form and execution
contracts; it does not change other stamp types.

Verification: set RAB_BOX_ROOT to the Box source root, then run
node --test signal.test.mjs from this folder.
