import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { families, switches } from '../shared/catalog.mjs';
import { renderSpecimen, bundle } from '../shared/stamping.mjs';
import { contextualize } from '../shared/training-context.mjs';
import { verify } from '../shared/verification/index.mjs';
import { digest } from '../shared/cases.mjs';
import { reviewExisting } from '../shared/review.mjs';
import { stamp, uiRoot } from '../runtime.mjs';

const id = Date.now(), root = path.join(os.homedir(), '.rab/temp/test', String(id));
const train = [], heldOut = [], receipts = [], sourceHashes = new Set(), targetHashes = new Set();
await stamp.writeArtifactPlan({ destination: root, files: [{ path: 'run.json', text: JSON.stringify({ id, purpose: '1000-example-32b-training-preparation', trainingStarted: false }) }] });

const makeExample = async (family, index, isHeldOut) => {
  const cleanCount = isHeldOut ? 4 : 80;
  const clean = index < cleanCount;
  const masks = family.name === 'collections' ? [2, 4, 6] : [1, 2, 4];
  const mask = clean ? 0 : masks[(index - cleanCount) % masks.length];
  const packaging = index % 2 ? 'component' : 'isolated';
  const variant = isHeldOut ? 'alternate' : 'original';
  const contextualIndex = index + (isHeldOut ? 10000 : 0);
  const correct = contextualize(await renderSpecimen(family, switches(0), packaging, variant), contextualIndex, isHeldOut);
  const problem = contextualize(await renderSpecimen(family, switches(mask), packaging, variant), contextualIndex, isHeldOut);
  const code = (files) => files.find((file) => file.path === 'mechanics.mjs').text;
  const reference = verify(family.name, code(correct)), actual = verify(family.name, code(problem));
  assert.equal(reference.status, 'PASS');
  assert.equal(actual.status, clean ? 'PASS' : 'FAIL');
  assert.ok(actual.checks.every((check) => check.status !== 'CANNOT_CHECK'));
  for (const [at, rule] of family.rules.entries()) assert.equal(actual.checks.find((c) => c.rule === rule).status, switches(mask)[at] ? 'FAIL' : 'PASS');
  const target = bundle(correct), input = bundle(problem);
  const inputHash = digest(input), targetHash = digest(target);
  assert.ok(!sourceHashes.has(inputHash), 'Duplicate input');
  assert.ok(!targetHashes.has(targetHash), 'Duplicate target');
  sourceHashes.add(inputHash); targetHashes.add(targetHash);
  assert.equal(input === target, clean);
  const label = `${isHeldOut ? 'held-out' : 'train'}/${family.name}/${index}`;
  const destination = path.join(root, label);
  await stamp.writeArtifactPlan({ destination, allowedRoot: root, files: [
    ...correct.map((f) => ({ ...f, path: `canonical/${f.path}` })),
    ...problem.map((f) => ({ ...f, path: `specimen/${f.path}` })),
  ] });
  const existing = { canonical: await reviewExisting(path.join(destination, 'canonical')), specimen: await reviewExisting(path.join(destination, 'specimen')) };
  const row = { id: `house:${digest(label).slice(0, 20)}`, kind: clean ? 'identity' : 'repair', family: family.name,
    problem: `Repair only actual violations of this House contract. Preserve already-correct files and unrelated fixtureData. Return all files with FILE labels and no explanation.\n${family.contract}\n\n${input}`,
    solution: target };
  receipts.push({ case: label, id: row.id, mask, packaging, variant, reference, actual, existing,
    input_sha256: inputHash, target_sha256: targetHash, synthetic: true,
    variation: 'Small contract templates with varying data context and packaging; not independent new concepts.' });
  return row;
};

for (const family of families) {
  for (let index = 0; index < 200; index++) train.push(await makeExample(family, index, false));
  for (let index = 0; index < 10; index++) heldOut.push(await makeExample(family, index, true));
  console.log(`Prepared ${family.name}: 200 train + 10 held-out`);
}
assert.equal(train.length, 1000);
assert.equal(train.filter((r) => r.kind === 'identity').length, 400);
const config = { compilerOptions: { noEmit: true, allowJs: true, checkJs: true, strictNullChecks: true, noUnusedLocals: true,
  target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', jsx: 'preserve', skipLibCheck: true,
  paths: { react: [path.join(uiRoot, 'node_modules/@types/react/index.d.ts')] }, types: [] },
  include: ['**/canonical/**/*.tsx', '**/canonical/**/*.ts', '**/canonical/**/*.mjs'] };
await stamp.writeArtifactPlan({ destination: root, uniqueDirectory: false, files: [{ path: 'tsconfig.json', text: JSON.stringify(config) }] });
const compiler = spawnSync(process.execPath, [path.join(uiRoot, 'node_modules/typescript/bin/tsc'), '-p', path.join(root, 'tsconfig.json')], { encoding: 'utf8', timeout: 60000, maxBuffer: 8 * 1024 * 1024 });
assert.equal(compiler.status, 0, compiler.stdout + compiler.stderr);
const text = train.map((r) => JSON.stringify(r)).join('\n') + '\n';
const summary = { id, root, count: train.length, clean: 400, repairs: 600, heldOut: heldOut.length,
  passed: true, canonicalTypecheck: true, uniqueInputs: sourceHashes.size, source_sha256: digest(text),
  scope: 'Finite behavioral probes + typecheck + existing static auditors. No generated model code executed. No promotion.',
  diversity: 'Synthetic context variants of five lesson subfamilies; original implementations train, alternate implementations held out.' };
await stamp.writeArtifactPlan({ destination: root, uniqueDirectory: false, files: [
  { path: 'pairs.jsonl', text }, { path: 'held-out.jsonl', text: heldOut.map((r) => JSON.stringify(r)).join('\n') + '\n' },
  { path: 'receipts.json', text: JSON.stringify(receipts, null, 2) }, { path: 'summary.json', text: JSON.stringify(summary, null, 2) },
] });
console.log(JSON.stringify(summary, null, 2));
