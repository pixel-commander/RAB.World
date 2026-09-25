import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { families } from '../shared/catalog.mjs';
import { verify } from '../shared/verification/index.mjs';
import { execute } from '../shared/verification/probe.mjs';
import { targeted } from '../curricula/targeted-400.mjs';
import { generate } from 'file:///L:/rraabbiitt-v2/src/school/press_bridge.mjs';

const root = `C:/Users/gauge/.rab/temp/test/${Date.now()}`;
const hash = (text) => createHash('sha256').update(text).digest('hex');
const rows = [], receipts = [];
const easyCss = process.argv.includes('--easy-css');
const cleanRatio = easyCss ? .25 : .4;
const cssCount = easyCss ? 300 : 40;
const weights = easyCss
  ? { handlers: 20, bags: 20, wrapping: 20, 'selection-ownership': 20, collections: 20 }
  : { handlers: 120, bags: 100, wrapping: 80, 'selection-ownership': 40, collections: 20 };
const types = await readFile(new URL('../templates/mechanics/HouseKeys.types.ts', import.meta.url), 'utf8');
const priorPaths = [
  'C:/Users/gauge/.rab/temp/test/1790225264065/held-out.jsonl',
  'C:/Users/gauge/.rab/temp/test/1790252600617/fresh.jsonl',
  'C:/Users/gauge/Documents/Codex/2026-09-23/r-boot-seqs-txt/outputs/lora-v2-round2-data/held-out/pairs.jsonl',
  'C:/Users/gauge/Documents/Codex/2026-09-23/r-boot-seqs-txt/outputs/lora-pilot/held-out/pairs.jsonl',
];
const held = [];
for (const file of priorPaths) held.push(...(await readFile(file, 'utf8')).trim().split('\n').map(JSON.parse));
const forbidden = new Set(held.flatMap((r) => [hash(r.problem), hash(r.solution)]));
const check = (family, source) => {
  const checks = verify(family, source).checks;
  if (family === 'selection-ownership') {
    for (const setter of [undefined, null, false, 9]) {
      const local = () => {};
      const bag = execute(source, 'packBag(input, internal)', { input: { setSelected: setter }, internal: ['local', local] });
      checks.push({ rule: 'non-callable-owner', status: bag.selected === 'local' && bag.setSelected === local ? 'PASS' : 'FAIL' });
    }
  }
  return checks;
};
for (const [name, count] of Object.entries(weights)) {
  const family = families.find((f) => f.name === name);
  for (let index = 0; index < count; index++) {
    const clean = index < count * cleanRatio;
    const defect = clean ? 0 : 1 + (index - count * cleanRatio) % 3;
    const render = (defect) => easyCss
      ? family.render([1, 2, 3].map((n) => n === defect))
      : targeted(name, defect, index % 2);
    const canonical = render(0), specimen = render(defect);
    const good = check(name, canonical), actual = check(name, specimen);
    assert.ok(good.every((c) => c.status === 'PASS'), name);
    assert.equal(actual.some((c) => c.status === 'FAIL'), !clean, name + defect);
    const typeText = name === 'selection-ownership' ? types.replace('setSelected?: SelectionSetter;', 'setSelected?: unknown;') : types;
    const bundle = (code) => `FILE: HouseKeys.types.ts\n${typeText}\nFILE: mechanics.mjs\n${code}\nexport const fixtureData = { title: 'Practice ${name} ${index}', options: { limit: ${index + 1} } };\n`;
    const contract = family.contract + ' Props may be null or undefined.' + (name === 'selection-ownership' ? ' The internal pair is supplied and valid; non-callable setters must use it.' : '');
    const problem = `Repair only actual violations. Preserve valid code and fixtureData. Return all files with FILE labels and no explanation.\n${contract}\n\n${bundle(specimen)}`;
    const solution = bundle(canonical);
    rows.push({ id: `targeted:${hash(problem).slice(0, 20)}`, family: name, kind: clean ? 'identity' : 'repair', problem, solution, suite: 'house' });
    receipts.push({ id: rows.at(-1).id, defect, good, actual, synthetic: true, source: 'curricula/targeted-400.mjs' });
  }
}
for (let i = 0, attempt = 0; i < cssCount && attempt < 20000; attempt++) {
  const clean = i < cssCount * cleanRatio;
  const sample = generate({ seed: (easyCss ? 94002400 : 24094000) + attempt * 7919, depth: easyCss ? 1 : 1 + i % 3, globalWrong: clean ? 0 : 1, localWrong: easyCss ? .01 : .12, maxTries: 1, nestOneArea: false, output: 'object' });
  if (sample.bridgeStatus || sample.canonicalReview.status !== 'PASS' || sample.inputReview.status !== (clean ? 'PASS' : 'FAIL')) continue;
  if (!clean && (sample.mutations.length < 1 || sample.mutations.length > 2)) continue;
  if (easyCss && !clean && sample.mutations.length !== 1) continue;
  if (forbidden.has(hash(sample.modelInput)) || forbidden.has(hash(sample.correctCode))) continue;
  if (rows.some((r) => r.problem === sample.modelInput || r.solution === sample.correctCode)) continue;
  rows.push({ id: sample.id, family: 'css-grid', suite: 'css', kind: clean ? 'identity' : 'repair', problem: sample.modelInput, solution: sample.correctCode });
  receipts.push({ id: sample.id, knobs: sample.knobs, mutations: sample.mutations, canonicalReview: sample.canonicalReview, inputReview: sample.inputReview });
  i++;
}
assert.equal(rows.length, 400);
assert.equal(rows.filter((r) => r.kind === 'identity').length, 400 * cleanRatio);
assert.equal(new Set(rows.map((r) => r.problem)).size, 400);
for (const row of rows) for (const field of ['problem', 'solution']) assert.ok(!forbidden.has(hash(row[field])), 'Heldout overlap');
const text = rows.map(JSON.stringify).join('\n') + '\n';
await mkdir(root);
await writeFile(root + '/pairs.jsonl', text, { flag: 'wx' });
await writeFile(root + '/receipts.json', JSON.stringify(receipts, null, 2), { flag: 'wx' });
await writeFile(root + '/authorization.json', JSON.stringify({ by: 'Gauge', instruction: easyCss ? 'again 400 100 correct ... set the dials all the way down ... a lot of css repair training or the house repairs exact match' : 'lets do 400 and lean in on the handler/bag stuff and ease off the css ... keep the ratios the same', scope: `400 examples, ${400 * cleanRatio} clean; new 32B adapter; no promotion`, sha256: hash(text) }, null, 2), { flag: 'wx' });
await writeFile(root + '/summary.json', JSON.stringify({ count: 400, clean: 400 * cleanRatio, repair: 400 * (1-cleanRatio), weights: { ...weights, 'css-grid': cssCount }, difficulty: easyCss ? 'depth 1 CSS, exactly one mutation; direct House templates' : 'targeted', passed: true, source_sha256: hash(text), limitation: 'Repeated authored templates with data variation; not 400 independent concepts. Prior evaluations stay held out.' }, null, 2), { flag: 'wx' });
console.log(root);
