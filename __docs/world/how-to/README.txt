HOW TO ADD HOUSE ARTIFACTS

This guide covers beacons, atoms, components, pages, dashboards, tools and
projects. The JSON examples are tool input values, not shell commands.
Replace the example names and locations with the intended destination.

BEFORE RUNNING A TOOL

1. Select the appropriate project/world when the tool needs its context.
2. Find the tool in the registered Box catalog. Read its current settings.json
   for required fields and choices; the front-end form uses those declarations.
3. Enter the inputs and check the destination. A parent folder input and a
   final output folder are not always the same thing; examples below show both.
4. Run through the tool runner. Executors need its context and shared helpers;
   running a leaf .mjs file directly is not the normal invocation method.
5. Inspect the returned files and verification receipt. Preserve existing
   output and any partial-write report rather than deleting work and retrying.
6. For UI changes, inspect the generated source, run the project's checks and
   build, then verify the rendered result according to its current UI rules.

Use existing stamps for canonical shapes. Components own structure; atoms
own skin. Follow the current RULES.txt and use established names and tokens.
For file meanings and field definitions, see ../files/README.txt.

Availability: source folders alone do not register a tool. The current
rab-world scaffolds are not yet in the Box picker. Their instructions below
describe their executor inputs; toolkit discovery/registration must be wired
before they can be invoked from that form. For the React kit, verify that
the selected catalog entry resolves to the intended local toolkit copy.


ADD A BEACON

Source: RAB.Toolkits/rab-world/paths/beacons
Template: template/beacon.json
Required: name, path.

With C:\RAB.World selected, use:
  {
    "name": "admin-components",
    "path": "src/admin/components",
    "title": "Administration Components",
    "description": "Components for administration",
    "types": ["ui"],
    "beacon": "on",
    "reach": ["world", "project"]
  }

This writes C:\RAB.World\src\admin\components\beacon.json.
Without a selected world, path must be the full absolute destination folder.
The tool creates missing folders but never replaces an existing beacon.json.

ID and date_added are automatic. Optional title defaults to name; description
to empty text; types to []; beacon to on; reach to both world and project.
types allows ui, docs, tools, audits and functions. reach allows world and project.
The current form uses JSON arrays for these two fields, not multi-selects.

A beacon declares indexing participation. It does not itself start an
updater. The meaning of project visibility across different projects is
still undecided; creating the beacon does not implement that policy.


ADD A SIGNAL

Before choosing a specialized stamp, a generic signal can be created with
rab-world/add/signal. Required inputs are name and path. Example:
  {"name":"AdminCard","path":"src/components/AdminCard","type":"component","transmitting":true}
Its path is the final folder: relative to the selected world's root, or
absolute when nothing is selected. The tool writes settings.json,
contract.json and README.txt, preserving existing files. ID is automatic;
title defaults to name, description/type to empty text, transmitting to true.
Explicit false is preserved. This creates a descriptor scaffold, not React
source or scanner enforcement. It is not yet registered in the Box picker.

The tool's settings[].type describes an input control; the generated signal's
top-level type describes the item. These are different uses of the same key.

ADD AN ATOM

Source family: RAB.Toolkits/rab-react-kit/css/add/new/
Choose container-atom, action-atom, effect-atom or grid-atom.
Declared catalog paths use react/css/add/new/<kind>.
Required: name, location. location is the parent atoms folder.

Container example:
  {
    "name": "container-admin-card",
    "location": "C:/RAB.WorldView/src/atoms",
    "title": "Administration Card",
    "styles": "background-color: var(--surface-main);"
  }

Output is under C:\RAB.WorldView\src\atoms\container-admin-card,
including the named CSS, settings.json and the selected template's files.
Use only tokens that actually exist in the target project; the token above
illustrates the input format and is not a guarantee of an installed token.

Container/action: styles is optional CSS declarations without selectors or
braces. Keep layout, spacing and structure out of skin atoms.
Effect/grid: choose a declared preset instead of supplying arbitrary styles.
Effect presets: effect-float, effect-inset.
Grid presets: grid-dashboard, grid-dashboard-alt, grid-test, grid-test-1.

Use lowercase kebab-case with the canonical family identity: container-,
action-, effect- or grid-. Do not include leading -- for an effect name.
title, description and indexed are optional; indexed defaults to true.
Creating a file does not establish that its CSS is imported into the app.
Check the generated demo, imports and actual rendered behavior.


ADD A COMPONENT

Source: RAB.Toolkits/rab-react-kit/add/new/component
Declared catalog path: react/add/new/component
Required: name, location.

  {
    "name": "AdminCard",
    "location": "C:/RAB.WorldView/src/components",
    "title": "Administration Card",
    "grid": "",
    "class_name": ""
  }

Output: src/components/AdminCard/AdminCard.tsx, settings.json and README.txt.
Use a PascalCase React name. location is the parent folder, not the TSX file.

grid and class_name may prompt for explicit choices. Empty strings decline
them. To compose existing atoms, supply their canonical classes in class_name.
ensure_atoms defaults to true; resolve requested atom decisions before the
tool writes dependencies. Do not assume a missing class already exists.

