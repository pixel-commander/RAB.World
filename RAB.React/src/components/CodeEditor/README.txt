CodeEditor
==========
Ported from C:\stand-alone-react\src\components\CodeEditor.
Component structure follows the current new-component stamp.
CodeEditor.tsx owns markup; CodeEditor.types.ts owns types; hooks/useCodeEditor.ts owns mutable behavior; js/code-editor.ts owns tokenization and line diff helpers; css/code-editor.css is internal.
React is supplied by the host. There are no external project imports, so settings.paths is omitted.
The original host CSS tokens and container-inset skin are retained; a host without them will need to supply them.
Demo is an isolated usage example; it is not installed into the project app.

styler defaults to main. CODE_EDITOR_STYLERS.main supplies container-main; stylers.container overrides that slot, including an empty string to remove its skin.
