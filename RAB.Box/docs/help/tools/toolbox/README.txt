SHARED TOOLBOX TOOL AUTHORING
============================
Current implementation, 2026-09-20. Applies to audits, stamps, source edits and
composites. Tool-specific UI execution branches are not the extension method.

THE SHARED PATH
  settings.json -> discovery -> generated Toolbox fields -> Tool House runner
                -> executor -> result + task/parent IDs + execution receipt

  The same capability can be used from chat, Toolbox or another tool. Toolbox
  supplies declared inputs and the selected project/session. Its Run action
  calls the same runner. A Stamp is a Tool that owns a template/ directory and
  has a stamp- leaf name. It does not get a second execution framework.

MINIMUM TOOL SHAPE
  semantic/path/leaf/
    settings.json       id, name, title, description, settings, meta
    leaf.mjs            export const run = async ({options,context,tool,helpers})
    contract.json       tool-contract/v1, declared source and result shape
    README.txt          prerequisites, examples, effects, failure behavior
    template/           Stamp only

  A leaf may inherit the nearest parent's <folder>.mjs and contract.json. That
  is executor ownership, not a requirement for a parent component/project to
  exist. Permanent IDs come from the memory allocator. Names match leaf folders.
  Start with base/stamp-new-tool or base/stamp-new-stamp; use their canonical
  templates. Full semantic paths or numeric IDs avoid shortcut ambiguity.

INPUTS AND REQUIREMENTS THAT WORK TODAY
  Declare every input in settings[] with its exact name, type, title,
  description, required flag and optional default/options. The form supports
  text, textarea, path, folder, file, Boolean, number, options, JSON and settings.
  Missing required inputs produce INPUT_REQUIRED. Do not invent undeclared
  fields or fill supplied false/zero/valid-empty values from defaults.

  If an action needs a parent component, target file, area or folder, make it a
  named required input. State the accepted shape and resolve it before effects.
  If it needs the current project, document that in the description and README,
  check context.project in the executor, and return PROJECT_CONTEXT_REQUIRED
  before writing when it is absent. Do not infer a parent from a friendly title.

  Existing input field `try` can name a capability to fill a missing input.
  Child-return binding is handled by the runner; see its extractChildValue
  and missing-seat logic and tests/tool-house-v08.test.mjs. It is not a blanket
  permission to create or guess parents. Prefer an explicit creation composite
  when provisioning a parent has write effects. Document the child and returned
  value that the next action consumes, and test the missing-parent case.

LINKING TOOLS THAT WORK TODAY
  Composite executors call helpers.runTool({key, options}). Select a full path
  or permanent ID for a fixed implementation; use a flat alias deliberately
  when project overrides are wanted. Pass needed child results forward using
  canonical keys. Do not shell out to a child executor or import/run it directly
  to bypass the runner. Child execution identity, parent identity, timing,
  status, provenance and failures remain in the shared task trace.

  Do not return the entire child envelope's shared tasks array from a composite;
  it can point back at the parent. Return child result/reference plus execution
  identity as needed. Distinguish execution success from business verdicts
  (e.g. a checker completing with findings is not a passing review).

SCRATCH REVIEWS THAT WORK TODAY
  Stage a bounded input through the shared artifact writer under
  <RAB_HOME>/temp/test/<numeric-id>/source. Allocate IDs through createRabMemory.
  Call helpers.runScratchTool({key,options:{folder:sourceRoot,...}}) for a
  read-only child inspector. It stays in the same task tree and selected project.
  The runner checks exact scratch location, rejects links and writer authority,
  and uses an in-process scope unavailable to JSON callers. Ordinary audit
  calls retain the prohibition on auditing .rab as user input.
  This is not a sandbox for executing untrusted code or arbitrary write tools.

OUTPUT AND ACCEPTANCE
  contract.json describes outputs at their owner; it is not automatic runtime
  output validation. Add behavioral tests for valid input, missing prerequisites,
  failed children, no-write-on-failure and actual output integrity. Stamps must
  generate and inspect an example. A write tool must declare write authority,
  enforce path/overwrite policy, and verify what it produced. Prefer existing
  artifact/DOM/CSS owners to duplicate filesystem and parsing logic.

EXTERNAL AUTHORS
  Implement in a linked toolkit with the same structure. Project-local selection
  uses custom_toolkit_path and explicit project PATHS pins where appropriate.
  See ../../tool-kits/external-toolkits/README.txt for the exact supported link,
  option, identity and override shapes. Discovery refreshes without adding
  tool names to UI switches or regenerating a central tool catalog.

GAPS -- NOT CLAIMED AS IMPLEMENTED
  There is no universal machine-readable requires-project/requires-parent
  preflight contract yet. Required fields, input `try`, executor checks and
  explicit runner composites are the current supported mechanisms.
  There is no universal declarative recipe graph/editor or automatic review
  gate covering every filesystem writer. Do not invent `requires`/`depends_on`
  fields and assume the runner enforces them. A future shared prerequisite
  contract should add consistent UI questions, identity/type validation and
  explicit input/output links in one runner owner. Record this as shared
  infrastructure work; an outsourced leaf tool should not patch the system.

BRIEF TO GIVE A CLOUD TOOL AUTHOR
  Build <named capability> in <approved toolkit semantic path>, using the
  linked-toolkit rules and the current Tool House contract. Inputs are <list>;
  required project/parent/target is <explicit shape>; children are <exact keys>;
  output is <shape>; authority and write boundary are <policy>. Reuse existing
  stamps/owners and helpers.runTool. Provide README, contract and tests covering
  pass, fail, missing prerequisite and produced artifacts. Preserve supplied
  values. Do not change bridge, engine, UI or shared registries to add this tool.
  If the current contract cannot express a requirement, report that dependency
  before implementation instead of adding an undocumented convention.
