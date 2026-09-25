import { useEffect, useState, type CSSProperties } from 'react';
import { layerBody, parseRules } from '../AtomDesigner/FormAtomDesigner/skin-text.ts';
import gridCssText from '../../themes/layout/grid.css?raw';
import './grid-selector.css';

const atomCssModules = import.meta.glob('../../atoms/**/*.css', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

export interface GridSpec { name: string; areas: string[][] | null; cols: string[]; rows: string[]; }
export interface GridSelectorProps { specs?: GridSpec[]; selected?: string; onSelect?: (grid: { name: string }) => void; }

export const trackTokens = (value: string): string[] => {
  const tokens: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of value) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (/\s/.test(ch) && depth === 0) { if (current) tokens.push(current); current = ''; } else current += ch;
  }
  if (current) tokens.push(current);
  return tokens.flatMap((token) => { const repeat = token.match(/^repeat\((\d+),(.+)\)$/); return repeat ? Array(Number(repeat[1])).fill(repeat[2].trim()) : [token]; });
};
const miniTrack = (token: string) => token.includes('fr') ? '2fr' : '1fr';
export const gridSpecs = (cssText: string): GridSpec[] => {
  const specs: GridSpec[] = [];
  for (const rule of parseRules(layerBody(cssText, 'grid'))) {
    const name = (rule.selector.match(/^\[data-grid='([a-z0-9-]+)'\]$/) || [])[1];
    if (!name || !rule.declarations || specs.some((spec) => spec.name === name)) continue;
    const value = (property: string) => rule.declarations?.find((item) => item.property === property)?.value ?? null;
    const areaValue = value('grid-template-areas');
    const areas = areaValue ? [...areaValue.matchAll(/'([^']*)'/g)].map((match) => match[1].trim().split(/\s+/)) : null;
    const cols = value('grid-template-columns');
    const rows = value('grid-template-rows');
    specs.push({ name, areas, cols: cols ? trackTokens(cols) : areas ? areas[0].map(() => '1fr') : ['1fr'], rows: rows ? trackTokens(rows) : areas ? areas.map(() => '1fr') : ['1fr'] });
  }
  return specs;
};
const loadSpecs = async (): Promise<GridSpec[]> => {
  const specs = gridSpecs(gridCssText);
  Object.values(atomCssModules).forEach((text) => specs.push(...gridSpecs(text)));
  return specs;
};
export const GridSelector = ({ specs: supplied, selected, onSelect }: GridSelectorProps) => {
  const [loaded, setLoaded] = useState<GridSpec[]>(supplied ?? []);
  const [selection, setSelection] = useState(selected ?? '');
  useEffect(() => { if (supplied) setLoaded(supplied); else void loadSpecs().then(setLoaded); }, [supplied]);
  useEffect(() => { if (selected !== undefined) setSelection(selected); }, [selected]);
  return <nav className="grid-selector">{loaded.map((spec) => {
    const style = { gridTemplateColumns: spec.cols.map(miniTrack).join(' '), gridTemplateRows: spec.rows.map(miniTrack).join(' '), ...(spec.areas ? { gridTemplateAreas: spec.areas.map((row) => `'${row.join(' ')}'`).join(' ') } : {}) } as CSSProperties;
    const areas = spec.areas ? [...new Set(spec.areas.flat())].filter((area) => area !== '.') : [];
    const count = spec.areas ? areas.length : spec.cols.length * spec.rows.length;
    return <button key={spec.name} type="button" className="action-ghost grid-selector__tile" data-grid="main-footer" aria-selected={selection === spec.name} title={spec.name} onClick={() => { setSelection(spec.name); onSelect?.({ name: spec.name }); }}><span className="grid-selector__mini" data-area="main" style={style}>{Array.from({ length: count }, (_, index) => <span key={spec.areas ? areas[index] : index} className="grid-selector__cell" data-area={spec.areas ? areas[index] : undefined} style={spec.areas ? { gridArea: areas[index] } : undefined} />)}</span><span className="grid-selector__name" data-area="footer">{spec.name}</span></button>;
  })}</nav>;
};