Other options include description, indexed, atom_decisions and save_as_text.
save_as_text is for text output/testing, not a runnable TSX component.
For a component owned by another component, inspect add/sub/component rather
than flattening every child into the top-level components folder.


ADD A PAGE

Source: RAB.Toolkits/rab-react-kit/add/new/page
Declared catalog path: react/add/new/page
Required: name.

With the React project selected:
  {
    "name": "AdminPage",
    "title": "Administration",
    "content": "Administration overview"
  }

location defaults to the selected project's pages path, then src/pages.
An explicit absolute location can be supplied when needed.
Output is a named page folder, such as src/pages/AdminPage, with the page
source and metadata. Optional fields include description, indexed and
save_as_text. content defaults to empty text.

Creating a page does not prove that a route or navigation link reaches it.
Connect it through the application's current page/navigation owner and
verify it in the rendered application.


ADD A DASHBOARD

Source: RAB.Toolkits/rab-react-kit/add/new/dashboard
Declared catalog path: react/add/new/dashboard
Required: name. Select the intended React project first.

  {
    "name": "AdminDashboard",
    "layout": "header-main",
    "nav_name": "SiteNav",
    "nav_area": "header"
  }

The example uses the current defaults. page_location and component_location
can override the project's configured destinations.

This is a composite: it creates a page, applies the canonical grid, creates
or reuses navigation, and inserts that component into the chosen area.
Use a layout and area that agree with the shared grid contract. Inspect all
child results and dependency receipts, not only the final page filename.


ADD A TOOL

Existing Box owner: RAB.Box/tools/base/stamp-new-tool
Catalog path: base/stamp-new-tool; the registered flat address is new-tool.
Required form fields: title, description.
The executor also requires either path OR both type and name.

  {
    "path": "audit/find/example-items",
    "title": "Find Example Items",
    "description": "Finds items matching the declared input.",
    "settings": [
      {
        "name": "folder",
        "type": "folder",
        "title": "Folder",
        "description": "Folder to inspect.",
        "required": true
      }
    ]
  }

path is a semantic tools-relative address, not an output filesystem folder.
Its first segment must name an existing domain under Box's tools root. The
example creates a tool under tools/audit/find/example-items, not in rab-world.

Optional address supplies a flat PATHS key. inherit_executor uses a nearby
parent executor instead of creating a new leaf executor; that parent must
already exist. meta declares operation, target and authority as appropriate.

This owner creates a non-stamp tool scaffold, not the finished capability.
Implement and check its behavior. settings.json owns its form declaration;
contract.json describes actual output. A template-producing tool owns a
template/ folder and uses shared helpers. Public child tools run through
helpers.runTool; do not copy their implementations into the new tool.

Refresh discovery after authoring and verify the tool's identity and path
before exposing it to users. A generated skeleton is not proof it works.


ADD A SAVED MAGIC BOX PROJECT

Owner: RAB.Box/tools/base/stamp-new-project
Catalog path: base/stamp-new-project
Required: type, name, folder. Choose type magic-box for this case.

To keep both the project root and its saved record under the current user's
.rab/projects directory, use that directory as folder:
  {
    "type": "magic-box",
    "name": "AdminWork",
    "folder": "C:/Users/pixelcommander/.rab/projects"
  }

Use the executing user's actual home on another machine. The example creates
.rab/projects/AdminWork. The project stamp supplies settings.json, PATHS.json
and its template files; the memory owner registers identity and saved records.

If folder points elsewhere, that is the source destination, while the saved
project record still belongs under .rab/projects/[name]. folder is a parent;
do not append the new project's name to it a second time.


ADD A REACT PROJECT

Source: RAB.Toolkits/rab-react-kit/add/new/project
Declared catalog path: react/add/new/project
Required: name, folder.

  {
    "name": "ExampleView",
    "folder": "C:/",
    "starter": "minimal",
    "add_database": false,
    "add_ui_kit": false
  }

Destination: C:\ExampleView. starter can be minimal or style-guide.
The database option adds a local demo, not a deployed API. UI-kit seeding
requires a valid populated kit template. custom_toolkit_path optionally
chooses a linked toolkit; an explicit empty string leaves it unlinked.

From the generated project folder, with the required Node version installed:
  npm install
  npm run build
  npm run dev

Check the generated README and package.json for current requirements.
Use a fresh name/destination; an existing project is not replaced by stamping.


ADD A WORLD

Source: RAB.Toolkits/rab-world/add/new/world
Required: name only. Optional: title and description.

  {"name":"PIXEL","title":"PIXEL World"}

Destination: the executing user's .rab/worlds/PIXEL. The shared owner
allocates ID and date_added. template/ supplies settings.json and README.txt;
paths starts as an empty array. This is a world record, not a React project.
Creating it does not automatically select it, attach projects or start scanners.


AFTER CREATION

Read the produced files and result receipt. Test behavior appropriate to the
artifact. The existing inventory reads item settings.json and excludes
indexed:false entries; indexing occurs through its index/listener tools.
New beacon declarations are not yet wired into that listener automatically.
Keep human instructions here and detailed input contracts with their tools.
