CONVENTIONS AND OWNERSHIP
========================

Use the existing word for an existing meaning. A shared key is an address
between owners; renaming it downstream breaks self-similarity even when a
local piece of code still works. Promote new keys only after reuse proves
they belong in the shared vocabulary.

NAMES CARRY THEIR ROLE

  Component folder, export, TSX/types file   PascalCase: Button/Button.tsx
  Component stylesheet and root class       kebab-case: button.css, button
  CSS parts and modifiers                   button__label, button--compact
  Component hook                            useButton.ts
  Shared callback                           handleClick, handleSubmit
  Native DOM event socket                   onClick={handleClick}
  Atom family identity                      container-, action-, effect-, grid-

For React components, pages and dashboards, children nest inside the owner's
PascalCase folder. Structural CSS lives in css/, mechanics in js/, and a
multi-state system in hooks/. demo/Demo.tsx is a static exemplar; settings.ts
provides registration metadata. Omit empty optional files and directories.
These are the RAB UI rules, not a reason to reshape an unrelated project.

README FILES FOLLOW THE TREE

A parent's README.txt gives a very brief description of the folder and its
immediate children. It helps the reader choose a branch. Each step toward a
leaf becomes more specific. A leaf explains its owned contract, exact names,
small examples, relevant exceptions and how to verify the result.

Keep the exact reusable vocabulary in its owner. A house-keys.txt reference
can list those names beside the explanatory README, as handlers does. Point
back to the authoritative source and keep any copied key list in agreement.
Do not turn each parent README into another copy of its descendants.

BUILD AND VERIFY WITH THE OWNER

Read the current rules and applicable stamp before building. Reuse its shape;
fix an incorrect stamp at its owner within the authorized task. When anatomy
changes, its rules and stamp must agree. After a stamp change, generate and
inspect an example. A successful exit alone does not establish correct output.

Keep one implementation per shared responsibility and let composites call it.
Existing violations are migration work, not examples to copy. Record evidence
and distinguish the intended rule from behavior that has actually been checked.

SOURCES
  ../../../ganglion/coding/css/oocss/RULES.txt -- H1-H4, P1-P7, R7, S7, ST1-ST3, M1
  ../../../HouseKeys.types.ts
  README hierarchy: user's documentation instruction, 2026-09-22.
