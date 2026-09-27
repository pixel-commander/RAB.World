FloatPanel
==========
Ported from C:\stand-alone-react\src\components\FloatPanel using the current component stamp.
FloatPanel.tsx owns markup; FloatPanel.types.ts owns types; hooks/useFloatPanel.ts owns drag/resize/collapse behavior; js/float-panel.ts owns edges and clamping; css/float-panel.css stays internal.
React is supplied by the host. No external project modules are imported.
Skin: container-main, imported through src/css/style.css. Shared theme tokens are installed. Missing host styles: resizable and resizable__handle (source src/css/resizable.css).
settings.paths is omitted until actual dependency signals are registered; no IDs are fabricated.
The demo is not wired into the RAB.React app.

styler defaults to main. FLOAT_PANEL_STYLERS.main supplies container-main; stylers.container overrides that slot, including an empty string to remove its skin.
