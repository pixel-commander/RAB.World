EXTERNAL TOOLKITS
=================
General executable Tools and template-backed Stamps, through the existing
Magic Box Tool House. A toolkit does not imply audit, React, or any other
domain. This first toolkit supplies a React starter and its seed operations.

PROJECT LINK
------------
The project's own settings.json stores the optional top-level field:

  "custom_toolkit_path": "C:\\magic-box-tools"

The toolkit stays outside the project. Multiple projects can share it.
Missing, null, or an empty string selects no project-specific toolkit.
Use an absolute path valid on the computer running the Box. Server drive
letters must be expressed through their UNC share when running on a laptop.
Every newly stamped project receives the field. Existing projects are not
bulk-rewritten; add the field when enrolling one. The source settings file
is authoritative; .rab project snapshots are records of what was read.

OPTIONAL BOX-WIDE LINK
---------------------
To make a toolkit available before a project has been selected:

  node scripts/toolkits.mjs link C:\magic-box-tools
  node scripts/toolkits.mjs list
  node scripts/toolkits.mjs disable C:\magic-box-tools
  node scripts/toolkits.mjs unlink C:\magic-box-tools

Run from the Box folder, or use the script's full path and --root <box-folder>.
Unlink removes the link, not toolkit files. Disable also works while a toolkit
is disconnected. Configuration lives beside that Box in TOOLKITS.json:

  {
    "version": "toolkit-links/v1",
    "toolkits": [{ "path": "C:\\magic-box-tools", "enabled": true }]
  }

This is an explicit list of roots, not a copied tool registry or another
house anchor. There are at most 64 Box-wide links. An absent config preserves
the normal house catalog. Invalid config and unavailable roots are reported
in catalog.unavailable. Disabled links are not read. A project link is an
independent explicit selection; disabling a global link does not disable a
project's own custom_toolkit_path. The same physical root selected both ways
is loaded once. Different project-only toolkits remain isolated by context.

TOOLKIT SHAPE
-------------
  toolkit-root/
    settings.json
    README.txt
    RULES.txt
    tools/
      react/
        projects/stamp-rraabbiitt/
        grid/seed/stamp-baseline/
        atoms/seed/stamp-baseline/
        components/seed/stamp-site-chrome/
        components/seed/selected/
        components/list/seeds/
        hooks/seed/stamp-use-url/

Other domains and deeper responsibility folders use the same shape.
For example, react/atoms/add-new/stamp-container can be added when its
template and executor are ready. An empty directory is not an available tool.
Seed operations populate defaults; add-new operations create one named item.

Root settings.json uses the house keys:

  {
    "id": 1830000000035,
    "name": "magic-box-tools",
    "title": "Magic Box Tools",
    "description": "External project and seed stamps.",
    "settings": [],
    "meta": { "kind": "toolkit" }
  }

IDs in examples belong to this installed kit; allocate fresh numeric IDs for
new identities using the existing memory allocator. Never add hashes or reuse
an ID for a different toolkit/tool. Renaming/moving the same tool retains its
ID and requires repairing explicit path references. Duplicate toolkit IDs
quarantine all conflicting roots. Duplicate tool IDs or full paths quarantine
all conflicting tools, including a house tool in that conflict. There is no
first-linked-wins or last-linked-wins rule.

EACH TOOL
---------
  tools/<domain>/<responsibility>/<operation>/<leaf>/
    settings.json
    <leaf>.mjs
    contract.json            optional declarative output description
    README.txt               usage, decisions and verification
    template/                required for a stamp-* leaf; otherwise absent

An executor may be inherited from the nearest parent <folder>.mjs inside the
same tools tree. A template-backed leaf MUST start with stamp-. A stamp-* leaf
MUST have template/. A component's files remain in its own component folder
inside the template. Shared source belongs at one owner; wrappers call it.
Do not copy engines into every stamp or reimplement the Box runner.

