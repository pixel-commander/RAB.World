import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { fixture, sentence } from './helpers.mjs';
const run = promisify(execFile);
const cli = fileURLToPath(new URL('./fixtures/cli-reference.mjs', import.meta.url));

test('CLI saves a pending ticket and resumes it in a new process with a bare reply', async t => {
  const { root, temp } = await fixture(t);
  const pending = path.join(temp, 'pending.json');
  const first = await run(process.execPath, [cli, '--project', root, '--text', sentence, '--ticket-out', pending]);
  assert.equal(JSON.parse(first.stdout).status, 'input-required');
  const second = await run(process.execPath, [cli, '--project', root, '--resume', pending, '--reply', 'app', '--execute']);
  assert.equal(JSON.parse(second.stdout).status, 'completed');
});
test('CLI canonical file uses the same validation', async t => {
  const { root, temp } = await fixture(t);
  const input = path.join(temp, 'request.json');
  await writeFile(input, JSON.stringify({ mode: 'command', capability: 'react-project', options: { name: 'api-input', location: '.', type: 'app' } }));
  const result = await run(process.execPath, [cli, '--project', root, '--canonical', input]);
  assert.equal(JSON.parse(result.stdout).status, 'ready');
});
test('CLI inspect exposes current house keys and fields', async t => {
  const { root } = await fixture(t);
  const { stdout } = await run(process.execPath, [cli, '--project', root, '--inspect']);
  const result = JSON.parse(stdout);
  const stamp = result.capabilities.find(x => x.name === 'react-project');
  assert.equal(stamp.options.name.required, true);
  assert.equal(typeof stamp.id, 'number');
});
test('CLI help is available without a project', async () => {
  const { stdout } = await run(process.execPath, [cli, '--help']);
  assert.match(stdout, /PATHS.json/);
});
test('CLI rejects multiple input sources instead of picking one', async t => {
  const { root } = await fixture(t);
  await assert.rejects(run(process.execPath, [cli, '--project', root, '--text', sentence, '--canonical', 'anything.json']));
});
test('CLI resume without an answer restores the pending state', async t => {
  const { root, temp } = await fixture(t);
  const pending = path.join(temp, 'pending.json');
  await run(process.execPath, [cli, '--project', root, '--text', sentence, '--ticket-out', pending]);
  const { stdout } = await run(process.execPath, [cli, '--project', root, '--resume', pending]);
  assert.equal(JSON.parse(stdout).status, 'input-required');
});
