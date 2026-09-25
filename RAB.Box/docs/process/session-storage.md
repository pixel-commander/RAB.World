# Project session directory

Project configuration and session history have separate owners. Session creation
and saves do not add a session list to, or rewrite, project `settings.json`.

```text
.rab/projects/<project-directory>/
  settings.json                 project configuration
  sessions.json                 derived project session directory/map
  sessions/<numeric-id>/
    settings.json               session node identity and typed project parent
    state.json                  session metadata, bag, groups, steps, turns
  runs/<session-id>/             existing separate execution records
```

`createSession(project, {name, title, description})` requires a nonblank name
(maximum 120 characters). Title defaults to the name (maximum 240 characters);
description defaults to an empty string (maximum 20,000 characters). IDs use
the existing numeric allocator, not names. Different projects can therefore
each have a session named `project-start` without identity collisions.

The no-options internal `createSession(project)` signature remains available
for existing non-UI integrations. It creates a generated `session-<id>` name.
User-facing creation must pass explicit options, never use that compatibility
signature as a fallback for missing input. Creation/selection policies belong
to the service and conversation flow, not this persistence owner.

## Map and resume

`sessions.json` is a `rab-session-index/v1` envelope with `project_id`,
`updated_at`, and `sessions`, a map keyed by the string representation of each
numeric session ID. Every summary includes name, title, description, status,
timestamps, revision, group/step/turn counts, and domain. `fingerprints` is
internal cache metadata: state file size and mtime.

The session folder remains authoritative. Listing checks numeric directories
and file fingerprints, refreshing stale/missing summaries in memory. It never
writes or rebuilds the map on a read. Missing, malformed JSON, wrong-version,
or wrong-project maps fall back to the saved session folders. Filesystem access
errors and invalid canonical session state surface as errors, not empty lists.

Older states without names use the existing session descriptor. Missing
descriptors get explicit display fallbacks, not invented user descriptions.
`metadata_source` identifies `session-state`, `session-descriptor`, or
`legacy-fallback`. Descriptor-derived summaries are re-read, not cached across
calls. Session listing returns all entries, most recently updated first,
breaking timestamp ties by numeric ID. Both the map and returned list include
all discovered sessions; the previous silent 100-session cap is removed.

Creating or saving a session refreshes the map under the existing per-project
memory lock. Concurrent saves to different sessions therefore do not overwrite
each other's map entries. No live-data migration, deletion, or bulk rewrite of
existing session folders is performed.

## Partial writes and limits

State and map files are individually atomic replacements, not a multi-file
transaction. State commits before the derived map. If map refresh fails, the
operation reports `SESSION_INDEX_WRITE_FAILED`, `session_saved: true`, and
`session_id`; callers must not blindly create a duplicate session. The saved
state remains available, and listing recovers stale map data when readable.
Successful later session saves refresh the map.

Directory enumeration and fingerprint checks scale with the number of saved
sessions; there is currently no paging or project-session-count limit. Cached
summaries avoid parsing unchanged session bodies, but the map itself is read
as one JSON document. Large-history pagination is future work, not a silently
truncated result.

Fingerprint checks detect normal atomic saves but are not tamper detection:
an external same-size edit preserving mtime can evade the summary cache.
Groups, steps, and turns remain arrays inside each session's state file; this
change does not introduce separate files for them. Execution records remain
under `runs`, and deleting session history/related executions is not implemented
by this change. Selection does not execute saved steps.
