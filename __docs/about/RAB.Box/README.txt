RAB.Box
=======

PURPOSE
RAB.Box is the input box that turns words into tools into deterministic
output results. This is the user's definition of its role in RAB.World.

HOW IT FITS
The human expresses intent in words. Box connects that intent to tool
execution and presents the results. RAB.Toolkits supplies tools that plug
into Box. The house's ganglion is intended to hold the skills required to
produce acceptable code; __docs holds the documentation and teaching material.

Deterministic output is the stated design target. It is not evidence that
every interpretation of words or every existing tool has been verified.

WHAT THE EXISTING PROJECT DOCUMENTS
The current source describes a shared Tool House runner. Everything
invokable is a Tool; a Stamp is a template-backed Tool. Composite tools call
child tools through the shared runner instead of duplicating their engines.
Tool discovery reads metadata and output descriptions from their owners.
An output description alone does not prove a tool's actual behavior.

Box-owned settings, sessions, requests, results, logs, backups and test
output belong under the executing user's home .rab directory. Actual project
source edits belong in the selected project source folder.

The inspected TOOLKITS.json links to the React toolkit on Desktop-t72isdi.
The presence of C:\RAB.World\RAB.Toolkits does not by itself connect that
local copy to Box. Runtime connectivity was not tested for this document.

PLACE IN THE HOUSE
RAB.World is the baseline for self-similar contracts, house keys, naming,
code style and Box interface testing. Box is the execution-facing part of
that project. LLM reviews and verified behavior can supply material for
training, with their evidence and provenance retained.

BASIS AND LIMITS
Based on the user's definitions in this task and these inspected files:
  ..\..\..\RAB.Box\AGENTS.md
  ..\..\..\RAB.Box\README.md
  ..\..\..\RAB.Box\TOOLKITS.json
  ..\..\..\RAB.Box\docs\domains\tool-contracts.md

This describes purpose and documented contracts, not a fresh runtime audit.
Keep live tool inventories with discovery and verification receipts in
reports; do not maintain copied catalogs or test totals in this README.
