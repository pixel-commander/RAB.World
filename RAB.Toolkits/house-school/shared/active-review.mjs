import { admit } from './admission.mjs';

// Admission and correctness are separate: exclusions never enter accuracy totals.
export const classify = ({ id, expected, checks, corrections = 0, supported = true }) => {
  const admission = admit({ checks, corrections, supported });
  if (!['PASS', 'FAIL'].includes(expected)) return { id, admitted: false, reasons: ['missing-binary-oracle'], checks };
  if (!admission.admitted) return { id, ...admission, checks };
  return { id, ...admission, expected, agrees: admission.verdict === expected, checks };
};

export const summarize = (records) => {
  const active = records.filter((record) => record.admitted);
  return {
    total: records.length, admitted: active.length, excluded: records.length - active.length,
    falsePasses: active.filter((record) => record.verdict === 'PASS' && record.expected === 'FAIL').length,
    falseFailures: active.filter((record) => record.verdict === 'FAIL' && record.expected === 'PASS').length,
    disagreements: active.filter((record) => !record.agrees).map((record) => record.id),
  };
};
