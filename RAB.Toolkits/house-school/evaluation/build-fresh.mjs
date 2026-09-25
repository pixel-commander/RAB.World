import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { families } from '../shared/catalog.mjs';
import { verify } from '../shared/verification/index.mjs';
import { execute } from '../shared/verification/probe.mjs';
import { renderFresh } from './fresh-families.mjs';

const destination = process.argv[2];
assert.ok(destination, 'Explicit new output directory required');
const types = await readFile(new URL('../templates/mechanics/HouseKeys.types.ts', import.meta.url), 'utf8');
const oldRoot = 'C:/Users/gauge/.rab/temp/test/1790225264065/';
const historical = [];
for (const file of ['pairs.jsonl', 'held-out.jsonl']) {
  historical.push(...(await readFile(oldRoot + file, 'utf8')).trim().split('\n').map(JSON.parse));
}
const oldAnswers = new Set(historical.map((row) => row.solution));
const rows = [];
const receipts = [];
for (const family of families) {
  for (const variant of [0, 1]) {
    for (const [slot, bad] of [0, 0, 1, 2, 3].entries()) {
      const canonical = renderFresh(family.name, variant, 0);
      const broken = renderFresh(family.name, variant, bad);
      const inspect = (source) => {
        const checks = verify(family.name, source).checks;
        if (family.name === 'selection-ownership') {
          for (const setSelected of [undefined, null, false, 7]) {
            const local = () => {};
            const result = execute(source, 'packBag(input, internal)', {
              input: { setSelected, selected: 'ignored' }, internal: ['local', local],
            });
            checks.push({ rule: 'non-callable-setter', status: result.selected === 'local' && result.setSelected === local ? 'PASS' : 'FAIL' });
          }
        }
        return checks;
      };
      const cleanChecks = inspect(canonical);
      assert.ok(cleanChecks.every((c) => c.status === 'PASS'), JSON.stringify(cleanChecks));
      const observed = inspect(broken);
      assert.equal(observed.some((c) => c.status === 'FAIL'), Boolean(bad));
      // Two clean controls per structure differ in inert data, not rule coverage.
      const suffix = `\nexport const fixtureData = { title: 'Fresh ${family.name} ${variant} ${slot}', version: 2 };\n`;
      const bundle = (source) => `FILE: HouseKeys.types.ts\n${types}\nFILE: mechanics.mjs\n${source}\n${suffix}`;
      const solution = bundle(canonical);
      assert.ok(!oldAnswers.has(solution));
      const contract = family.contract + ' Props may be undefined or null. ' +
        (family.name === 'selection-ownership' ? 'setSelected can be any runtime value; only a function grants caller ownership. The supplied internal state pair is valid.' : '') +
        (family.name === 'wrapping' ? 'Callback return-value forwarding is not required.' : '') +
        (family.name === 'collections' ? 'Arrays in this evaluation are dense (no holes).' : '');
      const problem = `Repair only actual violations. Preserve valid code and unrelated fixtureData. Return complete files with FILE labels and no explanation.\n${contract}\n\n${bundle(broken)}`;
      const id = 'fresh:' + createHash('sha256').update(problem).digest('hex').slice(0, 20);
      rows.push({ id, family: family.name, kind: bad ? 'repair' : 'identity', problem, solution });
      receipts.push({ id, variant, mutation: bad, canonicalChecks: cleanChecks, specimenChecks: observed });
    }
  }
}
assert.equal(rows.length, 50);
assert.equal(rows.filter((r) => r.kind === 'identity').length, 20);
assert.equal(new Set(rows.map((r) => r.problem)).size, 50);
await mkdir(destination, { recursive: false });
await writeFile(destination + '/fresh.jsonl', rows.map(JSON.stringify).join('\n') + '\n', { flag: 'wx' });
await writeFile(destination + '/fixture-receipts.json', JSON.stringify(receipts, null, 2), { flag: 'wx' });
console.log(JSON.stringify({ destination, cases: rows.length, clean: 20, repair: 30, trustedFixtureChecks: 'PASS', independentStructures: 10 }));
