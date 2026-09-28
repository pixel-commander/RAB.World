RAB World Toolkit

Scaffolds create starting structures. Every scaffold owns a template folder containing the source files it stamps out.
Generators produce output from supplied inputs.
Group related tools when useful and keep nesting shallow. Use descriptive names without repeating unnecessary hierarchy.

The manifest identifies public tools. Preserve tool IDs when relocating tools and keep references pointed at the owning implementation.
Tools may call other tools independently of folder nesting. Keep one active implementation per tool.

Resolve destinations from the supplied inputs and current context; never assume a particular machine or drive.
Box-owned records, backups, and test output belong in the executing user's .rab.
