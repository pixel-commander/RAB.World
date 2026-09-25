# Class impact investigation

Run `audit/inspect/class-impact` (derived shortcut `inspect-class-impact`) with
`class_name`, one exact class token without a CSS selector prefix. Optional
`folder` takes precedence over the audit project's saved scan folder.

This tool calls `audit/count/classes` through the existing runner. It returns
`audit-evidence/v1`: flat entities, relations, findings, investigations,
conclusions and plans. Plans initially remain empty. File containment and class
token occurrences are observed; runtime applicability, component ownership and
dynamic consumers remain unresolved. Similar names do not prove shared purpose.

Each evidence reference names the class-index execution and a result-relative
JSON pointer. The saved report's task references locate that result, whether in
the root result or `child_results`. Reopen project-scoped report references
through the existing memory owner. Missing provenance is unknown; report and
description versions do not establish a scanner implementation revision.

For audit-type projects the existing runner saves the top-level read result and
all child evidence together in the selected `.rab` project, with separate
execution tracking. Calls without an audit project return a transient result.
No audit input files are written. Captured input hashes are not an atomic
filesystem snapshot; stylesheet differences between child scans remain visible.

Validate and test with:

```text
node --test tests/audit-evidence/*.test.mjs tests/class-index.test.mjs
```

Created using the existing `base/stamp-new-tool` mold in isolated staging,
then assigned a unique installed-house identity. No root registry was edited.
