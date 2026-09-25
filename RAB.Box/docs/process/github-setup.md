# RAB.Box repository setup

This repository contains the Box application, its built-in tools, tests, and
source documentation. RAB.Toolkits has its own repository and remains separate.

Use Node.js 22 or later. Start the application with `npm start` or `RUN_UI.cmd`.
Run the project's checks with `npm test`. Historical reports describe the state
at their recorded date; they are not a claim that the current checkout passes.

## Toolkit links

Toolkit links are local configuration. The existing server's `TOOLKITS.json`
stays on that machine and is ignored by Git.

On a new machine, copy `TOOLKITS.example.json` to `TOOLKITS.json`. Add each toolkit's
absolute path on that machine to its `toolkits` array, with `enabled: true`.
The linked directory must contain the toolkit's `settings.json` and `tools/`.
For the current React toolkit, that directory is the `react` folder within the
separate RAB.Toolkits checkout. Use a UNC path when the toolkit is on a server;
server drive letters are not laptop drive letters.

An empty array is valid. Only the installed Box tools are available until an
external toolkit is linked. A selected project's `custom_toolkit_path` can also
provide its toolkit through the existing project configuration.

## Saved data

Saved projects, sessions, listener state, manifests, and run/review records belong
under the executing user's home `.rab`, through the existing storage owner.
Dependencies, generated verification output, credentials, and local toolkit links
are excluded from Git. Ignoring these paths does not remove files from disk.

The canonical server source is `\\Desktop-t72isdi\f\RAB.Box`. Git operations
against that path run on the current computer unless explicitly invoked remotely.
