ADDING A GENERATOR
==================

A generator produces code from inputs without template/. It is an ordinary Tool.
A tool modifying existing source may be called a codemod.
Read ../README.txt for shared behavior; RULE.txt here inherits ../RULE.txt.

Use base/stamp-new-tool (New Tool). Supply a semantic path such as
react/create/example, title, description, settings, and meta. Optional address
sets a flat alias; inherit_executor uses an existing nearest-parent executor.
The creator has a mold for the shell; the generated tool has no template/.

The intended shape is:
  tools/react/create/example/
    settings.json
    example.mjs
    contract.json

Do not use a stamp- leaf name. Replace placeholder run() with the actual
algorithm. Define inputs, output files, permitted edits, and returned evidence.
For edits, use structure-aware handling when needed, not blind replacements
that can affect the wrong component/import/expression.

Reuse shared helpers. An inherited executor receives the selected leaf's
metadata; verify it really supports that behavior. Public children run through
helpers.runTool, not direct executor imports.

Declare inputs/defaults; validate paths, names, nested values, existing targets,
and conditional requirements before writing. Ask for missing information before
mutation. If dry_run is offered, prove it writes nothing.

Add contract.json; source.kind is usually internal, or composite where accurate.
Describe the actual result and return provided.seats for downstream values.

Refresh discovery and inspect diagnostics. Use isolated fixtures under user .rab;
exercise malformed/missing/default inputs, unsafe/existing targets, failures,
and nested work. Inspect actual generated/edited source, then build/typecheck/test
where applicable. Verify Toolbox inputs and a realistic Chat request too.

Current creator limits
----------------------
New Tool creates a shell, not an algorithm. It does not generate tests or
contract.json. It can write an alias into existing PATHS.json. Its ID setup
enrolls only the highest discovered catalog ID, not the full discovered set;
review this before relying on creation as an approved end-to-end workflow.
Do not reproduce that limitation in new code.

No tool inventory or counters belong in this README.
