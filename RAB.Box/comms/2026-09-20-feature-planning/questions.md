# User questions and decisions

Status: initial three questions answered by the user on 2026-09-20.

1. First visible milestone after agreeing the common foundation: project
   switching/request page; large audits/progress; or testing/code previews.
2. Write-tool testing: disposable test project plus viewer; selected project after
   target review; or code preview only where supported.
3. Prompt-button first version: editable prompt then copy; immediate copy; or send
   a reviewed prompt to a selected LLM.

Defaults suggested in the question UI are recommendations, not user decisions.
Lane owners should send additional consequential questions to the coordinator,
who will consolidate them after checking existing evidence and user instructions.

## User answers

1. **First milestone:** project switching and the request page, after agreement on
   the common foundation.
2. **Write-tool tests:** the user wants code preview. For tools that copy/rename a
   template directory, a temporary area such as `.rab/temp/test/[id]` can hold the
   generated output. This is a requested direction, not evidence that the path or
   a test runner already exists. Retain numeric IDs and preview real generated
   artifacts; do not reinterpret this as writes to the active project's source.
3. **Prompt button:** explicitly deferred from this run. Purpose: prepare text
   that the user can paste into Codex, carrying project/context and enough
   instructions to ask necessary questions instead of guessing. Project-specific
   prompts, tool-setting references and a shared prompt file are exploratory
   options. Preserve the idea; do not implement, finalize its schema or expand
   research on it in this round. No direct LLM-send feature is requested now.

These answers supersede the earlier suggested defaults where they differ.

## Follow-up resolved: local home and writer ownership

For the first version, will one computer own writes to each `.rab` storage folder,
or must PIXEL and the house server write to the same `.rab` concurrently?

The user answered: "One computer owns each .rab for now (Recommended)" and clarified:

> .rab gets made based on the computer it runs on. it should build a .rab fodler in the username windows users folder on first run

Normal startup therefore initializes `C:/Users/<current-user>/.rab` on the computer
running the app. Multiple local windows/processes share that user's storage owner.
The house registry anchor, repository, current working directory and audited input
are not alternative default homes. Different computers have independent homes;
cross-computer merging/replication is not in this milestone. Explicit isolated test
configuration remains a test seam, not a second automatic production anchor.

Observed current implementation: `defaultRabHome()` already falls back to
`path.join(os.homedir(), '.rab')`, with explicit `RAB_HOME` override, and ensureHome
creates directories/settings. Verify actual first-run startup and concurrent
initialization during implementation; this read alone is not that test.

No first-milestone product question remains unanswered. The intended React viewer
location and initial row-rendering source/output pair are later-feature questions.
