import { legacy } from '../runtime.mjs';

// Direct read-only auditor calls; not the UI runner or its execution receipts.
export const reviewExisting = async (folder) => {
  const reports = [];
  for (const rule of ['bag-guards', 'prop-renames']) {
    const result = await legacy.run({ options: { folder }, context: {}, tool: { key: `audit/code-review/${rule}`, meta: { rule } } });
    if (!result.totals.files_scanned || result.totals.matches !== result.rows.length) throw new Error(`Incomplete ${rule} scan`);
    reports.push({ rule, ...result });
  }
  return { scope: 'Box bag-guards and prop-renames only; no claim of full contract coverage', reports,
    flagged: reports.some((report) => report.rows.length > 0) };
};
