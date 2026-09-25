# RRAABBIITT project instructions

## Saved data moves forward

User instruction, recorded 2026-09-21:

- Do not add backward compatibility to the application to accommodate old saved data.
- When a data format changes, move the data forward to the current contract through an explicitly scoped migration. Do not keep old-format readers, fallback routes, or duplicate runtime paths as the development strategy.
- Preserve original records before an authorized migration. Do not silently rewrite history or delete saved work.
- This instruction is prospective. The user explicitly deferred existing compatibility removal and old-data migration on 2026-09-21. Recording the rule is not permission to start that work.

## Storage and IDs

- All Box-owned settings, sessions, results, requests, logs, backups, and test output belong under the current computer user's home `.rab` directory. On Windows this is the user's profile directory, not the app installation, Desktop, or AppData preview folder.
- Actual project source edits belong in the selected project source folder.
- IDs are positive numeric timestamps observed from `Date.now()`, without hashes or prefixes. Do not substitute independent counters or seed runtime IDs from the highest catalog ID.
- Diagnose duplicate creation or split storage using evidence. Do not assume the user created two records in the same millisecond.

## Shared work

- Coordinate before editing files another session is actively changing. Preserve their work.
- Read current project rules and relevant stamp contracts before implementation. This file does not replace those rules.
