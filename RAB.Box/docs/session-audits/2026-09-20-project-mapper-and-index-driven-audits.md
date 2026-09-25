# Project mapper and audits driven by its index

Recorded: 2026-09-20. Task: Review audit stamps.
Status: requested capabilities and researched design assessment; not implemented.
Canonical requests: [TR-0004 and TR-0005](../feature-request/TOOL_RUQUEST.md#tr-0004--project-mapper-with-folder-identities).

## User intent

Paraphrase: A project-mapper accepts a folder and indexes its structure. Give folders IDs so independent JSON results, such as README discovery and per-folder file-type counts, can refer to the same folders. Evaluate nested versus flat storage honestly. A companion runner could iterate the indexed folders to populate different audits and scans.

The user asked to record the requests and assess the approach. This document is not authorization to implement either capability. Recommendations below are assistant proposals, not settled user requirements.

## Assessment

The idea is sound: keep shared folder identity and structure in one place, and let separate audit datasets refer to it. This resembles a normalized data model, where a folder ID is a reference into a separate collection. It supports joining results and showing several audits together without copying the tree into each report.

Recommend flat folder records keyed by opaque string IDs, with `parent_id` and a root-relative `path`. Generate a nested tree for display. A path-to-ID lookup is useful as a derived index, but should not be the only stored representation. Nested storage is readable for small trees; flat records are easier to join, page, append and reference independently.

Flat JSON alone does not prevent large-string failures. Serializing the whole flat object still builds a large string. Use the bounded record writer and paged reader proposed in the [streaming-results request](../todo/streaming-audit-results-and-live-progress.md) for large maps and audit outputs.

## Small logical examples

These illustrate relationships, not a finalized storage/API contract. Short IDs are for readability; production IDs should reuse the project's canonical identity conventions, with collision handling. `project_id` means the existing saved audit project, not a new ID derived from its display name. `index_id` identifies an immutable mapping run/version; preferably reuse its execution ID.

Project index:

```json
{
  "version": "project-index/v1",
  "project_id": "project-123",
  "index_id": "index-001",
  "root": "C:/example-project",
  "folders": {
    "folder-001": { "parent_id": null, "path": "." },
    "folder-002": { "parent_id": "folder-001", "path": "src" },
    "folder-003": { "parent_id": "folder-002", "path": "src/components" }
  }
}
```

Separate README results, referencing that map:

```json
{
  "project_id": "project-123",
  "index_id": "index-001",
  "execution_id": "readme-run-001",
  "rows": [
    { "folder_id": "folder-003", "file": "README.md", "status": "found" }
  ]
}
```

Separate file-type results:

```json
{
  "project_id": "project-123",
  "index_id": "index-001",
  "execution_id": "filetype-run-001",
  "scope": "direct-files",
  "rows": [
    { "folder_id": "folder-003", "counts": { "tsx": 20, "ts": 23, "js": 1 } }
  ]
}
```

`file` in the README row is relative to its referenced folder. Multiple README matches become multiple rows. An explicit scanned/no-match outcome is distinct from a folder with no row because it was skipped, failed or never processed. File-type rules must define case, extensionless files, dotfiles and compound extensions; the example does not settle those rules. Subtree totals can be derived separately from direct-folder counts without double-counting.

For persisted streaming data, store the small shared metadata once in the existing report manifest; emit individual folder/file/finding records as JSONL. The logical `folders` object above is a small explanatory view, not a requirement to materialize the whole map. Very large counts also need bounded records, for example one folder/extension/count tuple. A future database could accelerate lookups, but no new database dependency is required by this request.

## Identity and freshness are the difficult parts

- Assign IDs automatically and persist the mapping. Do not number folders by traversal order or maintain a handwritten inventory. A hash of the path identifies that path, but changes on rename; a content hash identifies content, not a lasting folder identity.
- First-version recommendation: stable IDs for the same indexed logical location across refreshes within the same saved project/root. This does not prove that the physical directory was never replaced between observations. An observed removal closes that identity; a later recreation gets a new one. Never recycle a retired ID for unrelated data.
- A rename/move should preserve identity only with reliable move evidence or an explicit mapping. Otherwise record removal/addition and preserve both historical identities. Name similarity or matching contents alone are insufficient. Opaque IDs do not automatically solve rename detection.
- Each audit references both the folder ID and the exact `index_id`. Preserve referenced maps; never silently redirect an old report to today's path. If a map is unavailable, report an unresolved reference. IDs can be project-scoped; keep project identity in the containing report.
- Changing `settings.paths.folder` must not silently reuse a map for a different audit root. Root relocation, cross-machine copies and cross-project identity sharing require explicit policies before claiming support.
- Preserve path spelling, use the existing relative-path convention, and handle filesystem case rules explicitly. Do not blindly lowercase paths. Keep local and UNC roots distinct; do not reinterpret server drive letters as laptop paths.
- An index describes what was observed during a scan, not an atomic filesystem snapshot. Record `start_date`, `end_date`, coverage, exclusions and errors; mark interrupted/partial scans. Pin the index version for a batch, but recheck live input as needed and retain source hashes for evidence-based changes.
- Watchers may later keep the index current, with reconciliation when events are missed. Start with explicit indexing/refresh; a live watcher is an optional follow-up, not required infrastructure for the initial mapper.

## The companion runner

```text
folder -> mapper -> saved index version
                         |
                  batch coordinator
                         |
                 existing Tool House runner
                         |
           audit results referencing folder IDs
```

Recommend a batch coordinator that feeds selected indexed entries into the existing runner. Keep tool resolution, validation, authority, sessions, execution tracking and saving in their current owners. Do not call Tool modules directly or add an independent report writer.

Crucial distinction: running a recursive audit once for every indexed folder repeatedly scans descendants. A tool must declare whether it processes direct files in one folder, explicit indexed files, or the whole project once. Existing folder-based tools cannot all be assumed to support direct-folder work. Whole-project checks, such as dependency or cross-file analysis, must retain their full context.

A folder-only index saves repeated directory discovery but cannot answer README/file-type questions without listing files. Recommended extension: capture lightweight file entries during mapping, including parent folder, name/type and selected metadata, without reading every file's contents. README filename discovery and extension counts can then query that saved inventory. Content audits still need file reads and source freshness checks. Whether file entries ship in the first version remains open.

Batch execution should pin project, session, index, tool and options; keep parent/child execution references; report completed/failed/skipped folders and elapsed time; use bounded concurrency, incremental saves and responsive progress. Preserve partial results. Retry/resume semantics must prevent duplicate jobs, and any future write tools must retain their ordinary approval and verification requirements. An ID-to-path lookup is not permission to write.

## Current owners and storage boundaries

Read-only source review for this assessment:

- `tools/audit/_shared.mjs` currently walks recursively, accumulates file paths, skips a fixed set of directories, and reports skips through a callback. It does not emit a reusable directory-ID map and does not return empty directories. Reusing it unchanged would not produce a complete folder inventory.
- `docs/process/runner.md` identifies `bridge/tool-house.mjs` as the execution owner and `helpers.runTool()` as the composite path. `bridge/rab-memory.mjs` owns project persistence; `bridge/tool-tracking.mjs` owns execution identities and compact references.

Use the canonical `folder` input; reuse saved project-path binding when no explicit folder is supplied. The audited folder is `settings.paths.folder`, while `project.root` is the separate `.rab` storage directory. Keep the audited source untouched.

Persist maps through the selected project's existing result owner, honoring `settings.paths.results`. Treat each map as a reusable result artifact; audit reports reference it. Any retained identity lookup is derived project data under the same storage authority, not a competing project/world/tool registry. Exact lookup location and retention rules remain to be designed. Runtime maps and results never belong in `docs/`.

Coverage must include empty directories and make inaccessible/excluded directories and symlinks/junctions visible. Do not silently follow links outside the chosen root or hide exclusions behind a claim to index the whole structure. Coordinate traversal policy with the shared scanning owner rather than making a separate walker per audit.

## How other tools approach this

These are specific documented patterns, not claims that those products implement this exact proposed schema.

- **Watchman:** maintains indexes over a watched tree and queries by relative path/depth, suffix, glob or changes since a cursor. Its explicit depth-zero option and duplicate-result handling illustrate why batch scan scope matters. [File Queries](https://facebook.github.io/watchman/docs/file-query). It uses logical clock IDs to identify observed changes; this is useful inspiration for versioned refreshes, not a substitute for our evidence snapshots. [Clockspec](https://facebook.github.io/watchman/docs/clockspec).
- **Everything:** can index ordinary folders and network shares, retains an offline index, and supports rescanning to catch missed changes. This illustrates separating a searchable inventory from the currently available filesystem and making refresh/freshness explicit. [Folder Indexing](https://www.voidtools.com/support/everything/folder_indexing/).
- **Git:** tree objects contain named references to blobs/subtrees, and objects are content-addressed. Useful model for immutable snapshots and references; a Git tree hash is not a permanent directory identity. [Git Objects](https://git-scm.com/book/en/v2/Git-Internals-Git-Objects).
- **Windows:** exposes file IDs together with volume serial numbers to identify a file on a computer. These can support identity evidence, but are not a portable application-wide key by themselves; network filesystem APIs can return partial information or fail. [FILE_ID_INFO](https://learn.microsoft.com/en-us/windows/win32/api/winbase/ns-winbase-file_id_info), [GetFileInformationByHandle](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getfileinformationbyhandle).

Recommendation: adopt the shared index and linked audit datasets, use a flat logical model and streamed physical storage, and add batch orchestration through the existing runner. Keep stable identity, observation versions and current filesystem freshness distinct.
