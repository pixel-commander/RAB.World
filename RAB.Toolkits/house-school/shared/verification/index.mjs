import { handlers, wrapping } from './handlers.mjs';
import { bags } from './bags.mjs';
import { collections } from './collections.mjs';
import { ownership } from './ownership.mjs';

const reviewers = { handlers, wrapping, bags, collections, 'selection-ownership': ownership };
export const verify = (family, source) => {
  if (!reviewers[family]) return { status: 'CANNOT_CHECK', checks: [] };
  const checks = reviewers[family](source);
  return { status: checks.some((c) => c.status === 'FAIL') ? 'FAIL' : checks.some((c) => c.status === 'CANNOT_CHECK') ? 'CANNOT_CHECK' : 'PASS', checks };
};
