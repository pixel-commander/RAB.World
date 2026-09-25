# Shared runner follow-ups

Recorded 2026-09-20. Status: not started.
Project: `C:\Users\pixelcommander\Desktop\RRAABBIITT_v0.9.3`.

These are the outstanding verification follow-ups from the shared runner
migration, not a request to start them automatically.

- [ ] Restart the normal application to load the migrated runner.
  Confirm the running process uses this Desktop project before restarting it.
  Verify the Workbench catalog and a representative request after restart.
  Do not launch or edit the Documents/ChatGPT copy.
- [ ] Build-test freshly generated React project output.
  Generate an isolated example through the current runner, install dependencies
  in that example when authorized, and run its declared production build.
  Check both the default starter and the optional StyleGuide starter; record
  output location, commands, results and any failures. Prior source/hash checks
  did not establish production-build success.
- [ ] Rerun the three Windows symlink-permission-blocked security tests.
  First arrange an environment permitted to create the test symlinks; do not
  silently change Windows security settings or skip the probes.
  Affected tests are in `tests/dom-edit-security-v085.test.mjs`,
  `tests/full-house-v085.test.mjs`, and `tests/server.test.mjs`.
  Record whether the probes actually pass, not merely whether setup succeeds.

Baseline: 451/454 tests passed; the three failures were EPERM during symlink
fixture creation. Keep that distinction in future comparisons.

## Evidence and completion

Append dated results here and check off an item only when its stated verification
is complete. Link any detailed report rather than duplicating it.

- [Migration report](../session-audits/2026-09-20-shared-stamp-runner.md)
- [Runner process](../process/runner.md)
