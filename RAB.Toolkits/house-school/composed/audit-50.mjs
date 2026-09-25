import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { generate } from './index.mjs';
import { review } from './review.mjs';

const output = process.argv[2];
if (!output) throw new Error('Pass a NEW output folder');
await mkdir(output, { recursive: false });
const rules = ['classes', 'container-atom', 'action-atom', 'effect-atom', 'css', 'data-grid', 'grid-area', 'handler-order', 'handler-guard', 'bag-guard', 'bag-rename', 'bag-order', 'unguarded-loop', 'bad-nest', 'convention-arrow', 'convention-export'];
const records = [];
for (let index = 0; index < 50; index++) {
  const clean = index < 20;
  const slot = index - 20;
  const errors = clean ? {} : { [rules[slot % rules.length]]: { amount: 1 } };
  if (!clean && slot >= 16) errors[rules[(slot + 5) % rules.length]] = { amount: 1 };
  const knobs = { seed: 250925 + index * 7919, depth: [1, 2, 4, 8, 16, 32][index % 6],
    width: 1 + index % 4, areas: [2, 3, 5][index % 3], houseKeyCoverage: [0, 0.5, 1][index % 3], errors };
  if (clean) {
    knobs.atomTypes = index % 4;
    knobs.features = { loops: { coverage: (index % 3) / 2 }, bags: { enabled: index % 4 !== 0 },
      'house-handlers': { coverage: (index % 3) / 2 } };
    if (index % 5 === 0) knobs.groups = { layout: { enabled: false } };
  }
  const result = generate(knobs);
  const directory = path.join(output, `case-${String(index + 1).padStart(2, '0')}`);
  await mkdir(directory);
  await writeFile(path.join(directory, 'receipt.json'), JSON.stringify(result, null, 2));
  const record = { case: index + 1, clean, depth: knobs.depth, status: result.status, expected: clean ? 'PASS' : 'FAIL' };
  if (result.canonical && result.specimen) {
    const canonicalReview = review(result.canonical);
    const specimenReview = review(result.specimen);
    record.canonical = canonicalReview.status;
    record.actual = specimenReview.status;
    record.mutations = result.receipt.actualMutations;
    record.rules = Object.keys(errors);
    record.replayIdentical = JSON.stringify(generate(knobs)) === JSON.stringify(result);
    record.unresolvedTokens = JSON.stringify(result.specimen).includes('__SEAT_') || JSON.stringify(result.canonical).includes('__SEAT_');
    for (const kind of ['canonical', 'specimen']) {
      await mkdir(path.join(directory, kind));
      for (const [name, source] of Object.entries(result[kind])) await writeFile(path.join(directory, kind, name), source);
    }
  }
  records.push(record);
}
const summary = { cases: 50, clean: 20, broken: 30,
  canonicalPass: records.filter((r) => r.canonical === 'PASS').length,
  falsePass: records.filter((r) => !r.clean && r.actual === 'PASS').length,
  falseFail: records.filter((r) => r.clean && r.actual === 'FAIL').length,
  unexpected: records.filter((r) => r.status !== 'GENERATED' || r.actual !== r.expected || r.canonical !== 'PASS' || !r.replayIdentical || r.unresolvedTokens),
  replayIdentical: records.filter((r) => r.replayIdentical).length,
  rulesCovered: [...new Set(records.flatMap((r) => r.rules || []))], records,
  scope: 'Generated fixture self-check only; no model evaluation or training. Not proof against arbitrary repairs. Typecheck is a separate command.' };
await writeFile(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2));
await writeFile(path.join(output, 'tsconfig.json'), JSON.stringify({ compilerOptions: { noEmit: true, strict: true, target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', jsx: 'react-jsx', skipLibCheck: true, types: [], paths: { react: ['F:/rraabbiitt.ai/node_modules/@types/react/index.d.ts'], 'react/jsx-runtime': ['F:/rraabbiitt.ai/node_modules/@types/react/jsx-runtime.d.ts'] } }, include: ['case-*/canonical/**/*.ts', 'case-*/canonical/**/*.tsx'] }, null, 2));
console.log(JSON.stringify({ ...summary, records: undefined }, null, 2));
assert.equal(summary.unexpected.length, 0, 'See saved cases for review discrepancies');
