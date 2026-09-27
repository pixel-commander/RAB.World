import { forwardRef } from 'react';
import type { CodeEditorHandle, CodeEditorProps, CodeEditorStylers } from './CodeEditor.types';
import { useCodeEditor } from './hooks/useCodeEditor';
import './css/code-editor.css';

export type { CodeEditorHandle, CodeEditorProps, CodeEditorStylers, CodeLanguage } from './CodeEditor.types';
export { tokenize, diffLines } from './js/code-editor';

export const CODE_EDITOR_STYLERS: Record<'main', CodeEditorStylers> = {
  main: { container: 'container-main' },
};

export const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(({ styler: stylerName = 'main', stylers = {}, value = '', language = 'css', viewOnly = false, diff = null, onChange, onSave, className, children, ...domProps }, forwardedRef) => {
  const { inputRef, viewRef, gutterRef, metaRef, dirtyRef, anchor, lineFromPointer, selectLines, setDirty, render, syncScroll, keyDown, clearMarks } = useCodeEditor({ value, language, viewOnly, diff, onChange, onSave }, forwardedRef);
  const styler = { ...CODE_EDITOR_STYLERS[stylerName], ...(stylers || {}) };
  return <div {...domProps} data-component="CodeEditor" className={`code-editor container ${styler?.container || ''}${viewOnly || diff ? ' code-editor--view-only' : ''}${className ? ` ${className}` : ''}`}>
    <div className="code-editor__frame">
      <div ref={gutterRef} className="code-editor__gutter" onPointerDown={(event) => { if (diff) return; anchor.current = lineFromPointer(event.clientY); selectLines(anchor.current, anchor.current); event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (anchor.current !== null) selectLines(anchor.current, lineFromPointer(event.clientY)); }} onPointerUp={() => { anchor.current = null; }} />
      <div className="code-editor__body"><pre className="code-editor__view" aria-hidden="true"><code ref={viewRef} className="code-editor__code" /></pre><textarea ref={inputRef} className="code-editor__input" defaultValue={value} aria-label="Code editor" readOnly={viewOnly || Boolean(diff)} hidden={Boolean(diff)} spellCheck={false} autoCapitalize="off" autoComplete="off" wrap="off" onScroll={syncScroll} onInput={(event) => { setDirty(true); render(); syncScroll(); onChange?.(event.currentTarget.value); }} onKeyDown={keyDown} onPointerDown={clearMarks} onBlur={clearMarks} /></div>
    </div>
    <footer className="code-editor__status"><span ref={metaRef} className="code-editor__meta" /><span ref={dirtyRef} className="code-editor__dirty" hidden>● unsaved — ctrl+s</span></footer>
  </div>;
});