Tool settings.json:

  {
    "id": 1830000000039,
    "name": "stamp-site-chrome",
    "title": "Seed SiteChrome",
    "description": "Populates the baseline SiteChrome component.",
    "settings": [
      { "name": "name", "type": "text", "title": "Project Name",
        "description": "Lowercase kebab project name.", "required": true },
      { "name": "folder", "type": "folder", "title": "Project Folder",
        "description": "Absolute project root.", "required": true }
    ],
    "meta": { "domain": "react", "authority": "write", "seed": true }
  }

name must match the leaf folder. Domain comes from the first path segment.
Path operation/target semantics and declared metadata must agree. Declare
authority truthfully (read/write); it is not a process sandbox. Linked code
is trusted Node.js code and can execute when explicitly run. Discovery reads
JSON and files; it does not import executors or evaluate old settings.js.
Executors/settings/template roots cannot escape through links. Contract
extends references must resolve inside that toolkit's tools boundary.

OPTIONS AND THE BAG
-------------------
settings is an array of input declarations, not current values. Runtime
options is an object keyed by each declaration's name:

  { "name": "demo-app", "folder": "C:\\projects" }

Use title and description to supply a useful question. Supported existing
inputs include text, textarea, folder/file/path, boolean, number, options,
json, and settings. Choice fields should declare enum for validation and
options [{name,description}] for presentation. Structured arrays use type
json today; the executor must validate their item shape, bounds and meaning.
required and default are optional. Defaults fill undefined values only.
Valid false, zero and optional empty strings survive. The current runner
treats null as missing and required empty strings as unanswered. Undeclared
option keys are rejected. Missing required values produce INPUT_REQUIRED.
Do not silently guess a project, output folder, component or destructive mode.

Executor interface:

  export const run = async ({ options, context, tool, root, helpers }) => {
    return { status: 'created' };
  };

tool.root/template identify this tool's actual files. root identifies the
Box installation; toolsRoot identifies this toolkit's tools directory.
context.project identifies the selected project; do not
assume it is the toolkit or the new project's destination. Preserve the
incoming bag when forwarding context. Never replace valid supplied values
with truthy defaults. Do not put a hard-coded Box import path in the toolkit.

Available shared helpers include listTools, findTools, getTool, bindSettings,
runTool, renderTemplateTree, writeArtifactPlan, and runProjectStamp.
runProjectStamp is bound to this executing tool, validated options and runner
context; it reuses project identity, file-plan and memory owners. Seed stamps
use renderTemplateTree and writeArtifactPlan, which refuse existing files and
verify generated bytes. Composite children MUST use helpers.runTool so each
child gets its own execution ID, parent link, duration, status and provenance.
Do not directly call child executors or shell out to an old factory maker.

Templates use __TOKEN__ markers handled by the existing template renderer.
The adapted project uses PROJECT_ID, PROJECT_NAME, PROJECT_TITLE, NPM_NAME
and explicit toolkit/override identity tokens. It does not evaluate arbitrary
marker syntax. Literal TypeScript brackets and unhandled markers stay literal.

PROJECT OVERRIDES
-----------------
custom_toolkit_path selects discovery scope. It does not silently replace an
unrelated house capability. PATHS.json selects an override explicitly:

  "stamps": {
    "new-react-project": {
      "id": 1830000000036,
      "path": "react/projects/stamp-rraabbiitt",
      "toolkit": 1830000000035
    }
  }

The numeric toolkit ID, tool ID, full relative path, and stamp/tool kind must
all match. Missing or stale references fail without falling back to another
implementation. An ordinary project-local {id,path} override still works
and remains confined to its project folder.

