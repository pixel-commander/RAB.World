ADDING A SCAFFOLD
================

A scaffold starts with a mold in template/. The Box calls it a Stamp.
Read ../README.txt for shared tool behavior; RULE.txt here inherits ../RULE.txt.

Use base/stamp-new-stamp (New Stamp). Supply type, name, title, description,
and optional settings and meta. For React choose type react. The creator adds
stamp- if needed. It currently creates a flat tools/<type>/<stamp-name> folder,
not the nested path accepted by New Tool.

The intended shape is:
  tools/react/stamp-example/
    settings.json
    stamp-example.mjs
    contract.json
    template/...

Replace the placeholder template README with your mold files. Decide which
parts are fixed and which inputs fill names, imports, text, and paths. Do not
include secrets, machine-specific paths, or installed dependencies.

Replace the placeholder executor with real run() behavior. The runner does not
render templates automatically. Your implementation renders/copies, validates,
and writes to the approved destination. Reuse the artifact-plan helper where
appropriate and compose public children through helpers.runTool.

Declare inputs in settings.json and add contract.json describing actual outputs.
source.kind is normally template; use hybrid or composite when accurate.
Honor the target project's source/style rules, not assumptions from the mold.

Generate an isolated example under user .rab test storage. Read the files,
check substitutions and destinations, and build/typecheck/test where applicable.
Try missing inputs, invalid names, unsafe paths, and existing targets. Verify
discovery, the input form, and actual shared-runner behavior.

Current creator limits
----------------------
The generated executor returns template-not-implemented until replaced. The
creator does not produce tests or contract.json. It currently assigns Date.now()
directly rather than using shared reservation, and may return created with
check.visible false. These are gaps to fix during authorized code work, not
conventions to copy. A creation receipt alone does not establish readiness.

No tool inventory or counters belong in this README.
