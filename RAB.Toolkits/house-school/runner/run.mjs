import path from 'node:path';
import os from 'node:os';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { options } from './options.mjs';
import { buildCase, digest } from '../shared/cases.mjs';
import { stamp, boxRoot, uiRoot } from '../runtime.mjs';

const id = Date.now();
const root = path.join(os.homedir(), '.rab', 'temp', 'test', String(id));
const records = [], candidates = [];
const selected = options(process.argv.slice(2));
await stamp.writeArtifactPlan({ destination: root, files: [{ path: 'run.json', text: JSON.stringify({ id, kind: 'house-school', candidateOnly: true }) }] });
for (const family of selected.families) {
  for (const packaging of selected.packaging) {
    for (const mask of selected.masks) {
      const result = await buildCase({ family, packaging, mask, root, variant: selected.variant });
      records.push(result.record);
      if (result.candidate) candidates.push(result.candidate);
    }
  }
  console.log(`Verified ${family.name}`);
}

const tsconfig = {
  compilerOptions: { noEmit: true, allowJs: true, checkJs: true, strictNullChecks: true, noUnusedLocals: true,
    target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', jsx: 'preserve', skipLibCheck: true,
    paths: { react: [path.join(uiRoot, 'node_modules/@types/react/index.d.ts')] },
    types: [], },
  include: ['**/canonical/**/*.tsx', '**/canonical/**/*.ts', '**/canonical/**/*.mjs'],
};
await stamp.writeArtifactPlan({ destination: root, uniqueDirectory: false, files: [{ path: 'tsconfig.json', text: JSON.stringify(tsconfig, null, 2) }] });
const compiler = spawnSync(process.execPath, [path.join(uiRoot, 'node_modules/typescript/bin/tsc'), '-p', path.join(root, 'tsconfig.json')], { encoding: 'utf8', timeout: 60000 });
const canonicalTypes = { status: compiler.status === 0 ? 'PASS' : 'FAIL', output: compiler.stdout + compiler.stderr, scope: 'canonical TSX/types and JSDoc-typed JS; checkJs=true, no React DOM execution' };
const legacySource = await readFile(path.join(boxRoot, 'tools/audit/code-review/code-review.mjs'), 'utf8');
const sourceFiles = await stamp.renderTemplateTree(fileURLToPath(new URL('../', import.meta.url)));
const summary = { id, root, variant: selected.variant, masks: selected.masks, total: records.length, clean: records.filter((r) => r.mask === 0).length,
  broken: records.filter((r) => r.mask !== 0).length, trainingCandidates: canonicalTypes.status === 'PASS' ? candidates.length : 0,
  quarantined: records.filter((r) => !r.trainingEligible).map((r) => r.case), canonicalTypes,
  existingReview: {
    cleanFlagged: records.filter((r) => r.mask === 0 && r.existing.specimen.flagged).length,
    brokenFlagged: records.filter((r) => r.mask !== 0 && r.existing.specimen.flagged).length,
    brokenUnflagged: records.filter((r) => r.mask !== 0 && !r.existing.specimen.flagged).length,
    scope: 'bag-guards + prop-renames only; aggregate detection is not per-rule proof',
  },
  provenance: { auditor_sha256: digest(legacySource), source_sha256: digest(JSON.stringify(sourceFiles)) },
  noTrainingLaunched: true, frozenPressUntouched: true,
};
await stamp.writeArtifactPlan({ destination: root, uniqueDirectory: false, files: [
  { path: 'summary.json', text: JSON.stringify(summary, null, 2) },
  { path: 'records.json', text: JSON.stringify(records, null, 2) },
  { path: 'candidates.jsonl', text: canonicalTypes.status === 'PASS' ? candidates.map((row) => JSON.stringify(row)).join('\n') + '\n' : '' },
] });
console.log(JSON.stringify(summary, null, 2));
if (canonicalTypes.status !== 'PASS') process.exitCode = 1;
