# world-viewer

Created by the Magic Box React project stamp. Settings and house capability bindings are in settings.json and PATHS.json.

Use Node 22.12+ (Node 24 recommended for this tested package):

1. `npm install`
2. `npm run dev`
3. `npm run build` to typecheck and produce dist/.

Use react/add/new/page for pages, react/add/new/dashboard for a composed grid page, react/add/new/component for structural components, react/add/new/navigation for accessible navigation, and css/stamp-new-atom for skin. Install the shared grid with css/grid/stamp-install before rendering data-grid layouts. Follow RULES.txt.

Runtime references: https://vite.dev/guide/ and https://react.dev/learn/build-a-react-app-from-scratch

## Viewing from a laptop

Run World Viewer on the machine holding the worlds and beacon folders.
The laptop only needs a browser on the same trusted network (or private VPN).
File reads and CodeEditor saves happen on the host machine.

1. On the host, open a terminal in the world-viewer project folder.
2. Find the host network IPv4 address using ipconfig.
3. Run REMOTE_START.cmd <host-network-IP>
   Example: REMOTE_START.cmd 192.168.1.25
4. On the laptop, open http://<host-network-IP>:5173/beacon
   Example: http://192.168.1.25:5173/beacon

The launcher uses port 5173 with strictPort. If that port is already in use,
stop the conflicting viewer instance or choose another explicit port:
  npm run dev -- --host <host-network-IP> --port 5177 --strictPort
Then use that same port in the laptop URL.

127.0.0.1 on the laptop means the laptop itself, not the host. A viewer bound
only to 127.0.0.1 cannot be reached from the laptop. LOCAL_START.cmd is local
only; REMOTE_START.cmd binds to the supplied network address.

If the laptop cannot connect, check that the host is running, both machines
can reach each other, and Windows Firewall permits that port on the private
network. Do not expose this server publicly: CodeEditor can write files in
the configured beacon folders and the viewer currently has no login.

Current data setup: startup reads the saved snapshot selected by
WORLD_VIEWER_SNAPSHOT, defaulting to the host user's
.rab/exports/world-viewer. The manifest and editor endpoints read the selected
beacon files on the host. A static dist/ host alone does not provide these
endpoints; use the Vite server with this project's configuration.

Laptop connectivity has not been verified from the laptop itself.
