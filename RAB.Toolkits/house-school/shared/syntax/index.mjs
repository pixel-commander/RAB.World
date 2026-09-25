import { parseSource } from './tree.mjs';
import { handlerFindings } from './handlers.mjs';
import { boundaryFindings } from './boundaries.mjs';
import { bagFindings } from './bags.mjs';

export const reviewSyntax = (source) => {
  if (typeof source !== 'string' || !source.trim()) return { status: 'FAIL', findings: [{ rule: 'empty-output' }] };
  try {
    const tree = parseSource(source);
    const findings = [...handlerFindings(tree), ...boundaryFindings(tree), ...bagFindings(tree)];
    return { status: findings.length ? 'FAIL' : 'PASS', findings,
      scope: 'Listed syntax contracts only; no arbitrary behavior or whole-project proof.' };
  } catch (error) {
    return { status: 'FAIL', findings: [{ rule: 'invalid-syntax', why: error.message }] };
  }
};
