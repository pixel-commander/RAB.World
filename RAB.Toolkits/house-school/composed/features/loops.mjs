import { enabled, seat } from '../core.mjs';
export const loops = (ctx) => {
  if (!enabled(ctx, 'loops')) return { body: '', markup: '' };
  const guard = seat(ctx, 'unguarded-loop', 'map', '?.', '.');
  return { body: `  // labels: an absent collection produces an empty array.\n  const items = props?.items;\n  const labels = items${guard}map((item) => item?.label ?? '') ?? [];\n`,
    markup: '{labels.map((label, index) => <span key={index}>{label}</span>)}' };
};
