import path from 'node:path';
import os from 'node:os';
import { readFile } from 'node:fs/promises';
import { families, switches } from '../shared/catalog.mjs';
import { verify } from '../shared/verification/index.mjs';
import { classify, summarize } from '../shared/active-review.mjs';
import { stamp } from '../runtime.mjs';

// Optional JSON ledger: { "family/rule": { "corrections": 4, "supported": false } }.
// Explicit ledger path errors must stop the run, not silently reset the budget.
const ledgerPath = process.argv[2];
const ledger = ledgerPath ? JSON.parse(await readFile(ledgerPath, 'utf8')) : {};
const records = [];
for (const family of families) {
  for (const variant of ['render', 'renderAlternate']) {
    for (let mask = 0; mask < 8; mask++) {
      const flags = switches(mask);
      const result = verify(family.name, family[variant](flags));
      for (const [index, rule] of family.rules.entries()) {
        const policy = ledger[`${family.name}/${rule}`] || {};
        const check = result.checks.find((item) => item.rule === rule);
        records.push(classify({ id: `${family.name}/${variant}/${mask}/${rule}`,
          expected: flags[index] ? 'FAIL' : 'PASS', checks: check ? [check] : [], ...policy }));
      }
    }
  }
}
const root = path.join(os.homedir(), '.rab', 'temp', 'test', String(Date.now()));
const summary = { ...summarize(records), root,
  scope: 'Trusted generated mechanics, all masks, both variants; not arbitrary model-output execution or full-page proof.' };
await stamp.writeArtifactPlan({ destination: root, files: [
  { path: 'summary.json', text: JSON.stringify(summary, null, 2) },
  { path: 'active.json', text: JSON.stringify(records.filter((record) => record.admitted), null, 2) },
  { path: 'excluded.json', text: JSON.stringify(records.filter((record) => !record.admitted), null, 2) },
  { path: 'correction-ledger.json', text: JSON.stringify(ledger, null, 2) },
] });
console.log(JSON.stringify(summary, null, 2));
if (summary.disagreements.length) process.exitCode = 1;
