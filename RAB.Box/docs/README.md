# Magic Box documentation

Canonical documentation folder for RRAABBIITT v0.9.3:
`\\Desktop-t72isdi\f\RAB.Box\docs` (server project location).

- [Vision alignment assessment](vision/VISION_ALIGNMENT_2026-09-20.md): purpose, direction, and alignment with the implementation.
- [Todo](todo/README.md): task lists and implementation follow-ups.
- [Shared tool requests](feature-request/TOOL_RUQUEST.md): running list of requests for tools.
- [UI and feature requests](feature-request/FEATURE_REQUEST.md): running list of UI and other feature ideas.
- [Runner process](process/runner.md): discovery, input resolution, nested calls, confirmation, tracking, and output verification.
- [Tool discovery](tools/discovery/README.txt): focused guides to scanned locations, required shape, refresh, and chat matching.
- [Session audits](session-audits/README.md): dated investigations, working reports, and discussions from our sessions, including temporary write-ups.
- [Domain documentation](domains/): documentation organized by domain.
- [Handoff references](handoff-reference/): reference material for handoffs.
- [History](history/): retained historical documentation.
- [Construction seats](CONSTRUCTION_SEATS.md), [glossary](GLOSSARY.md), and [deployment](DEPLOYMENT.txt).

## Tracking user tool requests

Use [TOOL_RUQUEST.md](feature-request/TOOL_RUQUEST.md) as the shared tool request log across sessions.
Use [FEATURE_REQUEST.md](feature-request/FEATURE_REQUEST.md) for UI and other feature requests.
Both are running lists only; append requests without starting planning or implementation unless asked.
When the user requests a tool, read the log first, then append a new numbered
request or a dated update to its existing entry. Preserve the user's intent,
record current status and ownership, and link any implementation todo or evidence.
Do not overwrite history, create a separate log in the ChatGPT folder, or treat
logging a request as permission to implement it. Mark requests done only with
verification evidence. See the log for the entry template and status conventions.

## Reports and audit results

Our analysis, plans, and working reports belong in this docs tree. Useful follow-up tasks belong in todo/; session investigations belong in session-audits/.

Actual audit execution results stay in the selected .rab project, normally at
`.rab/projects/<project-name>/audit-results/` (or its configured paths.results).
Execution tracking stays in that project's runs/ folder. These outputs do not belong in docs/.
See the [runner/storage contract](../AUDIT_TRACKING.txt).

## Current session reports

- [Stamps: templates versus internally produced code](session-audits/2026-09-20-stamp-templates-vs-code.md)
- [Companion inventory and source hashes](session-audits/2026-09-20-stamp-templates-vs-code.json)
