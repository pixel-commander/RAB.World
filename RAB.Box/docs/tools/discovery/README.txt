HOW A TOOL BECOMES DISCOVERABLE
==============================

A tool becomes discoverable through its folder and settings.json. Tool House
scans those definitions, validates them, and puts available tools in its catalog.

Put it in a scanned location, follow the tool shape, then refresh discovery.
You do not need to edit the bridge for each new tool.

Read the part you need:
  locations/README.txt  - where the Box looks, including external toolkits
  shape/README.txt      - the files and house keys that identify a tool
  refresh/README.txt    - loading additions and explaining unavailable tools
  matching/README.txt   - how the Box connects a chat request to a capability

Chat matching uses the folder path, name, description, metadata, and language
rules. Being discovered does not guarantee every natural-language phrase will
match it, or prove that its implementation works.

Current-code correction to the earlier chat explanation: template/ determines
the internal Stamp kind. A scaffold no longer needs a stamp- name prefix. A
folder that does use stamp- still requires template/ in the current validator.

RULE.txt is the compact model-facing companion. These are focused explanations,
not a tool inventory or a second registry. Current source was checked in the
server project on 2026-09-21; no runtime behavior was changed.

Source: ../../../bridge/tool-house.mjs (scan, listTools, findTools).
Related authoring guide: ../README.txt.
