TOOLKIT PATHS
=============

A toolkit is a separately located collection of tools. Link its folder instead
of duplicating its implementation into another tools tree. RULE.txt is the
compact model-facing companion to this guide.

What belongs in that folder?
----------------------------
A toolkit root owns settings.json and a real tools/ directory. Its settings use
the house keys id, name, title, description, settings, and meta. The name is
lowercase kebab-case; meta.kind is toolkit. Individual tools beneath tools/
follow the authoring guides in ../../tools/.

How is it linked today?
-----------------------
The current loader reads installation-root TOOLKITS.json:
  {
    "version": "toolkit-links/v1",
    "toolkits": [{ "path": "C:\\example-toolkit", "enabled": true }]
  }

That path is illustrative, not a registered location. It points to the toolkit
root, not its tools/ child. The current contract requires an absolute path
accessible to the process running Box. Use the existing updateToolkitLink owner
in bridge/toolkit-links.mjs for registration changes rather than a second writer.

Project-specific discovery reads custom_toolkit_path from settings.json at the
selected project's source root. It accepts an absolute toolkit-root path;
absent, null, or empty means no project-specific toolkit link.

This describes current source configuration, not permission to relocate Box
records. User sessions/results/logs stay in user-home .rab. The proposed project
toolkit inventory is not the same thing as a source toolkit or its link settings.

What should we check?
---------------------
Keep identity stable when a toolkit moves; update its link for the new machine.
A server drive letter is not a laptop drive letter. A network share still runs
code on the calling machine unless execution is explicitly remote.

Refresh discovery after linking. Inspect unavailable diagnostics; a stored link
alone does not establish that tools load or execute. The loader validates root
metadata and a contained, non-symlink tools directory. Tool roots must not overlap
the built-in tree or another discovered source.

Missing, disabled, malformed, or ambiguous toolkits are not reasons to silently
copy tools, invent fallback paths, or migrate old records. Report the exact issue.

No toolkit inventory or counters belong in this README. Check the actual links
and current discovery. This document changes no registration or runtime behavior.
