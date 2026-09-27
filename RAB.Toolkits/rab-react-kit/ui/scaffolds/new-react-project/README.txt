New React Project

Creates a RAB React project at the supplied path using the built-in template. Project inputs follow the house keys: id, name, title, description and path. The optional database files are disabled by default.

The default site shell lives in src/shell. Its settings.json is a signal
with type "site shell" and describes where pages and dashboards load for
the named project. The stamp allocates its ID and timestamps through the
shared signal helper. Navigation stays in src/shell/components/SiteNav.tsx.
SiteShell renders the selected view in its main area using URL navigation.
App.tsx registers the starter Default page; add page or dashboard views to
that items list. Project name, title and description come from settings.json.

Box key: react/add/new/project
Inputs are declared in settings.json. The local template owns the shape.
Box supplies shared rendering and artifact-writing helpers; public child tools
run through helpers.runTool. Existing output is never silently replaced.
See contract.json for the result and SOURCE.json for the preserved identity.

Theme signals live in src/themes/colors/dark and src/themes/layout/layout.
Their settings use null ID/date placeholders; stampScaffoldRecords allocates
fresh identities and timestamps. src/css/style.css imports both stylesheets;
src/css/styles.css loads it after the existing theme, preserving atom-specific
overrides while the new files supply shared layout and semantic color tokens.
App.tsx imports styles.css, so generated projects load the themes automatically.
