CURRENT ENTRY POINT NOTICE — 2026-09-20
=====================================
engine/index.mjs exports the shared Tool House runner and Workbench facade.
engine/cli.mjs now invokes that same runner; use --help for current flags.
The older executor is retained only in engine/tests/fixtures/runtime-reference.mjs.
The text below is historical reference, not the current execution contract.
See ../docs/session-audits/2026-09-20-shared-stamp-runner.md.

MAGIC BOX — SETTINGS-GUIDED STAMP INPUTS
=======================================
Version 0.2.0. Separate successor; the v0.1 parser remains unchanged.

PURPOSE
-------
The previous package parsed a fixed component sentence into an AST.
This one resolves a selected project's live stamps, reads their settings,
collects supported inputs, asks for missing inputs, resumes from a saved
bag, and can invoke trusted stamp planners through a bounded file mutation executor.

It is an adapter demonstration, NOT your production Magic Box/Factory.
The exact PATHS.json structure and optional language metadata below are
proposed formats. Your existing stamp-maker can emit them or an adapter
can translate your existing files. No real house scripts were supplied.

YOUR HOUSE KEYS
---------------
Stamp metadata stays:
  { id, name, title, description, date_added, options }

Top-level name is the RESERVED CAPABILITY: react-project.
options.name is the new ARTIFACT NAME: test-project.
They do not overwrite each other.

Object options are the preferred example. Project B uses the equivalent
array [{key:'name', required:true, type:'text'}, ...]. Input normalization
produces one keyed field map. Supported seat types: text, boolean, number.
Flat fields only. Dependency frames repeat the same contract shape.

LANGUAGE -> CURRENT CONTRACT
----------------------------
  make / create / stamp / build / start
       -> a project-declared capability phrase
       -> modifier constructions declared by its current field settings
       -> compatible bindings + provenance
       -> required/optional checks
       -> current catalogs / dependency requirements
       -> ready OR input-required / conflict / ambiguity / error

The parser recognizes complete supported constructions, not arbitrary
keyword hits. Every lexical unit must be accounted for. Modifiers can
be reordered. Quoted values preserve case. Explicit field=value syntax
also works. No embeddings, fuzzy matching, nearest-name substitution,
LLM generation or phrase-ranking score is used.

This is not a full NLTK feature-grammar engine. It implements a small
construction parser and compatible-binding merge inspired by the same
separation of lexical features, syntax, and semantic roles.

EXACT USER EXAMPLE
------------------
  stamp a new react project named "test-project" into the current project folder

Project A supplies:
  react-project -> stamps/ReactProject/settings.json + stamp.mjs
  required: name, location, type
  optional: add_database (explicit default false)

The sentence supplies name=test-project and location=.
It does NOT establish what your field type means. The sample defines
that field as a project variant, with app as its supported value; it
still asks for it instead of guessing from the word React.

Sample Project B binds react-project to local-tools/ReactProject and also
requires theme. No changes to src/language.mjs are needed.

Supported reordered examples:
  create react project type app into here called test-project
  stamp react-project name=test-project location="." type=app
  build a react app into the current project folder named test-project type app
  make react project named test-project type app in here without a database

A type default or fixed framework binding can be added explicitly to the
real stamp if that is your intended contract. The runtime never invents it.

MISSING-CLASS / BOUNCE-BACK EXAMPLE
---------------------------------
  make a div with class x

The parent knows the requested class name. It checks the current class
catalog. Confirmed absence triggers ONLY the dependency declared in PATHS:
  div-stamp.class -> atom-stamp.name

The child reads its own settings. It preserves name=x, applies the stamp's
explicit layer default, and asks for token. The missing input includes:
  request_id
  stamp: atom-stamp
  key: token
  returnTo: {request_id, stamp: div-stamp, key: class}

Replying --surface-main to that one pending seat resumes the same request.
The atom is written and its catalog presence verified. The div then runs.
The parent is not replaced by the child, and the original text is retained.

  make div using token --surface-main with class x

already contains the child's answer; no follow-up is needed.
Existing class container-main bypasses the child. Supplying a new token
for an already-existing class is NOT silently ignored: this subset returns
a conflict, because updating existing atoms is not one of its operations.
Lookup failure, incomplete index, and absent class remain distinct.

THREE ENTRANCES
---------------
Magic Box text, cloud LLM output, and local LLM output can reach the same
prepare() validator. The model adapter supplies a canonical request:

  {
    "mode": "command",
    "capability": "react-project",
    "options": {
      "name": "test-project",
      "location": ".",
      "type": "app"
    }
  }

Optional dependency_options holds explicitly supplied child inputs.
The project root is selected by the HOST, not by a path invented in this
canonical request. Extra envelope fields, unknown capabilities, unknown
seat keys and malformed values are rejected.

No live model/API integration is included. Connect your existing model
translator to this entry point. The same checks run for every entrance.
A well-formed model proposal is not proof of correct human intent.

API
---
  import { createMagicBox } from './index.mjs';

  const box = createMagicBox({
    projectRoot: selectedProject,
    allowWrites: false
  });

  const first = await box.prepare(textOrCanonicalRequest);
  const catalog = await box.inspect();

  const next = await box.answerText(first.ticket, 'app');

  // In a UI adapter, pass an explicit return address when several seats wait:
  const next = await box.answerText(ticket, 'dark', {
    stamp: 'react-project', key: 'theme'
  });

  // Structured replies never infer which request they belong to:
  const next = await box.answer(ticket, {
    request_id: ticket.id,
    stamp: 'react-project',
    values: { type: 'app' }
  });

  const restored = await box.resume(savedTicket);

