__PROJECT_NAME__

Created by the Magic Box React project stamp. Settings and house capability bindings are in settings.json and PATHS.json.

Use Node 22.12+ (Node 24 recommended for this tested package):

1. npm install
2. npm run dev
3. npm run build to typecheck and produce dist/.

Use react/add/new/page for pages, react/add/new/dashboard for a composed grid page, react/add/new/component for structural components, react/add/new/navigation for accessible navigation, and css/stamp-new-atom for skin. Install the shared grid with css/grid/stamp-install before rendering data-grid layouts. Follow RULES.txt.

Runtime references: https://vite.dev/guide/ and https://react.dev/learn/build-a-react-app-from-scratch

BEACONS AND SIGNALS
The components, pages, dashboards and atoms folders contain beacons with
type react. Project stamping assigns each beacon its own ID and date_added.
The bundled toolkit/add stamps populate their template/settings.json from
collected values: React UI signals use type component; CSS signals use style.
Each CSS class is created in its own folder beside its settings.json.
transmitting defaults to true in each signal template; explicit false is kept.
Beacon discovery and transmitting enforcement are not yet wired to the watcher.
