// Keep the isolated evidence suite in the existing top-level test entry glob.
import { after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, realpath, rm } from 'node:fs/promises';

const home = await realpath(await mkdtemp(path.join(os.tmpdir(), 'rab-evidence-home-')));
const previousHome = process.env.RAB_HOME;
process.env.RAB_HOME = home;
after(async () => {
  if (previousHome === undefined) delete process.env.RAB_HOME;
  else process.env.RAB_HOME = previousHome;
  assert.equal(path.dirname(home), await realpath(os.tmpdir()));
  assert.ok(path.basename(home).startsWith('rab-evidence-home-'));
  await rm(home, { recursive: true, force: true });
});

await import('./audit-evidence/records.test.mjs');
await import('./audit-evidence/scanner.test.mjs');
await import('./audit-evidence/verification.test.mjs');
await import('./audit-evidence/workflow.test.mjs');
await import('./audit-evidence/ui.test.mjs');
await import('./audit-evidence/css-filter.test.mjs');
