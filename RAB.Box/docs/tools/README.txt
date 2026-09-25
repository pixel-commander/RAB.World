ADDING TOOLS TO THE BOX
======================

This is the human guide. RULE.txt beside it is the compact model-facing contract.
scaffolds/ and generators/ each have their own README.txt and RULE.txt.
For how the Box finds a new tool, start at discovery/README.txt.

Pick the shape
--------------
A scaffold fills or copies a predefined template/ tree. The runtime calls it a
Stamp. A generator builds code programmatically without template/. A tool that
changes existing code may be called a codemod. Not every non-template tool is a
generator: auditors and readers can have the same physical shape.

Both use the same shared runner. These categories do not introduce new runners.

Start with the existing creator
-------------------------------
Use base/stamp-new-stamp for scaffolds, or base/stamp-new-tool for generators.
Read the matching folder's guide before using it. These creators make shells,
not finished behavior. Confirm the installation and destination before execution.

Every tool has settings.json:
  { id, name, title, description, settings, meta }

The ID is permanent; name matches the folder leaf. settings is the array of run
inputs. meta describes meaning and authority. Path meaning and metadata must agree.
Use an observed timestamp through the shared ID owner, not a counter or highest-ID
seed. Check for duplicate identities; keep the identity when moving a tool.

Declare required inputs, useful descriptions, and deliberate defaults. enum
enforces choices; an options list alone does not. Validate paths, names, nested
data, and cross-field conditions in code. Preserve valid false, zero, and empty
optional strings.

Implement run({ options, context, tool, root, toolsRoot, helpers }) in a matching
leaf-name.mjs, or inherit an existing nearest-parent folder-name.mjs executor.
Add contract.json describing the actual source and result shape. This supplies
Toolbox previews, not automatic runtime result validation.

Questions and composition
-------------------------
The runner reports missing required inputs to the Workbench/session layer.
Conditional questions use INPUT_REQUIRED and must name declared fields. Ask
before writing; safe_to_resume is not rollback. A retry executes again.

Call other public tools through helpers.runTool({ key, options }); inspect
child.result. Do not bypass tracking by importing their executors directly.
Shared private implementation helpers can be imported normally.

External toolkits receive shared helpers from the runner: renderTemplateTree,
writeArtifactPlan, runProjectStamp, runReactComponentStamp, resolveProjectFolder,
and inspectUiKitTemplate. The project/component helpers bind the current inputs
and context; resolveProjectFolder binds the current context. Keep these engines
in Box instead of copying them into a toolkit or importing through machine paths.

Return useful findings or artifact evidence and provided.seats for downstream
values. Preserve tool-specific detail instead of forcing everything into a tiny
shape. Throw on execution failure; a returned failed status alone does not fail
the runner. Report partial writes honestly.

Where things belong
-------------------
root means Box code; context.project.root means selected project source.
Tool implementation belongs in its intended tools tree. Generated application
files belong in selected source. Box records, sessions, requests, results, logs,
backups, and test output belong under the executing user's home .rab.
Use the memory owner to resolve project records; do not guess folders from IDs.
A server share does not make a locally invoked script execute on the server.

Before writing, validate containment, links, existing targets, and overwrite
policy. Reuse tools/_artifact-plan.mjs where appropriate. Its protections are
not automatically supplied by the runner. Test any claimed dry_run behavior.

How to finish
-------------
Refresh discovery with listTools({ fresh: true }); inspect unavailable diagnostics.
Test missing/bad inputs, defaults, false/zero/empty values, unsafe paths, existing
files, errors, and nested calls. Use isolated fixtures under user .rab. Read the
actual output and build/typecheck/test when applicable. Verify the Toolbox form
and a realistic Chat request: discovery does not guarantee phrase recognition.
New vocabulary may require changes in the existing language/planner owners.

No inventories here
-------------------
WE DO NOT INDEX OR COUNT SHIT IN THE README. EVER.
Duplicate inventories and counters cause drift and wobbles. Use current discovery;
link to an authoritative generated index once its feature exists. The proposed
tools/settings.json rescan feature is not implemented by these docs. Keep test
totals in reports, not READMEs.

Further reading
---------------
tools/README.txt explains discovery conventions.
docs/domains/tool-contracts.md explains output contracts.
docs/process/runner.md explains the runner, but contains stale path/ID details.
bridge/tool-house.mjs owns discovery/binding/execution; bridge/rab-memory.mjs and
bridge/rab-id.mjs own storage and ID reservation.

Current project instructions govern. Do not add backward-compatibility fallbacks.
Migrations need explicit authorization. These documents change no runtime code.
