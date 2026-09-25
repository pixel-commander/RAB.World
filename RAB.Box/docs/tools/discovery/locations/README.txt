WHERE TOOL HOUSE LOOKS
=====================

Built-in tools live beneath the Box installation's tools/ folder. Tool House
walks nested responsibility folders, so a deep semantic path is supported.

External tools live beneath a linked toolkit's tools/ folder. Box-wide links
come from installation-root TOOLKITS.json. Project-specific links come from
custom_toolkit_path in the selected source project's settings.json.

The link points to the toolkit root. That root needs its own settings.json
with house keys and meta.kind=toolkit, plus a contained tools/ directory.
See ../../../paths/toolkits/README.txt for the existing link contract.

Only configured roots are scanned. The scanner skips template/, node_modules/,
.git/, .rab/, and symbolic-link directories. Merely creating a folder elsewhere
on disk does not make it available. Project-local PATHS overrides are explicit
addresses; they do not make every project directory a scanned toolkit.

Paths must be accessible to the machine running Box. A server drive letter
must not silently be treated as the laptop's drive letter.

Source: ../../../../bridge/tool-house.mjs (toolDirectories, scan),
../../../../bridge/toolkit-links.mjs (readToolkitLinks, readProjectToolkit).
