HOW A CHAT REQUEST FINDS A TOOL
==============================

Once a tool is available, matching compares the request with its folder path,
name, title, description, input declarations, and metadata. Recognized path
segments and the existing language parser contribute meaning and ranking.
Conflicting domain, operation, or target meaning can reject a candidate.

A useful description helps the Box find a tool, but it does not train every
possible phrase. Being discovered does not guarantee every natural-language
request will match. Check a realistic request separately from the Toolbox list.

Tools can also be addressed directly by permanent ID or full tools-relative
path. PATHS.json provides explicit short addresses and project overrides;
unambiguous short addresses can also be derived from discovery. A normal tool
in a scanned tree does not need a hand-added registry entry to be discovered.

No bridge or UI switch needs a new hardcoded tool name for ordinary discovery.
If wording is not recognized, investigate the existing language/planner owners
instead of adding a second discovery mechanism or assuming the tool is missing.

Source: ../../../../bridge/tool-house.mjs (findTools, getTool),
../../../../bridge/paths-registry.mjs (pack, resolve).
