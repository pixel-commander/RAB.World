// Exclusion is a dataset decision, never a third active review verdict.
export const admit = ({ checks, corrections = 0, supported = true }) => {
  const reasons = [];
  if (!supported) reasons.push('unsupported-contract');
  if (corrections > 3) reasons.push('correction-budget-exceeded');
  if (!checks.length || checks.some((check) => !['PASS', 'FAIL'].includes(check.status))) reasons.push('non-binary-or-empty-review');
  if (reasons.length) return { admitted: false, reasons };
  return { admitted: true, verdict: checks.some((check) => check.status === 'FAIL') ? 'FAIL' : 'PASS', reasons: [] };
};
