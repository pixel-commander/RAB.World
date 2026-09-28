START, STOP AND RESTART THE WATCHER

The three command files are in this folder:
  C:\RAB.World\RAB.Box\tools\base\watch

START.cmd
  Starts monitoring saved paths and refreshes their manifests.
  Calling it again does not create duplicate watchers.

STOP.cmd
  Stops monitoring all registered project paths in this Box instance.
  Waits for pending updates to finish. Keeps registrations and manifests.

RESTART.cmd
  Stops monitoring, then reloads the saved registrations and starts again.
  Restarts the watcher, not the Box server.

Box must already be running. These files contact it for you; there is no
need to call the API manually. Closing the browser does not stop Box.

PowerShell example from any folder:
  & 'C:\RAB.World\RAB.Box\tools\base\watch\STOP.cmd'

The default Box address is http://127.0.0.1:52814. To use another Box port:
  & 'C:\RAB.World\RAB.Box\tools\base\watch\START.cmd' 'http://127.0.0.1:52815'

Check the printed result. started or stopped confirms the operation; restart
also reports action: restart. partial means some paths could not be restored;
read unavailable for the reasons. A failed connection means Box is unavailable
at that address. A command cannot start the Box server for you.

After installing these controls into an already-running Box, restart Box once
to load the new code. Future watcher operations use the three files above.

IMPLEMENTATION AND UI CONNECTION

watch.mjs owns the running watcher, filesystem handles and reconciliation
timers. It runs inside the Box server. No template or second process is needed.

base/watch/start: restore saved registrations and start monitoring.
base/watch/stop: stop all active paths and wait for in-flight updates to finish.
base/watch/restart: stop, then reload registrations and refresh their manifests.

These commands affect all saved projects in the running Box storage home.
They need no selected project or form inputs. Each control has its own .mjs
and adjacent settings.json. IDs are fixed tool identities; paths and records
are preserved across stop/start. Repeated start does not duplicate watchers.
Commands are serialized with add/remove so concurrent UI requests stay ordered.

Add registers paths; list reports saved registrations and runtime status;
remove unregisters a path. Adding while stopped saves the registration but
does not resume monitoring. Stop lasts for this server process; a new Box
server restores registrations at startup. Server shutdown closes the owner.

The command files call scripts/watcher.mjs, which sends an authenticated
request to the running Box server. It controls that server's watcher instead
of creating an independent watcher in the command process.

Future UI: POST /api/tools/run with the normal session token and a body such
as {"tool":"base/watch/stop","options":{}}. Use the returned result status,
count, items and unavailable entries. Partial startup is reported explicitly.
These controls do not yet implement beacon/signal discovery or transmitting.

SKILL.txt beside this README contains compact model operating instructions.
