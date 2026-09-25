export interface Declaration { property: string; value: string; }
export interface Rule { selector: string; declarations?: Declaration[]; opaque?: string; }
export interface SideSpec { label: string; property: string; part: string; hoverProperty?: string; hoverPart?: string; }
export interface RowSpec {
  prop: string;
  kind: 'color' | 'token' | 'literal';
  property: string;
  pick?: string[];
  extra?: string[];
  options?: string[];
  none?: boolean;
  hoverProperty?: string;
  hoverPart?: string;
  sides?: SideSpec[];
  designer?: boolean;
  nested?: boolean;
  action?: boolean;
}

export const parseTokens = (cssText: string): Map<string, string> => {
  const tokens = new Map<string, string>();
  for (const [, name, value] of cssText.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) if (!tokens.has(name)) tokens.set(name, value.trim());
  return tokens;
};

const isColorValue = (value: string) => /^(#|rgb|transparent$)/.test(value);

export const ROWS: RowSpec[] = [
  { prop: 'color', kind: 'color', property: 'color', pick: ['content-'], extra: ['accent-default', 'danger-default'] },
  { prop: 'background', kind: 'color', property: 'background', pick: ['surface-'], extra: ['accent-soft', 'danger-soft', 'accent-default', 'danger-default'] },
  { prop: 'border', kind: 'color', property: 'border', hoverProperty: 'border-color', hoverPart: 'hover-border-color', pick: ['border-'], extra: ['accent-default'], none: true, sides: [
    { label: 'top', property: 'border-block-start', part: 'border-top', hoverProperty: 'border-block-start-color', hoverPart: 'hover-border-top-color' },
    { label: 'right', property: 'border-inline-end', part: 'border-right', hoverProperty: 'border-inline-end-color', hoverPart: 'hover-border-right-color' },
    { label: 'bottom', property: 'border-block-end', part: 'border-bottom', hoverProperty: 'border-block-end-color', hoverPart: 'hover-border-bottom-color' },
    { label: 'left', property: 'border-inline-start', part: 'border-left', hoverProperty: 'border-inline-start-color', hoverPart: 'hover-border-left-color' },
  ] },
  { prop: 'radius', kind: 'token', property: 'border-radius', pick: ['radius-'], none: true, sides: [
    { label: 'top-left', property: 'border-start-start-radius', part: 'radius-top-left' },
    { label: 'top-right', property: 'border-start-end-radius', part: 'radius-top-right' },
    { label: 'bottom-right', property: 'border-end-end-radius', part: 'radius-bottom-right' },
    { label: 'bottom-left', property: 'border-end-start-radius', part: 'radius-bottom-left' },
  ] },
  { prop: 'shadow', kind: 'token', property: 'box-shadow', pick: ['elevation-', 'effect-'], none: true, designer: true },
  { prop: 'padding', kind: 'token', property: 'padding', pick: ['space-'], none: true, nested: true },
  { prop: 'font', kind: 'token', property: 'font', pick: ['type-'], action: true },
  { prop: 'cursor', kind: 'literal', property: 'cursor', options: ['pointer', 'default', 'not-allowed'], action: true },
];

export const optionsFor = (tokens: Map<string, string>, row: RowSpec): string[] => {
  if (row.kind === 'literal') return [...(row.options ?? [])];
  const names = [...tokens.keys()].filter((name) => (row.pick ?? []).some((prefix) => name.startsWith(prefix)) && (row.kind !== 'color' || isColorValue(tokens.get(name) ?? '')));
  const extras = (row.extra ?? []).filter((name) => tokens.has(name) && !names.includes(name));
  return [...(row.none ? ['none'] : []), ...names, ...extras];
};

export const layerBody = (cssText: string, layerName: string): string => {
  const at = cssText.indexOf(`@layer ${layerName}`);
  if (at < 0) return '';
  const open = cssText.indexOf('{', at);
  let depth = 1;
  let end = open + 1;
  while (end < cssText.length && depth > 0) { if (cssText[end] === '{') depth += 1; if (cssText[end] === '}') depth -= 1; end += 1; }
  return cssText.slice(open + 1, end - 1);
};

export const parseRules = (cssText: string): Rule[] => {
  const rules: Rule[] = [];
  let at = 0;
  while (at < cssText.length) {
    const brace = cssText.indexOf('{', at);
    if (brace < 0) break;
    let depth = 1;
    let end = brace + 1;
    while (end < cssText.length && depth > 0) { if (cssText[end] === '{') depth += 1; if (cssText[end] === '}') depth -= 1; end += 1; }
    const selector = cssText.slice(at, brace).trim();
    const body = cssText.slice(brace + 1, end - 1);
    if (selector.startsWith('@') || body.includes('{')) rules.push({ selector, opaque: body });
    else rules.push({ selector, declarations: body.replace(/\/\*[\s\S]*?\*\//g, '').split(';').map((line) => line.trim()).filter(Boolean).map((line) => { const colon = line.indexOf(':'); return { property: line.slice(0, colon).trim(), value: line.slice(colon + 1).trim() }; }) });
    at = end;
  }
  return rules;
};

export const serializeRules = (rules: Rule[]): string => rules.map((rule) => rule.opaque !== undefined ? `${rule.selector} {${rule.opaque}}` : `${rule.selector} {\n${(rule.declarations ?? []).map((item) => `  ${item.property}: ${item.value};`).join('\n')}\n}`).join('\n\n') + '\n';
export const findRule = (rules: Rule[], selector: string) => rules.find((rule) => rule.selector === selector);
export const upsertDeclaration = (rules: Rule[], selector: string, afterSelector: string | null, declaration: Declaration) => {
  let rule = findRule(rules, selector);
  if (rule?.opaque !== undefined) return;
  if (!rule) { rule = { selector, declarations: [] }; const anchor = rules.indexOf(findRule(rules, afterSelector ?? '') as Rule); rules.splice(anchor < 0 ? rules.length : anchor + 1, 0, rule); }
  const existing = rule.declarations?.find((item) => item.property === declaration.property);
  if (existing) existing.value = declaration.value; else rule.declarations?.push(declaration);
};
export const removeDeclaration = (rules: Rule[], selector: string, property: string) => {
  const rule = findRule(rules, selector);
  if (!rule?.declarations || rule.opaque !== undefined) return;
  rule.declarations = rule.declarations.filter((item) => item.property !== property);
  if (!rule.declarations.length) rules.splice(rules.indexOf(rule), 1);
};
export const tokenOf = (value: string | null, row: RowSpec, tokens: Map<string, string>): string | null => {
  if (!value) return null;
  const options = optionsFor(tokens, row);
  const refs = [...value.matchAll(/var\(\s*--([a-z0-9-]+)/g)].map((match) => match[1]);
  for (let index = refs.length - 1; index >= 0; index -= 1) if (options.includes(refs[index])) return refs[index];
  if (row.kind === 'literal') return row.options?.find((option) => value.includes(option)) ?? null;
  if (row.none && /(^|[\s,(])(none|0|transparent)\s*\)*\s*$/.test(value)) return 'none';
  return null;
};
const fallbackFor = (row: RowSpec, token: string) => row.kind === 'literal' ? token : row.prop === 'border' ? (token === 'none' ? 'none' : `var(--border-width) var(--border-style) var(--${token})`) : (row.prop === 'radius' || row.prop === 'padding') && token === 'none' ? '0' : token === 'none' ? 'none' : `var(--${token})`;
export const declarationFor = (row: RowSpec, token: string, view: string, name: string): Declaration => {
  if (view === 'default' || view === 'inner') { const part = view === 'inner' ? `inner-${row.prop}` : row.prop; return { property: row.property, value: `var(--${name}-${part}, ${fallbackFor(row, token)})` }; }
  const fallback = row.kind === 'literal' ? token : row.prop === 'border' ? (token === 'none' ? 'transparent' : `var(--${token})`) : row.prop === 'radius' && token === 'none' ? '0' : token === 'none' ? 'none' : `var(--${token})`;
  return { property: row.hoverProperty ?? row.property, value: `var(--${name}-${row.hoverPart ?? `hover-${row.prop}`}, ${fallback})` };
};
export const sideDeclarationFor = (row: RowSpec, side: SideSpec, token: string, name: string, view = 'default'): Declaration => {
  if (view === 'default' || view === 'inner') { const part = view === 'inner' ? `inner-${side.part}` : side.part; return { property: side.property, value: `var(--${name}-${part}, ${fallbackFor(row, token)})` }; }
  const fallback = row.prop === 'border' ? (token === 'none' ? 'transparent' : `var(--${token})`) : row.prop === 'radius' && token === 'none' ? '0' : token === 'none' ? 'none' : `var(--${token})`;
  return { property: side.hoverProperty ?? side.property, value: `var(--${name}-${side.hoverPart ?? `hover-${side.part}`}, ${fallback})` };
};
export const innerSelectorOf = (name: string) => `.${name}-inner`;
export const hasInner = (cssText: string, name: string) => parseRules(cssText).some((rule) => rule.selector === innerSelectorOf(name));
export const innerRule = (name: string): Rule => ({ selector: innerSelectorOf(name), declarations: [
  { property: 'color', value: `var(--${name}-inner-color, var(--content-default))` },
  { property: 'background', value: `var(--${name}-inner-background, var(--surface-inset))` },
  { property: 'border', value: `var(--${name}-inner-border, none)` },
  { property: 'border-radius', value: `var(--${name}-inner-radius, var(--radius-container))` },
  { property: 'box-shadow', value: `var(--${name}-inner-shadow, none)` },
] });
const sideProperty = (side: SideSpec, view: string) => view === 'hover' ? side.hoverProperty ?? side.property : side.property;
export const isSplit = (rules: Rule[], selector: string, row: RowSpec, view = 'default') => Boolean(findRule(rules, selector)?.declarations?.some((item) => row.sides?.some((side) => item.property === sideProperty(side, view))));
export const splitRow = (rules: Rule[], selector: string, row: RowSpec, token: string, name: string, view = 'default', afterSelector: string | null = null) => { removeDeclaration(rules, selector, view === 'hover' ? row.hoverProperty ?? row.property : row.property); row.sides?.forEach((side) => upsertDeclaration(rules, selector, afterSelector, sideDeclarationFor(row, side, token, name, view))); };
export const linkRow = (rules: Rule[], selector: string, row: RowSpec, token: string, name: string, view = 'default', afterSelector: string | null = null) => { row.sides?.forEach((side) => removeDeclaration(rules, selector, sideProperty(side, view))); upsertDeclaration(rules, selector, afterSelector, declarationFor(row, token, view, name)); };
export const shadowValue = ({ x = 0, y = 0, blur = 0, spread = 0, alpha = 100, color = 'black', inset = false }: { x?: number; y?: number; blur?: number; spread?: number; alpha?: number; color?: string; inset?: boolean }) => {
  const clampedBlur = Math.max(0, Number.isFinite(blur) ? blur : 0);
  const clampedAlpha = Math.min(100, Math.max(0, Number.isFinite(alpha) ? alpha : 0));
  const paint = color === 'black' ? 'black' : `var(--${color})`;
  const mixed = clampedAlpha >= 100 ? paint : `color-mix(in srgb, ${paint} ${clampedAlpha}%, transparent)`;
  return `${inset ? 'inset ' : ''}${x}px ${y}px ${clampedBlur}px ${spread}px ${mixed}`;
};
export const effectCss = (name: string, value: string) => `@layer themes {\n  :root {\n    --${name}: ${value};\n  }\n}\n`;
