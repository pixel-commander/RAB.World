LOCATIONS AND EXECUTION
House anchor: \\Desktop-t72isdi\c\rab
Code root: \\Desktop-t72isdi\l\RAB.World
UI: \\Desktop-t72isdi\l\RAB.World\RAB.React
Tools: \\Desktop-t72isdi\l\RAB.World\RAB.Toolkits\world-audit
Docs: \\Desktop-t72isdi\l\RAB.World\__docs\audits

LAPTOP DATA
C:\Users\pixelcommander\.rab\worlds\laptop\settings.json
C:\Users\pixelcommander\.rab\worlds\laptop\audits\audits.sqlite
C:\Users\pixelcommander\.rab\worlds\laptop\audits\history.jsonl
History file is created on first logged execution, not by reading the UI.

SERVER WORLD (DIFFERENT LOCATION)
\\Desktop-t72isdi\c\Users\gauge\.rab\worlds\server
The runner defaults rab_home to the server user's .rab. Pass context.rab_home explicitly for laptop audits! Scaffold defaults to the executing user's home/.rab instead. These defaults differ today.
A script imported from a share still executes on the laptop unless explicitly launched remotely. C:\ is the executing machine's C drive.

PREVIEW
http://127.0.0.1:8084/world-audit
Current preview is a built snapshot, not live source HMR.
Session workspace: C:\Users\pixelcommander\Documents\Codex\2026-09-26\wel
work/style-guide-check/src is the source snapshot.
work/style-guide-build is the build output.
work/verify-style-guide.mjs typechecks snapshot and tests style-guide manifests.
work/build-style-guide.mjs builds it.
work/preview-rab-react.mjs serves it, importing server middleware from the server source.
Copy changed UI files to snapshot before checks/build. Restart preview for server module changes.
Node used: C:\Program Files\nodejs\node.exe (v24.15.0 observed).
These work scripts are laptop session artifacts, not a portable deployment recipe.
RAB.React/package.json contains standard dev/build/preview commands; do not assume dependencies exist on every machine.
