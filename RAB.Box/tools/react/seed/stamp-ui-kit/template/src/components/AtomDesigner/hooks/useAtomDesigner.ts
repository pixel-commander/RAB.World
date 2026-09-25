import { makeDragScrollable, handleRemove } from '../../../js/makeDragScrollable/makeDragScrollable.js';
import { useEffect, useRef, useState, type FormEvent, type PointerEvent } from 'react';
import type { HandlerKey } from '../../../HouseKeys.types.ts';
import type { CodeEditorHandle } from '../../code-editor/CodeEditor.tsx';
import type { AtomCard } from '../FormAtomDesigner/FormAtomDesigner.tsx';
import type { Atom, Rect, AtomDesignerProps } from '../AtomDesigner.types.ts';
import { hasInner, layerBody, parseRules, serializeRules } from '../FormAtomDesigner/skin-text.ts';
import containersCssText from '../../../css/containers.css?raw';
import actionsCssText from '../../../css/actions.css?raw';
const atomCssModules = import.meta.glob('../../../atoms/**/*.css', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;
const parseFamily = (cssText: string, family: AtomCard['family']): Atom[] => {
  const atoms = new Map<string, { name: string; rules: ReturnType<typeof parseRules> }>();
  for (const rule of parseRules(layerBody(cssText, 'atoms'))) {
    if (rule.opaque !== undefined) continue;
    const name = (rule.selector.match(/\.([a-z0-9-]+)/) || [])[1];
    if (!name) continue;
    const atom = atoms.get(name) ?? { name, rules: [] };
    atom.rules.push(rule);
    atoms.set(name, atom);
  }
  return [...atoms.values()].map((atom) => ({ name: atom.name, family, text: serializeRules(atom.rules) }));
};
const point = (stage: HTMLElement, event: { clientX: number; clientY: number }) => { const box = stage.getBoundingClientRect(); return { x: Math.max(0, Math.min(box.width, event.clientX - box.left)), y: Math.max(0, Math.min(box.height, event.clientY - box.top)) }; };
const between = (a: { x: number; y: number }, b: { x: number; y: number }): Rect => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });
export const useAtomDesigner = (props: AtomDesignerProps = {}) => {
  const rootRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const elements = ['atoms-scroll', 'styles-scroll'].map(id => rootRef.current?.querySelector<HTMLElement>(`[data-id="${id}"]`));
    const handleDragStart: HandlerKey<globalThis.PointerEvent, 'scroll', boolean> = (data) =>
      data?.target instanceof Element && !data.target.closest('input, textarea, select, label, [contenteditable], [draggable="true"], [data-scroll-drag="off"]');
    elements.forEach(element => makeDragScrollable(element, { size: 4, handleDragStart }));
    return () => elements.forEach(element => handleRemove(element));
  }, []);
  const [atoms, setAtoms] = useState<Atom[]>([]);
  const [kind, setKind] = useState<AtomCard['family']>('container');
  const [selectedName, setSelectedName] = useState('');
  const [drafts, setDrafts] = useState<Map<string, string>>(new Map());
  const [rect, setRect] = useState<Rect | null>(null);
  const [draftRect, setDraftRect] = useState<Rect | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<CodeEditorHandle>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);
  const saveStatusRef = useRef<HTMLParagraphElement>(null);
  const savePreviewRef = useRef<HTMLParagraphElement>(null);
  const gesture = useRef<{ pointerId: number; mode: 'draw'; start: { x: number; y: number } } | { pointerId: number; mode: 'move'; grab: { x: number; y: number } } | null>(null);

  useEffect(() => {
    const base = [...parseFamily(containersCssText, 'container'), ...parseFamily(actionsCssText, 'action')];
    Object.entries(atomCssModules).forEach(([path, text]) => {
      const family = path.includes('/containers/') ? 'container' : path.includes('/actions/') ? 'action' : null;
      if (!family) return;
      parseFamily(text, family).forEach((atom) => {
        const index = base.findIndex((item) => item.name === atom.name);
        if (index >= 0) base[index] = atom;
        else base.push(atom);
      });
    });
    setAtoms(base);
    setSelectedName(base.find((atom) => atom.family === 'container')?.name ?? base[0]?.name ?? '');
  }, []);

  const selected = atoms.find((atom) => atom.name === selectedName) ?? null;
  const draft = selected ? drafts.get(selected.name) ?? selected.text : '';
  const nested = selected?.family === 'container' && hasInner(draft, selected.name);
  const boxStyle = rect ? { insetInlineStart: rect.x, insetBlockStart: rect.y, inlineSize: rect.w, blockSize: rect.h } : undefined;

  const handleInputChange: HandlerKey<string> = (text, type) => {
    if (!selected || typeof text !== 'string') return;
    const markEditor = type === 'form';
    setDrafts((current) => new Map(current).set(selected.name, text));
    if (markEditor) editorRef.current?.setValue(text, { dirty: true });
  };
  const handleSelect: HandlerKey<Atom> = props.handleSelect ?? ((atom) => { if (!atom || !atoms.some((item) => item.name === atom.name)) return; setSelectedName(atom.name); editorRef.current?.setValue(drafts.get(atom.name) ?? atom.text, { dirty: drafts.has(atom.name) }); });
  const handleFilter: HandlerKey<AtomCard['family']> = props.handleFilter ?? ((next) => { if (next !== 'container' && next !== 'action') return; if (next === kind) return; setKind(next); const first = atoms.find((atom) => atom.family === next); if (first) handleSelect(first); });

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || gesture.current) return;
    const stage = stageRef.current!;
    const cursor = point(stage, event);
    stage.setPointerCapture(event.pointerId);
    if (rect && (event.target as HTMLElement).closest('.atom-designer__box')) gesture.current = { pointerId: event.pointerId, mode: 'move', grab: { x: cursor.x - rect.x, y: cursor.y - rect.y } };
    else { gesture.current = { pointerId: event.pointerId, mode: 'draw', start: cursor }; setDraftRect(between(cursor, cursor)); }
  };
  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const active = gesture.current; const stage = stageRef.current;
    if (!active || !stage || active.pointerId !== event.pointerId) return;
    const cursor = point(stage, event);
    if (active.mode === 'draw') setDraftRect(between(active.start, cursor));
    else if (rect) setRect({ ...rect, x: Math.max(0, Math.min(cursor.x - active.grab.x, stage.clientWidth - rect.w)), y: Math.max(0, Math.min(cursor.y - active.grab.y, stage.clientHeight - rect.h)) });
  };
  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    if (active.mode === 'draw' && draftRect && draftRect.w >= 8 && draftRect.h >= 8) setRect(draftRect);
    gesture.current = null; setDraftRect(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleClick = () => { if (!selected) return; if (saveStatusRef.current) saveStatusRef.current.textContent = ''; dialogRef.current?.showModal(); };
  const handlePreviewChange: HandlerKey<HTMLFormElement> = (form) => { if (!(form instanceof HTMLFormElement) || !selected || !savePreviewRef.current) return; const data = new FormData(form); const name = String(data.get('name') ?? '').trim(); savePreviewRef.current.textContent = name ? `lands as ${name} on atoms/${selected.family}s` : ''; };
  const handleSubmit: HandlerKey<FormEvent<HTMLFormElement>, string, Promise<void>> = async (event) => {
    if (!event?.currentTarget) return;
    event.preventDefault(); if (!selected) return;
    const form = new FormData(event.currentTarget); const name = String(form.get('name') ?? '').trim();
    if (!new RegExp(`^${selected.family}-[a-z0-9][a-z0-9-]*$`).test(name)) { if (saveStatusRef.current) saveStatusRef.current.textContent = `name must be ${selected.family}-<variant>`; return; }
    const renamed = draft.trim().replace(new RegExp(`(?<![a-z0-9])${selected.name}(?![a-z0-9])`, 'g'), name); const body = renamed.split('\n').map((line) => line ? `  ${line}` : line).join('\n');
    try {
      const response = await fetch(`/api/atoms/${selected.family}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, description: String(form.get('description') ?? '').trim(), css: `@layer atoms {\n${body}\n}\n` }) });
      const result = await response.json().catch(() => ({})) as { error?: string; file?: string; name?: string; replaced?: boolean };
      if (!response.ok) throw new Error(result.error ?? 'save failed');
      dialogRef.current?.close(); if (statusRef.current) statusRef.current.textContent = `saved ${result.file}${result.replaced ? ' (updated)' : ''}`; props.handleSaveResult?.({ name: result.name ?? name, file: result.file ?? '' }, 'saved');
    } catch (error) { if (saveStatusRef.current) saveStatusRef.current.textContent = (error as Error).message; }
  };

  const handleChange: HandlerKey<string> = props.handleChange ?? handleInputChange;
  const handleSave: HandlerKey<string, string, void | Promise<void>> = (text) => {
    if (selected && typeof text === 'string') return props.handleSave?.({ name: selected.name, text }, 'atom');
  };
  const handleCancel: HandlerKey = () => dialogRef.current?.close();
  const list = { atoms, kind, selectedName, handleSelect, handleFilter };
  const form = { atom: selected, css: draft, handleChange };
  const code = { selected, draft, editorRef, dialogRef, statusRef, saveStatusRef, savePreviewRef,
    handleClick, handleInputChange: handlePreviewChange, handleSubmit, handleCancel, handleChange, handleSave };
  return { rootRef, list, form, code, selected, draft, rect, draftRect, nested, boxStyle, stageRef,
    handlePointerDown, handlePointerMove, handlePointerUp };
};
