import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { generate } from './index.mjs';

const [configPath, output] = process.argv.slice(2);
if (!configPath || !output) throw new Error('Usage: node composed/cli.mjs CONFIG.json NEW_OUTPUT_DIRECTORY');
const config = JSON.parse(await readFile(configPath, 'utf8'));
const result = generate(config);
await mkdir(output, { recursive: false });
await writeFile(path.join(output, 'receipt.json'), JSON.stringify({ status: result.status, knobs: result.knobs, ...result.receipt, reason: result.reason }, null, 2));
if (result.status !== 'GENERATED') throw new Error(`${result.status}: ${result.reason || 'review disagreement; quarantined'}`);
for (const kind of ['canonical', 'specimen']) {
  await mkdir(path.join(output, kind));
  for (const [name, source] of Object.entries(result[kind])) await writeFile(path.join(output, kind, name), source);
}
await writeFile(path.join(output, 'candidate.jsonl'), JSON.stringify({ problem: result.problem, solution: result.solution, trainingApproved: false }) + '\n');
console.log(JSON.stringify({ output, status: result.status, depth: result.knobs.depth, mutations: result.receipt.actualMutations, trainingApproved: false }));
