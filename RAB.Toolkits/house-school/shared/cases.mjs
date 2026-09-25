import assert from 'node:assert/strict';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { stamp } from '../runtime.mjs';
import { switches } from './catalog.mjs';
import { renderSpecimen, bundle } from './stamping.mjs';
import { verify } from './verification/index.mjs';
import { reviewExisting } from './review.mjs';
import { candidate } from './export.mjs';

export const digest = (text) => createHash('sha256').update(text).digest('hex');
export const buildCase = async ({ family, packaging, mask, root, variant = 'original' }) => {
  const label = `${family.name}/${packaging}/mask-${mask}`;
  const flags = switches(mask);
  const clean = await renderSpecimen(family, [false, false, false], packaging, variant);
  const specimen = await renderSpecimen(family, flags, packaging, variant);
  assert.equal(bundle(specimen), bundle(await renderSpecimen(family, flags, packaging, variant)), 'Replay drift');
  const mechanics = (files) => files.find((file) => file.path === 'mechanics.mjs').text;
  const canonical = verify(family.name, mechanics(clean));
  assert.equal(canonical.status, 'PASS', `Invalid canonical: ${label}`);
  const reviewed = verify(family.name, mechanics(specimen));
  assert.equal(reviewed.status, mask ? 'FAIL' : 'PASS', `Wrong aggregate verdict: ${label}`);
  const expected = family.rules.filter((rule, index) => flags[index]);
  const missing = expected.filter((rule) => !reviewed.checks.some((check) => check.rule === rule && check.status === 'FAIL'));
  const unexpected = reviewed.checks.filter((check) => check.status === 'FAIL' && !expected.includes(check.rule));
  assert.equal(unexpected.length, 0, `Collateral failure: ${label}`);
  const uncertain = reviewed.checks.some((check) => check.status === 'CANNOT_CHECK');
  const record = { case: label, family: family.name, packaging, mask, variant, contract: family.contract,
    expectedViolations: expected, canonical, reviewed, missingIndependentDetections: missing,
    trainingEligible: missing.length === 0 && !uncertain,
    input_sha256: digest(bundle(specimen)), target_sha256: digest(bundle(clean)),
    mutations: family.rules.map((rule, index) => ({ rule, broken: flags[index] })) };
  const destination = path.join(root, label);
  await stamp.writeArtifactPlan({ destination, allowedRoot: root, files: [
    ...clean.map((file) => ({ ...file, path: `canonical/${file.path}` })),
    ...specimen.map((file) => ({ ...file, path: `specimen/${file.path}` })),
  ] });
  record.existing = { canonical: await reviewExisting(path.join(destination, 'canonical')), specimen: await reviewExisting(path.join(destination, 'specimen')) };
  await stamp.writeArtifactPlan({ destination, allowedRoot: root, uniqueDirectory: false,
    files: [{ path: 'receipt.json', text: JSON.stringify(record, null, 2) }] });
  return { record, candidate: record.trainingEligible ? candidate(record, specimen, clean) : null };
};
