import { useEffect, useImperativeHandle, useRef, type KeyboardEvent, type ForwardedRef } from 'react';
import type { CodeEditorHandle, CodeEditorProps } from '../CodeEditor.types';
import { appendTokens, tokenize, diffLines } from '../js/code-editor';

export const useCodeEditor = ({ value = '', language = 'css', viewOnly = false, diff = null, onChange, onSave }: CodeEditorProps, forwardedRef: ForwardedRef<CodeEditorHandle>) => {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const viewRef = useRef<HTMLElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const metaRef = useRef<HTMLSpanElement>(null);
  const dirtyRef = useRef<HTMLSpanElement>(null);
  const dirty = useRef(false);
  const anchor = useRef<number | null>(null);

  const setDirty = (next: boolean) => { dirty.current = next; if (dirtyRef.current) dirtyRef.current.hidden = !next; };
  const render = () => {
    const input = inputRef.current; const view = viewRef.current; const gutter = gutterRef.current; const meta = metaRef.current;
    if (!input || !view || !gutter || !meta) return;
    const rows = diff ? diffLines(diff.original, input.value) : null;
    view.replaceChildren();
    if (rows) rows.forEach((row) => { const line = document.createElement('span'); line.className = `code-editor__line${row.kind === 'ctx' ? '' : ` code-editor__line--${row.kind}`}`; appendTokens(line, tokenize(row.text, language)); if (!row.text) line.append('\u00a0'); view.append(line); });
    else { appendTokens(view, tokenize(input.value, language)); view.append('\n'); }
    const count = rows?.length ?? input.value.split('\n').length;
    gutter.replaceChildren(...Array.from({ length: count }, (_, index) => { const line = document.createElement('span'); const mark = rows?.[index]?.kind; line.className = `code-editor__ln${mark && mark !== 'ctx' ? ` code-editor__ln--${mark}` : ''}`; line.textContent = mark === 'add' ? '+' : mark === 'del' ? '−' : String(index + 1); line.dataset.line = String(index); return line; }));
    meta.textContent = `${language} · ${count} lines · ${diff ? 'diff' : viewOnly ? 'view' : 'edit'}`;
  };
  const syncScroll = () => { const input = inputRef.current; if (!input || !viewRef.current || !gutterRef.current) return; viewRef.current.style.transform = `translate(${-input.scrollLeft}px, ${-input.scrollTop}px)`; gutterRef.current.scrollTop = input.scrollTop; };

  useEffect(() => { if (inputRef.current) inputRef.current.value = value; setDirty(false); render(); }, [value]);
  useEffect(render, [language, viewOnly, diff]);
  useImperativeHandle(forwardedRef, () => ({ getValue: () => inputRef.current?.value ?? '', setValue: (next, options) => { if (!inputRef.current) return; inputRef.current.value = next; setDirty(options?.dirty ?? false); render(); syncScroll(); }, markSaved: () => setDirty(false), focus: () => inputRef.current?.focus() }));

  const clearMarks = () => gutterRef.current?.querySelectorAll('[data-line]').forEach((line) => line.classList.remove('code-editor__ln--active'));
  const lineFromPointer = (clientY: number) => { const gutter = gutterRef.current!; const rect = gutter.getBoundingClientRect(); const height = parseFloat(getComputedStyle(inputRef.current!).lineHeight) || 22; return Math.max(0, Math.min(gutter.children.length - 1, Math.floor((clientY - rect.top + gutter.scrollTop) / height))); };
  const selectLines = (from: number, to: number) => { const input = inputRef.current!; const [low, high] = from <= to ? [from, to] : [to, from]; const lines = input.value.split('\n'); let start = 0; for (let index = 0; index < low; index += 1) start += lines[index].length + 1; let end = start; for (let index = low; index <= high; index += 1) end += lines[index].length + 1; input.focus(); input.setSelectionRange(start, Math.min(end, input.value.length)); [...gutterRef.current!.children].forEach((line, index) => line.classList.toggle('code-editor__ln--active', index >= low && index <= high)); };
  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const input = event.currentTarget;
    if (event.key === 'Tab' && !input.readOnly) { event.preventDefault(); input.setRangeText('  ', input.selectionStart, input.selectionEnd, 'end'); setDirty(true); render(); onChange?.(input.value); }
    if ((event.ctrlKey || event.metaKey) && event.key === 's') { event.preventDefault(); const result = onSave?.(input.value); if (result instanceof Promise) void result.then(() => setDirty(false)); else if (onSave) setDirty(false); }
  };

  return { inputRef, viewRef, gutterRef, metaRef, dirtyRef, anchor, lineFromPointer, selectLines, setDirty, render, syncScroll, keyDown, clearMarks };
};
