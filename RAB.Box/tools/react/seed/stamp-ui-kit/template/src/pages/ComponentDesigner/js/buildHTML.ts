import type { HandlerKey } from '../../../HouseKeys.types.ts';

// This is source text for export, never markup injected into the preview DOM.
// Keep the component path on each placement for import resolution when saving.
const attribute = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const componentName = (value: string) => value.split(/[^a-zA-Z0-9_$]+/).filter(Boolean).map(part => part[0].toUpperCase() + part.slice(1)).join('');
export const handleChange: HandlerKey<HTMLElement, string, string> = source => {
  if (!source || source.hidden) return '<!-- Draw a grid to start building. -->';
  const grid = source.querySelector<HTMLElement>('[data-id="built-grid"]');
  if (!grid) return '';
  const lines = [`<div data-grid="${attribute(grid.dataset.grid ?? '')}">`];
  for (const area of Array.from(grid.children)) {
    if (!(area instanceof HTMLElement) || area.dataset.id !== 'grid-drop-area') continue;
    lines.push(`  <div data-area="${attribute(area.dataset.area ?? '')}">`);
    const name = componentName(area.dataset.componentName ?? '');
    if (name && /^[A-Z_$][\w$]*$/.test(name)) lines.push(`    <${name} />`);
    lines.push('  </div>');
  }
  lines.push('</div>');
  return lines.join('\n');
};
