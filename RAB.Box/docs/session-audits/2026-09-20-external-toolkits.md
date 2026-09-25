# External toolkits and React project overrides

Implemented in the Box at `C:\Users\pixelcommander\Desktop\RRAABBIITT_v0.9.3`.
Toolkit: `C:\magic-box-tools`. No server originals were modified.

## What is available

- General external Tool/Stamp discovery through the existing Tool House and runner.
- Optional per-project `custom_toolkit_path` in the project's own `settings.json`.
- Optional Box-wide `TOOLKITS.json` links, managed by `scripts/toolkits.mjs`.
- Explicit project overrides pinned by numeric tool ID, relative path and numeric toolkit ID.
- Project-aware catalog, search, chat, preparation, and nested runner lookup.
- Duplicate identities/paths quarantined with provenance; no implicit toolkit overwrite.
- Toolkit provenance in execution records and result descriptions.
- Same-turn fresh discovery for component-seed selection.

The first toolkit supplies seven capabilities:

| Path | Responsibility |
| --- | --- |
| `react/projects/stamp-rraabbiitt` | New React project skeleton and seed orchestration |
| `react/grid/seed/stamp-baseline` | Grid and layout vocabulary |
| `react/atoms/seed/stamp-baseline` | Baseline atom skins and theme tokens |
| `react/hooks/seed/stamp-use-url` | Existing useURL hook |
| `react/components/seed/stamp-site-chrome` | SiteChrome and its nested SiteNav |
| `react/components/list/seeds` | Refresh and list available component seeds |
| `react/components/seed/selected` | Validate an array and run its selected seed children |

This does not claim the entire `seed-factory/ui-components` library has been
converted. New atom/component add-new stamps are still future additions.
Components own their folders; the template layout keeps component structure
separate from atom skins. The copied action atoms support matching `:active`
and `.is-active` styling while retaining semantic ARIA state.

## First project in the Box

An already-running Box backend needs to load the changed code on restart.
No shared service was restarted during this work.

In Toolbox, select **New Rraabbiitt React Project**, provide a lowercase kebab
name and an absolute parent folder. Its `custom_toolkit_path` defaults to its
own external toolkit. The generated project saves that path and a pinned
`new-react-project` override. Choosing a different toolkit for this particular
adapter is rejected before writing because it would break that saved pin.

An ordinary unconfigured project still resolves the original house stamp.
Full paths and numeric IDs remain explicit implementation choices. Only flat
aliases participate in project substitution. Existing dashboard child paths
were not implicitly redirected. The base project-creation conversation now
delegates through the type's flat alias and retains the selected project.

The full authoring contract is in
[the toolkit guide](../help/tool-kits/external-toolkits/README.txt).
The external kit also has its own RULES.txt and per-tool README.txt files.

## Verification and preserved evidence

- Final broad suite: **599 passed, 0 failed, 0 skipped** in
  `2026-09-20-external-toolkit-full-tests-final.txt`.
- A final derived-alias shadow-identity correction landed after that broad
  suite started. The complete affected discovery/registry/override suite was
  then run against the final code: **26 passed, 0 failed, 0 skipped**, in
  `2026-09-20-external-toolkit-final-focused.txt`. These counts overlap and
  must not be added together as independent cases.
- Project conversation/migration checks: **35 passed**. Chat, search and
  preview override, context isolation, metadata contracts and mid-turn
  refresh were also covered by the focused fix checks: **26 passed**.
- Actual external stamp execution produced a React application at
  `C:\Users\pixelcommander\.rab\temp\test\1830000000043\react-toolkit-proof`.
  `npm ci --ignore-scripts --no-audit --no-fund` and `npm run build` passed;
  TypeScript checked and Vite built 44 modules. Output was inspected for
  settings, grid, atoms, component, page, hook and keyring files.
- The proof's six runner tasks each have status and provenance, with saved
  execution records and parent/child relationships. The project pin selected
  external tool `1830000000036`, shadowing house tool `1790000000300`.
- Re-running into the same project was refused with `EEXIST`.
- Invalid names, a mismatched toolkit path, duplicate component selections
  and unavailable component seeds were rejected. Their expected failures are
  recorded in `2026-09-20-external-toolkit-negative-cases.json`.
- All **40 original template files** were rehashed and matched the imported
  source hashes. `C:\magic-box-tools\SOURCE_IMPORT.json` records their source
  paths and destinations. No standalone factory maker/settings.js executed.
- `scripts/sync-toolbox-output-shapes.mjs --check` passed.

The complete real-run proof, returned artifact SHA-256 checks, task records,
and original-source checks are saved in:
`C:\Users\pixelcommander\.rab\temp\test\1830000000043\proof.json`.
Install/build logs are beside that file. The Box-side pointer is
`2026-09-20-react-toolkit-proof.json`. Current changed Box files and toolkit
files are fingerprinted in `2026-09-20-external-toolkit-files.json`.

Write-tool artifact verification is returned in tool results; the existing
runner saves execution records. The proof explicitly preserves the full
returned write results. Existing audit-only report persistence was not
redefined as a general write-result store.

## First failures and repairs

1. The first targeted run passed 17 of 18 checks. Its failed assertion wrongly
   expected an audit result file for a non-audit project. The corrected test
   verifies the saved execution records and the actual returned child result.
2. The first import hit Windows `EPERM` when the shared artifact writer tried
   recursive mkdir on the already-existing `C:\` parent. No toolkit files had
   been written. The writer now checks an existing parent before creating it;
   the same import then succeeded.
3. The first broad suite passed **594 of 596**. One assertion expected the old
   qualified delegation path; it now verifies the flat alias and actual child
   implementation. One output-contract test caught undocumented provenance
   fields; the owner descriptions were updated and checked against output.
4. Read-only review caught first-linked-wins toolkit identities, canonical
   unlink mismatch, disconnected disable failure, an unchecked 65th link,
   and an external traversal error escaping the source boundary. These were
   repaired and regression cases were added where filesystem fixtures apply.
5. Review also caught the more important chat gap: raw house ranking could
   beat a valid project override. Effective project aliases now govern
   semantic selection, and chat/search/preview behavior was tested end to end.
6. Copied adapter review found malformed kebab names and an incompatible
   custom toolkit selection could break the generated project's saved pin.
   Both now fail clearly before writes, in both the copy and import source.

## Review boundary

This task implemented the feature and ran the filesystem, runner, build and
regression checks. **Review audit stamps** provided an independent read-only
review; it did not implement these edits or run the full fixture/build suite.
Original source authorship remains with the pre-existing factory templates.

No live browser visual acceptance was performed. Refresh is explicit, not a
filesystem watcher. Component arrays currently use the existing JSON input
and list tool; a richer selection UI is not part of this implementation.
No productivity percentages or weaker/local-model equivalence are claimed.
