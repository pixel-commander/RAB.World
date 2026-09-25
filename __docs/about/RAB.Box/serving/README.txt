RAB.BOX PAGE SERVING
====================

PURPOSE
RAB.Box is a local Node.js workbench. server.mjs serves its browser interface
and the same-origin API used by that interface. It listens only on 127.0.0.1;
it is intended for the local trusted operator, not public hosting.

START
Run RAB.Box from its own repository with Node.js 22 or newer:

  npm start

On Windows, RUN_UI.cmd performs the Node version check and starts the same
server. Both normal commands run:

  node server.mjs --open

The normal address is http://127.0.0.1:52814. Pass --port followed by a valid
port number to use another local port. When --open is present, Box asks the
operating system to open that address in a browser.

PAGE ROUTES
HOST.json names the interface file. In the current project it is:

  magic-box/index.html

The server returns that HTML document for all of these GET paths:

  /
  /magic-box/
  /magic-box/index.html

It also explicitly serves the UI module:

  /magic-box/run-preparation.mjs

Box does not expose its source tree as a general static-file directory. New
browser assets need an explicit server route and a contained-path check.

API ROUTES
Requests under /api/ are handled by the workbench, language library, and audit
services. The initial GET /api/session response gives the loaded page a
per-server token. Later protected API calls must send that token in the
x-magic-token header. Unknown routes receive a JSON NOT_FOUND response.

REQUEST BOUNDARIES
Every request must use the exact server host. Requests with a mismatched Host,
cross-origin Origin, or an unexpected fetch-site value are refused. JSON writes
must declare application/json and are limited to 4 MiB. The server sends
no-store, nosniff, no-referrer, and deny-framing response headers.

SAVED WORK
The browser page is served from the RAB.Box source checkout. Box-owned sessions,
settings, requests, results, logs, backups, and test output are stored under
the executing user's home .rab directory, not beside the page files.

BASIS AND LIMITS
Based on the current RAB.Box source:

  ..\..\..\..\RAB.Box\server.mjs
  ..\..\..\..\RAB.Box\HOST.json
  ..\..\..\..\RAB.Box\RUN_UI.cmd

This describes the present local server behavior. Read server.mjs before
changing routes, request boundaries, or response headers.