To execute, create a host instance with allowWrites:true and, optionally,
an authorize({project_id, capability, options}) callback. Then execute(ticket).
Neither text nor a model-supplied authority field can turn that flag on.
The callback must return true, not merely a truthy value.

Tickets are ordinary serializable request state, not security credentials.
Validate them at the host boundary. They do not prove who asked or approved.

STATUS / AUTHORITY
------------------
ready               inputs/known checks pass; nothing has been written
input-required      one or more declared seats are missing
query-result        supported CAN YOU query; inspection only, no writes
ambiguous           multiple bindings/capabilities fit
conflict            incompatible assignments or unsupported extra intent
invalid-input       supplied fields violate the current contract
lookup-failed       current facts could not be established
capability-unavailable  stamp registration/file unavailable
stale-contract      PATHS/settings/script/supporting asset changed
completed           trusted execution and the documented file checks passed
error               another structured failure, with code and details

Every pre-execution result has authority:0, including ready. Only a completed
execution receipt reports authority:1. A query cannot become a write command.
"can you ...?" is deliberately treated as an inquiry in this small language;
indirect requests require a separate explicit host confirmation policy.

FRESHNESS AND DISCOVERY
-----------------------
PATHS.json, selected settings, stamp code and declared supporting files are
read afresh per preparation/resume/execution. A pending ticket records their
fingerprint. Changed contracts require a newly prepared request, not blind
reuse of old answers. Catalog membership is also rechecked before execution.

Only declared stamp entries are discoverable. A deleted stamp folder drops
out of inspect(). Its stale PATHS binding appears as an unavailable diagnostic;
the runtime does not write a retirement ledger. Adding a new stamp requires
its PATHS binding; have YOUR existing stamp-maker/indexer own that update.
This package does not replace your filesystem watcher or self-registration.

There is no polling and no repository-wide glob/search in the resolver.
The folder-backed class catalog enumerates exactly its configured directory.
The generated React sample has build-time demo discovery via import.meta.glob,
following the demo convention in the supplied house rules. That is not a
worker searching arbitrary source files to infer the house.

TRUST / EXECUTION
-----------------
JSON settings are data. JavaScript settings are executable and require the
explicit host flag allowExecutableSettings:true (CLI --trust-js-settings).
They are loaded in a fresh Node child process; this avoids module-cache reuse.
IT IS NOT A SECURITY SANDBOX. A trusted JS module can do anything that OS user
can do. Never load unknown generated code merely because its schema is valid.

Stamp scripts export plan({project, settings, options, catalogs, assets}).
They return one new destination directory and a list of text/base64 files.
The mutation executor rejects out-of-project paths, symlinks/junctions, traversal, Windows
reserved/ambiguous names, overlapping plans, duplicate filenames, oversize
plans and existing destinations. It writes with create-only semantics and
verifies every written file's SHA-256 against the approved plan.

All plans are checked before mutation writes. Dependencies are executed first.
This is NOT a transaction across directories. A write failure may leave partial
artifacts; those are recorded. No silent rollback or destructive cleanup.
No arbitrary shell strings are executed. Trusted scripts run through Node
with a timeout and structured JSON I/O. Custom code is still privileged code.

Verification means what the receipt says: file bytes match the plan, plus
required dependency catalog presence. It does not prove design quality,
accessibility, all runtime behavior, intent fidelity, or arbitrary script purity.
Connect your production tests/stamps before promoting production success.
See docs/KNOWN_LIMITS.txt for the concurrency and trust boundaries.

STAMP OUTPUT FIXTURES
--------------------
react-project:
  React/TypeScript/Vite starting files, tokens, two skin atoms, Button,
  static demo, and StyleGuide. No dependency installation is performed.
  Optional database=true adds an actual SQLite seed with one metadata table.
  It does not deploy a database server or connect the browser to the database.
  Project B applies its selected light/dark token override.

atom-stamp:
  One background atom referencing a currently registered token.
  Project B's theme/exportTarget are written as atom metadata, NOT used to
  rewrite central exports or invent a full theme architecture.

div-stamp:
  One empty HTML div and a relative reference to the atom CSS.
  Loading the project's token CSS is a host responsibility.

component-stamp:
  One named TSX div component using the registered class. Not a complete
  production component-family stamp; replace this with your actual stamp.

These are explicitly sample implementations behind reserved names. Improve
or replace their scripts and supporting templates rather than teaching the
parser where each generated file should go.

FILES / NEXT INTEGRATION
------------------------
START_HERE.txt       shortest run path
index.mjs/.d.ts       host-facing API and TypeScript types
src/                 parser, current-project loader, binder, runtime, mutation executor
examples/project-a   object options, one project-local path layout
examples/project-b   array options, another layout, extra required fields
cli.mjs              prepare/ask/resume/inspect/execute
 demo.mjs            end-to-end test in a NEW temporary workspace
 tests/              automated unit and integration tests
 docs/CONTRACTS.txt   exact proposed adapter formats
 docs/MATH.txt        lambda/completeness/binding distinction
 docs/KNOWN_LIMITS.txt honest boundaries
 TEST_REPORT.txt     actual command results for this build

NEXT: adapt one existing stamp made by your stamp-maker. Do not rewrite your
Factory, training system, model harness or world-view to adopt this demo.
