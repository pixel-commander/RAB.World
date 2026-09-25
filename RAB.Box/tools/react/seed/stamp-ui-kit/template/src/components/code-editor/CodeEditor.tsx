import { forwardRef, useEffect, useImperativeHandle, useRef, type KeyboardEvent } from 'react';
import './code-editor.css';

export type CodeLanguage = 'css' | 'js' | 'html' | 'plain';
interface Token { cls: string; text: string; }
interface DiffRow { kind: 'ctx' | 'add' | 'del'; text: string; }
interface TokenRule { cls: string; re: RegExp; }

export interface CodeEditorProps {
  value?: string;
  language?: CodeLanguage;
  viewOnly?: boolean;
  diff?: { original: string } | null;
  onChange?: (value: string) => void;
  onSave?: (value: string) => void | Promise<void>;
}
export interface CodeEditorHandle {
  getValue: () => string;
  setValue: (value: string, options?: { dirty?: boolean }) => void;
  markSaved: () => void;
  focus: () => void;
}

const CSS_RULES: TokenRule[] = [
  { cls: 'tok-com', re: /\/\*[\s\S]*?(?:\*\/|$)/y }, { cls: 'tok-str', re: /"[^"\n]*"|'[^'\n]*'/y },
  { cls: 'tok-at', re: /@[\w-]+/y }, { cls: 'tok-var', re: /--[\w-]+/y }, { cls: 'tok-fn', re: /[\w-]+(?=\()/y },
  { cls: 'tok-num', re: /-?(?:\d*\.)?\d+(?:px|rem|em|dvh|dvw|vh|vw|%|ms|s|fr|deg|ch)?/y },
  { cls: 'tok-sel', re: /[.#][\w-]+/y }, { cls: 'tok-prop', re: /[a-z-]+(?=\s*:)/y }, { cls: 'tok-punc', re: /[{}();:,>~*[\]]/y },
];
const JS_RULES: TokenRule[] = [
  { cls: 'tok-com', re: /\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)/y }, { cls: 'tok-str', re: /`[^`]*`|"[^"\n]*"|'[^'\n]*'/y },
  { cls: 'tok-key', re: /\b(?:const|let|var|function|return|if|else|for|while|of|in|new|class|extends|import|export|from|default|async|await|try|catch|throw|typeof|instanceof|null|undefined|true|false|this)\b/y },
  { cls: 'tok-num', re: /-?(?:\d*\.)?\d+/y }, { cls: 'tok-fn', re: /[\w$]+(?=\()/y }, { cls: 'tok-punc', re: /[{}()[\];:,.=<>+\-*/!&|?]/y },
];
const HTML_RULES: TokenRule[] = [
  { cls: 'tok-com', re: /<!--[\s\S]*?(?:-->|$)/y }, { cls: 'tok-str', re: /"[^"\n]*"|'[^'\n]*'/y },
  { cls: 'tok-key', re: /<\/?[\w-]+|\/?>/y }, { cls: 'tok-prop', re: /[\w-]+(?==)/y }, { cls: 'tok-punc', re: /=/y },
];
const LANG_RULES: Record<Exclude<CodeLanguage, 'plain'>, TokenRule[]> = { css: CSS_RULES, js: JS_RULES, html: HTML_RULES };

export const tokenize = (text: string, language: CodeLanguage): Token[] => {
  if (language === 'plain') return [{ cls: '', text }];
  const tokens: Token[] = [];
  let plain = '';
  let at = 0;
  const flush = () => { if (plain) { tokens.push({ cls: '', text: plain }); plain = ''; } };
  while (at < text.length) {
    let hit: Token | null = null;
    for (const rule of LANG_RULES[language]) {
      rule.re.lastIndex = at;
      const match = rule.re.exec(text);
      if (match?.[0]) { hit = { cls: rule.cls, text: match[0] }; break; }
    }
    if (hit) { flush(); tokens.push(hit); at += hit.text.length; } else { plain += text[at]; at += 1; }
  }
  flush();
  return tokens;
};

export const diffLines = (before: string, after: string): DiffRow[] => {
  const a = before.split('\n');
  const b = after.split('\n');
  if (a.length * b.length > 500000) return [...a.map((text): DiffRow => ({ kind: 'del', text })), ...b.map((text): DiffRow => ({ kind: 'add', text }))];
  const width = b.length + 1;
  const table = new Uint32Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i -= 1) for (let j = b.length - 1; j >= 0; j -= 1) table[i * width + j] = a[i] === b[j] ? table[(i + 1) * width + j + 1] + 1 : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
  const rows: DiffRow[] = [];
  let i = 0; let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { rows.push({ kind: 'ctx', text: a[i] }); i += 1; j += 1; }
    else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) { rows.push({ kind: 'del', text: a[i] }); i += 1; }
    else { rows.push({ kind: 'add', text: b[j] }); j += 1; }
  }
  while (i < a.length) rows.push({ kind: 'del', text: a[i++] });
  while (j < b.length) rows.push({ kind: 'add', text: b[j++] });
  return rows;
};

const appendTokens = (target: HTMLElement, tokens: Token[]) => {
  target.replaceChildren();
  tokens.forEach((token) => {
    if (!token.cls) target.append(token.text);
    else { const span = document.createElement('span'); span.className = token.cls; span.textContent = token.text; target.append(span); }
  });
};

export const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(function CodeEditor({ value = '', language = 'css', viewOnly = false, diff = null, onChange, onSave }, forwardedRef) {
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

  const clearMarks = () => gutterRef.current?.querySelectorAll('.code-editor__ln--active').forEach((line) => line.classList.remove('code-editor__ln--active'));
  const lineFromPointer = (clientY: number) => { const gutter = gutterRef.current!; const rect = gutter.getBoundingClientRect(); const height = parseFloat(getComputedStyle(inputRef.current!).lineHeight) || 22; return Math.max(0, Math.min(gutter.children.length - 1, Math.floor((clientY - rect.top + gutter.scrollTop) / height))); };
  const selectLines = (from: number, to: number) => { const input = inputRef.current!; const [low, high] = from <= to ? [from, to] : [to, from]; const lines = input.value.split('\n'); let start = 0; for (let index = 0; index < low; index += 1) start += lines[index].length + 1; let end = start; for (let index = low; index <= high; index += 1) end += lines[index].length + 1; input.focus(); input.setSelectionRange(start, Math.min(end, input.value.length)); [...gutterRef.current!.children].forEach((line, index) => line.classList.toggle('code-editor__ln--active', index >= low && index <= high)); };
  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const input = event.currentTarget;
    if (event.key === 'Tab' && !input.readOnly) { event.preventDefault(); input.setRangeText('  ', input.selectionStart, input.selectionEnd, 'end'); setDirty(true); render(); onChange?.(input.value); }
    if ((event.ctrlKey || event.metaKey) && event.key === 's') { event.preventDefault(); const result = onSave?.(input.value); if (result instanceof Promise) void result.then(() => setDirty(false)); else if (onSave) setDirty(false); }
  };

  return <div className={`code-editor container-inset${viewOnly || diff ? ' code-editor--view-only' : ''}`}>
    <div className="code-editor__frame">
      <div ref={gutterRef} className="code-editor__gutter" onPointerDown={(event) => { if (diff) return; anchor.current = lineFromPointer(event.clientY); selectLines(anchor.current, anchor.current); event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (anchor.current !== null) selectLines(anchor.current, lineFromPointer(event.clientY)); }} onPointerUp={() => { anchor.current = null; }} />
      <div className="code-editor__body"><pre className="code-editor__view" aria-hidden="true"><code ref={viewRef} className="code-editor__code" /></pre><textarea ref={inputRef} className="code-editor__input" defaultValue={value} readOnly={viewOnly || Boolean(diff)} hidden={Boolean(diff)} spellCheck={false} autoCapitalize="off" autoComplete="off" wrap="off" onScroll={syncScroll} onInput={(event) => { setDirty(true); render(); syncScroll(); onChange?.(event.currentTarget.value); }} onKeyDown={keyDown} onPointerDown={clearMarks} onBlur={clearMarks} /></div>
    </div>
    <footer className="code-editor__status"><span ref={metaRef} className="code-editor__meta" /><span ref={dirtyRef} className="code-editor__dirty" hidden>● unsaved — ctrl+s</span></footer>
  </div>;
});