Flat aliases honor project overrides. A numeric ID or full path is an explicit
choice of implementation and does not redirect through an alias. Composites
must deliberately choose a flat alias if they want project substitution.
The existing house dashboard's qualified child paths have not been rewritten.
The first external project composite pins its four known seed implementations;
its new-react-project entry is an explicit project-level override.
Because it saves that override, this particular adapter requires an explicitly
supplied custom_toolkit_path to resolve to its own toolkit root. It refuses a
different/empty root before writing, rather than saving an unresolved override.
The general house project stamps can save another explicitly selected toolkit.
Derived ambiguous aliases are rejected; use a unique path/ID or explicit pin.
Receipts distinguish source project/toolkit/house, implementation source,
toolkit identity/root and shadowed house registration.

COMPONENT ARRAYS AND REFRESH
----------------------------
Run react/components/list/seeds to get available component seeds, their IDs,
paths and input declarations. A discoverable component seed has its own
stamp-* folder under react/components/seed/ and meta.seed:true.

Run react/components/seed/selected with:

  {
    "name": "demo-app",
    "folder": "C:\\projects\\demo-app",
    "components": ["react/components/seed/stamp-site-chrome"]
  }

The selection is an array of numeric IDs or full paths, at most 64 entries.
All selected identities and required inputs are checked before executing any
child. Duplicate, missing or incompatible selections fail. Each child writes
through the shared runner and artifact writer. A later filesystem failure can
leave earlier seeds completed; their receipts survive and retries do not
overwrite them. This is not a transactional rollback promise.

Both list and selection operations refresh discovery. In-process callers can
call helpers.listTools({fresh:true}) during the same turn. HTTP catalog/search
and top-level runs refresh as well. The Toolbox refreshes when reopened.
This is explicit refresh, not a filesystem watcher or live auto-updating form.
Contracts describe result shapes; they are not runtime JSON Schema validators.
Semantic search and chat use effective project aliases, so a shadowed house
implementation is not ranked above its project replacement. The new-project
conversation retains project context when delegating to the type's alias.

STRICT ADD/VERIFY CHECKLIST
--------------------------
1. Read the owning toolkit/project RULES.txt and nearest implementation guide.
2. Pick one responsibility and canonical path; allocate one permanent ID.
3. Declare exact inputs, effects and useful output contract. Keep code local.
4. Reuse shared execution and file-writing owners. No second runner/scanner.
5. Refresh listing; verify discovery does not execute code or initialize memory.
6. Generate an example in .rab/temp/test/<numeric-id>, inspect actual files,
   typecheck/build React output, and test repeated writes are refused.
7. Test overrides with and without project context, including nested child
   calls. Verify actual selected IDs and saved execution provenance.
8. Retain first failures and fixes. Document adapters and original file hashes.
9. Do not label code-only checks as visual acceptance or model-productivity
   evidence. The operator owns visual acceptance of the generated app.

CURRENT IMPORT
--------------
C:\magic-box-tools was adapted from the verified server template:
  \\Desktop-t72isdi\f\automation-factory\stamp-factory\
    __rraabbiitt-react-project\template

Its original CLI/settings.js were not copied as executable Box contracts.
The starter was split into project, grid, atoms, hook and component seeds;
the local copy gained project settings, explicit override metadata, .is-active
state compatibility and normal runner wrappers. SOURCE_IMPORT.json records
source hashes and destinations. Server originals remain unchanged.
seed-factory/ui-components is a separate source library located during this
work; it has not all been converted or claimed compatible with this starter.

VERIFICATION COMMANDS
---------------------
  node --test tests/external-toolkits.test.mjs tests/paths-registry.test.mjs
  node scripts/prove-react-toolkit.mjs C:\magic-box-tools

The proof preserves output and execution receipts under .rab/temp/test/<id>.
Inside the printed generated folder, npm ci then npm run build validates the
React output. No development server or live service restart is required.

SHARED TOOLBOX AUTHORING
-----------------------
See ../../tools/toolbox/README.txt for the common settings -> form -> runner
method, supported prerequisite/child binding mechanisms, scratch reviews,
output verification, and the currently unimplemented universal parent schema.
