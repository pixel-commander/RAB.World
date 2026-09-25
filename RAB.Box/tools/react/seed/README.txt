New React project flow

1. Ask for the project name and parent folder.
2. Ask "Add a UI kit?" and confirm the complete choice.
3. Create the marked React project from react/add/new/project/template.
4. If yes, run react/seed/stamp-ui-kit using stamp-ui-kit/template.
5. In either case, run react/seed/finalize-ui-kit and verify temporary
   data-rab-kit-* markers are gone from React JSX/TSX source.

The UI-kit template is intentionally empty until its owner supplies folders
and files. Its layout is project-relative and can contain any folder names.
An empty template or a conflict with the base stamp fails before project
creation. The seed never overwrites an existing file.

Use data-rab-kit-class="token" for temporary UI-kit class selection in JSX.
When seeding, the final pass merges token into a literal className; when
declined, it removes the marker without adding the class. Keep data-area and
data-rab-seat: they are permanent editing targets, not UI-kit markers.
Grid layout leaves created by react/apply/grid-layout are div elements.
