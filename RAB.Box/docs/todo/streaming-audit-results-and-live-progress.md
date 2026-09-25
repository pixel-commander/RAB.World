# Stream audit results and show live progress

Status: design captured from the user's requests on 2026-09-20; implementation pending. Owner: Review audit stamps. This replaces a narrow large-scan limit fix with a shared streaming design. No result-format migration has been made yet.

## Problem observed

The existing `check-shit` audit project targets `C:\`. Two saved failures, for `:hover` and `.container-main`, report `Invalid string length` in the `find-class-definitions` child, before class-impact evidence was produced. The latter child ran for about 73 seconds. The saved errors do not include a stack, so they establish the failing child, not the exact failing string allocation.

Historical receipts remain unchanged in the selected `.rab` project:

- `audit-inspect-class-impact-1789925464965-0f8f1611.json`
- `audit-inspect-class-impact-1789925575090-cbed005e.json`

Their containing directory is `C:/Users/pixelcommander/.rab/projects/project-1789863700153-0d303491--28f709d79730/audit-results/1789863700255-7515b58f/`.

Current contributing design: scanners collect arrays, the runner measures/duplicates results, the report writer serializes the complete report, and the HTTP response serializes the complete return. Replacing only the final writer does not make this pipeline stream. Separately, exact-class input validation currently happens after the child scan; selector syntax needs rejection before filesystem traversal.

## User requirements

- Append results while scanning instead of assembling one enormous string.
- Return a saved path and a compact summary.
- Retain the folder and file associated with each finding.
- Watch progress while the scan runs, with enough information to distinguish activity, waiting, failure, and completion.
- Keep session/execution tracking separate from potentially huge audit results.
- Keep every artifact in the selected `.rab` project; ordinary audits never write into the audited folder.
- Use the same contract and writer across audits. Do not create independent per-stamp persistence implementations.

## Proposed save shape

Retain the existing execution tracking owner and `start_date` / `end_date` keys. Use the project's configured results directory, session ID, and execution ID for a new run's artifacts:

```text
<selected .rab project>/
  runs/<session-id>/<execution-id>.json        existing small tracking record
  audit-results/<session-id>/<execution-id>/
    summary.json                             small manifest, counts, artifact references
    records.jsonl                            append-only result records
    progress.json                            small, atomically replaced progress snapshot
```

Paths are examples of the proposed new format, not existing files. Project `settings.paths.results` remains authoritative. Preserve reading older `audit-result/v1` reports; introduce an explicit version for the new descriptor rather than silently changing the meaning of old fields.

Each JSON Lines record is one bounded unit, for example:

```json
{"sequence":42,"kind":"finding","folder":"src/atoms","file":"src/atoms/action-main.css","line":9,"column":1,"result":{"kind":"class-definition","class_name":"action-main"}}
```

Do not put every result for a large folder or file into a single line. Emit individual findings or bounded batches. Record empty/scanned files, source hashes, skips, traversal errors, and folder completion separately so absence of findings is distinguishable from absence of coverage. Associate records with their execution and scan root through the manifest; keep any necessary record identities stable.

Use relative source paths to group the viewer by folder without duplicating results into several files. The JSONL artifact stores audit data; it is not a replacement telemetry ledger or a docs report.

## Live view

Show tool, selected project, current folder/file, files scanned, findings, skipped/errors, elapsed time, last progress time, and saved artifact path. A percentage is valid only when the total is known. Traversal can report counts without inventing a total.

Distinguish actual work progress from worker liveness. A heartbeat can establish that the worker responds; it cannot prove a long-running parser is advancing. Run scanning away from the HTTP/UI event loop so a busy scanner cannot prevent status reads. Start returns a run identity promptly; status reads return small snapshots. A reconnect resumes observation of the same run and never launches a duplicate scan.

Persist completed records before advertising them as saved. Throttle progress snapshots; do not rewrite the entire result on every update. On failure or cancellation, retain completed records and mark the run incomplete. A trailing torn JSONL record is recoverable as an incomplete tail, not permission to ignore corruption in completed records. No automatic execution retry.

The viewer pages results by cursor and can filter/group by folder. It must not read the whole JSONL file, turn it into one array, or send the complete dataset back to the browser.

## Existing owners to extend

- `bridge/rab-memory.mjs`: project containment, canonical result writer, opening result artifacts, safe paged reads. Reuse its concurrency and path safeguards.
- `bridge/tool-house.mjs`: runner lifecycle, shared record-emission helper, child execution identities, failure finalization, small returned descriptors.
- `bridge/tool-tracking.mjs`: bounded summaries/references; avoid serializing an entire dataset merely to count its bytes or calculate a tracking digest.
- `tools/audit/_shared.mjs` and engine owners: incremental traversal and emission with backpressure. Accumulating all paths/findings before appending is not streaming.
- Class evidence/count owners: consume streamed records and preserve source hashes, coverage, and provenance without recreating the giant array. Partial evidence cannot qualify a change plan.
- `bridge/audit-investigations.mjs`, `server.mjs`, `magic-box/index.html`: start/status/page interface, progress UI, reconnect, scoped result browsing, understandable errors.
- Owner contract sidecars: describe the new saved descriptor and paged records. Discover engine/tool coverage dynamically rather than maintaining an installed-stamp count or hand-indexed list.

## Implementation checklist

- [ ] Reproduce and capture a bounded stack trace for the original allocation failure; preserve original receipts.
- [ ] Validate class input before any scan. Explain that `.container-main` means `container-main`, and `:hover` is a state rather than the requested class token. Do not silently reinterpret compound selectors.
- [ ] Implement the shared append writer with bounded records, backpressure, artifact identities, and failure preservation.
- [ ] Move byte counts/checksums to the write path; remove whole-dataset string construction from tracking, persistence, and HTTP returns.
- [ ] Introduce background execution and durable small progress snapshots, using existing sessions and execution IDs.
- [ ] Convert the class scan/count/investigation chain end to end, including freshness/provenance readers and paged UI consumption.
- [ ] Convert remaining scan engines using the same helper. Verify each discovered engine's streaming behavior; do not claim every tool streams simply because its final save uses a stream.
- [ ] Add live progress, folder grouping, incremental results, and clear failed/cancelled/interrupted states.
- [ ] Verify old reports still open, Toolbox describes the current contract, and audited source remains unchanged.
- [ ] Test many-folder and large-output disposable fixtures, per-record size bounds, concurrent runs, interruption, torn tails, source changes, denied paths, stale sessions, progress responsiveness, and recovery without duplicate execution.
- [ ] Record measured peak memory, output size, and elapsed time; then verify against a user-selected real project before another drive-wide scan.

The earlier 496/499 full-suite result belongs to the completed class-investigation milestone. It is historical and must not be presented as validation of this pending work.
