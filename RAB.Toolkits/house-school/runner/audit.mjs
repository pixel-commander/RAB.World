import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stamp } from '../runtime.mjs';
import { verify } from '../shared/verification/index.mjs';
import { digest } from '../shared/cases.mjs';
import { bundle } from '../shared/stamping.mjs';

const source = path.resolve(process.argv[2]);
const prior = process.argv[3] ? JSON.parse(await readFile(path.join(process.argv[3], 'records.json'), 'utf8')) : [];
const records = JSON.parse(await readFile(path.join(source, 'records.json'), 'utf8'));
const id = Date.now(), root = path.join(os.homedir(), '.rab/temp/test', String(id));
const checked = [], held = [];
for (const record of records) {
  const directory = path.join(source, record.case);
  const clean = await stamp.renderTemplateTree(path.join(directory, 'canonical'));
  const specimen = await stamp.renderTemplateTree(path.join(directory, 'specimen'));
  // renderTemplateTree enumeration and original stamp order differ: compare by manifest filenames.
  const order = ['HouseKeys.types.ts', 'mechanics.mjs', 'css/fixture.css', 'css.d.ts', 'Fixture.tsx'];
  const ordered = (files) => files.sort((a, b) => order.indexOf(a.path) - order.indexOf(b.path));
  assert.equal(digest(bundle(ordered(clean))), record.target_sha256, `Target bytes drifted: ${record.case}`);
  assert.equal(digest(bundle(ordered(specimen))), record.input_sha256, `Input bytes drifted: ${record.case}`);
  const mechanics = (files) => files.find((f) => f.path === 'mechanics.mjs').text;
  assert.equal(verify(record.family, mechanics(clean)).status, 'PASS');
  const result = verify(record.family, mechanics(specimen));
  assert.equal(result.status, record.mask ? 'FAIL' : 'PASS');
  const findings = record.existing.specimen.reports.flatMap((r) => r.rows);
  const reasons = [];
  if (!record.trainingEligible) reasons.push('masked-check');
  if (record.mask && !findings.length) reasons.push('box-unflagged-broken');
  if (findings.some((f) => f.rule === 'bag-optional-guard' && f.text.startsWith('delete bag.'))) reasons.push('box-spurious-delete-guard');
  const row = { case: record.case, status: result.status, reasons,
    checks: result.checks, findings, trainingEligible: record.trainingEligible };
  checked.push(row);
  if (reasons.length) held.push({ row, files: [...clean.map((f) => ({ ...f, path: `canonical/${f.path}` })), ...specimen.map((f) => ({ ...f, path: `specimen/${f.path}` }))] });
}
const summary = { id, source, root, verifiedCases: checked.length,
  uniqueInputs: new Set(records.map((r) => r.input_sha256)).size,
  repeatedPriorInputs: records.filter((r) => prior.some((p) => p.input_sha256 === r.input_sha256)).length,
  cleanFalseFailures: checked.filter((r) => r.status === 'PASS' && r.findings.length).length,
  unflaggedBroken: checked.filter((r) => r.reasons.includes('box-unflagged-broken')).length,
  spuriousDeleteGuard: checked.filter((r) => r.reasons.includes('box-spurious-delete-guard')).length,
  masked: checked.filter((r) => r.reasons.includes('masked-check')).length,
  issueCases: held.length,
  scope: 'Finite generated fixtures only. Box bag-guards and prop-renames; no general-program correctness claim.' };
await stamp.writeArtifactPlan({ destination: root, files: [
  { path: 'audit.json', text: JSON.stringify({ summary, cases: checked }, null, 2) },
  { path: 'issues.json', text: JSON.stringify(held.map((h) => h.row), null, 2) },
  ...held.flatMap((h) => h.files.map((f) => ({ ...f, path: `issues/${h.row.case}/${f.path}` }))),
] });
console.log(JSON.stringify(summary, null, 2));
