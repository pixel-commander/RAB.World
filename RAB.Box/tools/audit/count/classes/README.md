# Count and map classes

Box command: `count classes`

Tool address: `count-classes` (`audit/count/classes`). The only input is `folder`.
The runner fills it from the loaded audit project's `settings.paths.folder` when
omitted. An explicit folder uses the same runner validation. The audited folder
is read only; the existing report writer and session tracking save in the `.rab`
project.

This composite calls `find-class-definitions` and `find-class-names`. It builds
one index across both results, preserving exact spelling and case. A row looks
like this:

```json
{
  "name": "panel",
  "count": 3,
  "definitions": 1,
  "usages": 2,
  "files": ["App.tsx", "theme.css"],
  "locations": [
    {"file":"App.tsx","line":8,"column":15,"kind":"class-usage"},
    {"file":"App.tsx","line":14,"column":9,"kind":"class-usage"},
    {"file":"theme.css","line":3,"column":1,"kind":"class-definition"}
  ]
}
```

`unique` is the number of distinct names across both searches. `count` is the
number of occurrences (definitions plus usages), including repeated tokens in
one attribute. `counts` is sorted by occurrence count, then name. Each file
appears once in a class's `files`; `locations` preserves every occurrence.
Paths are relative to the absolute result `folder`. Assignment locations identify
the beginning of the attribute/property, including multiline values.

CSS-family files (`.css`, `.scss`, `.sass`, `.less`) supply class selectors in
brace-delimited rules. Comments, strings, declaration values, attribute-selector
values and at-rule conditions do not supply definitions. Escaped CSS identifiers
are decoded, so `.hover\:active` maps to `hover:active` in an assignment.
Preprocessor-generated selectors and indentation-only Sass are not expanded.

The assignment search scans UTF-8 text files, including templates, for
`class*=` (such as `class`, `className`, `classNames`). It splits values on HTML
whitespace and supports quoted/unquoted attributes, literal JSX expressions,
DOM className assignments and complete static tokens in interpolated templates.
JS/HTML/CSS comments are ignored where recognized. This is static source search:
markup examples in text can match, and classes created by runtime expressions,
classList calls, spreads, CSS modules or bindings are not resolved. Unresolved
matched assignments are listed in `unresolved`, counted separately, and never
guessed. `count-class-usage` remains the assignment-only aggregate.

The shared walker excludes dependency/build/cache directories at every depth;
the precise names are returned in `scope`. Binary/non-UTF-8 files and file-read
errors are listed in `skipped`. Child evidence snippets are limited to 180
characters so a long source line is not repeated in full for every class.
