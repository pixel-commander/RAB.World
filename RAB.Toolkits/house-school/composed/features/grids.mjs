import { enabled, seat } from '../core.mjs';
export const grids = (ctx, content) => {
  if (!enabled(ctx, 'data-grid')) return { attribute: '', children: `<div>${content}</div>` };
  const layouts = { 2: ['header-main', ['header', 'main']], 3: ['shell', ['header', 'main', 'footer']],
    5: ['holy-grail', ['header', 'left', 'main', 'right', 'footer']] };
  const [grid, areas] = layouts[ctx.knobs.areas];
  const name = seat(ctx, 'data-grid', 'layout', grid, 'unknown-layout');
  const children = areas.map((area) => {
    const value = seat(ctx, 'grid-area', area, area, `wrong-${area}`);
    return `<div data-area="${value}">${area === 'main' ? content : `${area} level ${ctx.level}`}</div>`;
  }).join('\n      ');
  return { attribute: ` data-grid="${name}"`, children };
};
