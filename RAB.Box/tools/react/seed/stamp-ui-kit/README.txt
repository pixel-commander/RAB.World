Place project-relative files and folders under template/. For example,
template/src/components/Card/Card.tsx becomes <project>/src/components/Card/Card.tsx.
No folder names are hard-coded. Empty folders are created too. Existing files
are never overwritten; collisions fail the seed. The template itself is never
modified. An empty template cannot be selected during project creation.
