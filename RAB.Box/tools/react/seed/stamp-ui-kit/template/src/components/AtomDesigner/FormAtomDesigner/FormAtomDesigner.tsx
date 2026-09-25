import type { HandlerKey } from '../../../HouseKeys.types.ts';
import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ROWS, declarationFor, effectCss, findRule, hasInner, innerRule,
  innerSelectorOf, isSplit, linkRow, optionsFor, parseRules, parseTokens,
  removeDeclaration, serializeRules, shadowValue, sideDeclarationFor, splitRow,
  tokenOf, upsertDeclaration, type RowSpec, type Rule, type SideSpec,
} from './skin-text.ts';
import layoutCssText from '../../../themes/layout/layout.css?raw';
import darkCssText from '../../../themes/dark/colors.css?raw';
import './css/form-atom-designer.css';

const atomCssModules = import.meta.glob('../../../atoms/**/*.css', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

export interface AtomCard { name: string; family: 'container' | 'action'; }
export interface FormAtomDesignerProps { atom: AtomCard | null; css: string; tokens?: Map<string, string>; handleChange?: HandlerKey<string>; }
type View = 'default' | 'hover' | 'inner';

export const loadTokens = async () => {
  return parseTokens([layoutCssText, darkCssText, ...Object.values(atomCssModules)].join('\n'));
};

interface PickProps { value: string; options: string[]; mirror?: boolean; onPick: (value: string) => void; }
const TokenPick = ({ value, options, mirror = false, onPick }: PickProps) => {
  const [open, setOpen] = useState(false);
  const swatch = (token: string) => ({ '--form-atom-designer-swatch': !token || token === 'none' ? 'transparent' : token === 'black' ? 'black' : `var(--${token})` }) as React.CSSProperties;
  return <><button type="button" className="action-muted form-atom-designer__pick-button" aria-expanded={open} title={mirror ? 'mirrors default â€” pick to override' : undefined} onClick={() => setOpen((was) => !was)}><span className={`form-atom-designer__swatch${!value || value === 'none' ? ' form-atom-designer__swatch--none' : ''}`} style={swatch(value)} /><span className={`form-atom-designer__pick-name${mirror ? ' form-atom-designer__pick-name--mirror' : ''}`}>{value || 'â€”'}</span></button><menu className="container-float form-atom-designer__menu" hidden={!open}>{options.map((option) => <li key={option} className="form-atom-designer__option-item"><button type="button" className="action-nav form-atom-designer__option" aria-current={option === value ? 'page' : undefined} onClick={() => { setOpen(false); onPick(option); }}><span className={`form-atom-designer__swatch${!option || option === 'none' ? ' form-atom-designer__swatch--none' : ''}`} style={swatch(option)} /><span className="form-atom-designer__pick-name">{option || '= default'}</span></button></li>)}</menu></>;
};

const FormControls = ({ atom, css, tokens, handleChange }: FormAtomDesignerProps & { atom: AtomCard }) => {
  const [catalog, setCatalog] = useState(tokens ?? new Map<string, string>());
  const [draft, setDraft] = useState(css);
  const [view, setView] = useState<View>('default');
  const [effectRow, setEffectRow] = useState<RowSpec | null>(null);
  const effectFormRef = useRef<HTMLFormElement>(null);
  const effectStatusRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => { setView('default'); setEffectRow(null); }, [atom.name, atom.family]);
  useEffect(() => { setDraft(css); }, [css]);
  useEffect(() => { if (tokens) setCatalog(tokens); else void loadTokens().then(setCatalog); }, [tokens]);

  const nested = hasInner(draft, atom.name);
  const baseSelector = `.${atom.name}`;
  const hoverSelector = `${baseSelector}:hover`;
  const selector = view === 'hover' ? hoverSelector : view === 'inner' ? innerSelectorOf(atom.name) : baseSelector;
  const rules = useMemo(() => parseRules(draft), [draft]);
  const declarationValue = (target: string, property: string) => findRule(rules, target)?.declarations?.find((item) => item.property === property)?.value ?? null;
  const rowState = (row: RowSpec, side?: SideSpec) => {
    const property = side?.property ?? row.property;
    if (view !== 'hover') { const value = declarationValue(selector, property); return { token: tokenOf(value, row, catalog), value, mirror: false }; }
    const ownProperty = side?.hoverProperty ?? row.hoverProperty ?? property;
    const own = declarationValue(hoverSelector, ownProperty);
    if (own !== null) return { token: tokenOf(own, row, catalog), value: own, mirror: false };
    const base = declarationValue(baseSelector, property) ?? declarationValue(baseSelector, row.property) ?? (row.sides ? declarationValue(baseSelector, row.sides[0].property) : null);
    return { token: tokenOf(base, row, catalog), value: base, mirror: true };
  };
  const mutate = (change: (next: Rule[]) => void) => { const next = parseRules(draft); change(next); const text = serializeRules(next); setDraft(text); handleChange?.(text, 'form'); };
  const setToken = (row: RowSpec, token: string, side?: SideSpec) => mutate((next) => {
    if (!token) removeDeclaration(next, hoverSelector, side?.hoverProperty ?? row.hoverProperty ?? side?.property ?? row.property);
    else if (side) upsertDeclaration(next, selector, baseSelector, sideDeclarationFor(row, side, token, atom.name, view));
    else upsertDeclaration(next, selector, baseSelector, declarationFor(row, token, view, atom.name));
  });
  const linked = (row: RowSpec) => {
    if (!row.sides) return true;
    if (view !== 'hover') return !isSplit(rules, selector, row, view);
    if (isSplit(rules, hoverSelector, row, 'hover')) return false;
    if (declarationValue(hoverSelector, row.hoverProperty ?? row.property) !== null) return true;
    return !isSplit(rules, baseSelector, row, 'default');
  };
  const linkToken = (row: RowSpec) => rowState(row).token ?? (row.sides ? tokenOf(declarationValue(selector, row.sides[0].property), row, catalog) : null) ?? (row.prop === 'radius' ? atom.family === 'action' ? 'radius-control' : 'radius-container' : row.prop === 'padding' ? 'space-md' : 'border-default');
  const setLinked = (row: RowSpec, nextLinked: boolean) => mutate((next) => { const seed = linkToken(row); if (nextLinked) linkRow(next, selector, row, seed, atom.name, view, view === 'default' ? null : baseSelector); else splitRow(next, selector, row, seed, atom.name, view, view === 'default' ? null : baseSelector); });
  const setActiveView = (next: View) => {
    if (next === 'inner' && !nested) mutate((current) => { current.push(innerRule(atom.name)); upsertDeclaration(current, baseSelector, null, declarationFor(ROWS.find((row) => row.prop === 'padding')!, 'space-md', 'default', atom.name)); });
    setView(next); setEffectRow(null);
  };

  const saveEffect = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const status = effectStatusRef.current!;
    if (!/^effect-[a-z0-9][a-z0-9-]*$/.test(name)) { status.textContent = 'name must be effect-<variant>'; return; }
    const raw = shadowValue({ x: Number(form.get('x')), y: Number(form.get('y')), blur: Number(form.get('blur')), spread: Number(form.get('spread')), alpha: Number(form.get('alpha')), color: String(form.get('color') ?? 'black'), inset: form.get('inset') === 'on' });
    try {
      const response = await fetch('/api/atoms/effect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, description: String(form.get('description') ?? '').trim(), css: effectCss(name, raw) }) });
      const result = await response.json().catch(() => ({})) as { error?: string; file?: string; replaced?: boolean };
      if (!response.ok) throw new Error(result.error ?? 'save failed');
      setCatalog((current) => new Map(current).set(name, raw));
      status.textContent = `saved ${result.file ?? name}${result.replaced ? ' (updated)' : ''}`;
      if (effectRow) setToken(effectRow, name);
    } catch (error) { status.textContent = (error as Error).message; }
  };

  const visibleRows = ROWS.filter((row) => (atom.family === 'action' || !row.action) && (!row.nested || (atom.family === 'container' && view === 'default' && nested)));
  const control = (row: RowSpec, side?: SideSpec) => {
    const state = rowState(row, side);
    const options = [...(view === 'hover' ? [''] : []), ...optionsFor(catalog, row)];
    if (row.kind === 'color') return <TokenPick value={state.token ?? (state.value?.replace(/\s+/g, ' ') ?? '')} options={options} mirror={state.mirror} onPick={(token) => setToken(row, token, side)} />;
    return <select className="form-atom-designer__select" value={state.mirror ? '' : state.token ?? '(custom)'} onChange={(event) => { if (event.target.value === '(new)') setEffectRow(row); else if (event.target.value !== '(custom)') setToken(row, event.target.value, side); }}>{view === 'hover' && <option value="">= default</option>}{!state.token && state.value && <option value="(custom)">(custom)</option>}{optionsFor(catalog, row).map((option) => <option key={option}>{option}</option>)}{row.designer && !side && <option value="(new)">add newâ€¦</option>}</select>;
  };

  return <div className="form-atom-designer">
    <nav className="form-atom-designer__states">{atom.family === 'action' ? <><button type="button" className="action-nav form-atom-designer__state" aria-current={view === 'default' ? 'page' : undefined} onClick={() => setActiveView('default')}>Default</button><button type="button" className="action-nav form-atom-designer__state" aria-current={view === 'hover' ? 'page' : undefined} onClick={() => setActiveView('hover')}>Hover</button></> : <><button type="button" className="action-nav form-atom-designer__state" aria-current={view === 'default' ? 'page' : undefined} onClick={() => setActiveView('default')}>Outer</button><button type="button" className="action-nav form-atom-designer__state" aria-current={view === 'inner' ? 'page' : undefined} onClick={() => setActiveView('inner')}>{nested ? 'Inner' : '+ inner'}</button></>}</nav>
    <div className="form-atom-designer__rows">{visibleRows.flatMap((row) => {
      const isLinked = linked(row);
      const main = <Fragment key={row.prop}><span className="form-atom-designer__prop">{row.prop}</span><span className="form-atom-designer__control">{isLinked ? control(row) : null}{row.sides && <label className="form-atom-designer__link" title="One value for all sides"><input type="checkbox" className="form-atom-designer__link-box" checked={isLinked} onChange={(event) => setLinked(row, event.currentTarget.checked)} /><span className="form-atom-designer__link-mark">link</span></label>}</span></Fragment>;
      return isLinked || !row.sides ? [main] : [main, ...row.sides.map((side) => <Fragment key={`${row.prop}-${side.label}`}><span className="form-atom-designer__prop form-atom-designer__prop--side">{side.label}</span><span className="form-atom-designer__control">{control(row, side)}</span></Fragment>)];
    })}</div>
    <div className="form-atom-designer__effect-host">{effectRow && <div className="form-atom-designer__effect container-inset"><form ref={effectFormRef} className="form-atom-designer__effect-save form-atom-designer__effect-form" onSubmit={saveEffect}><div className="form-atom-designer__effect-fields">{[['x','0'],['y','4'],['blur','12'],['spread','0'],['alpha','35']].map(([name, initial]) => <label key={name} className="form-atom-designer__effect-field">{name === 'alpha' ? 'alpha %' : name}<input className="form-atom-designer__effect-input" type="number" name={name} defaultValue={initial} min={name === 'blur' || name === 'alpha' ? 0 : undefined} max={name === 'alpha' ? 100 : undefined} /></label>)}<label className="form-atom-designer__effect-field form-atom-designer__effect-field--check">inset<input type="checkbox" name="inset" /></label></div><div className="form-atom-designer__effect-color"><span className="form-atom-designer__prop">color</span><select className="form-atom-designer__select" name="color" defaultValue="black"><option>black</option>{optionsFor(catalog, ROWS[0]).map((option) => <option key={option}>{option}</option>)}</select></div><input className="form-atom-designer__effect-name" name="name" placeholder="effect-name" required /><input className="form-atom-designer__effect-name" name="description" placeholder="optional â€” what this effect is for" /><button type="submit" className="action-main">Save effect</button><button type="button" className="action-muted" onClick={() => setEffectRow(null)}>close</button></form><p ref={effectStatusRef} className="form-atom-designer__effect-status" /></div>}</div>
  </div>;
};

export const FormAtomDesigner = (props: FormAtomDesignerProps) => {
  if (!props?.atom || typeof props.atom.name !== 'string' || !['container', 'action'].includes(props.atom.family) || typeof props.css !== 'string') return null;
  return <FormControls {...props} atom={props.atom} />;
};
