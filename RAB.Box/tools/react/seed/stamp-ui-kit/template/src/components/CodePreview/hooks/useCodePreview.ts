import { useEffect, useRef } from 'react';
import type { CodeEditorHandle } from '../../code-editor/CodeEditor.tsx';
import type { CodePreviewProps } from '../CodePreview.types.ts';
export const useCodePreview = ({ sourceRef, sourceId, handleChange }: CodePreviewProps) => {
  const editorRef = useRef<CodeEditorHandle>(null);
  useEffect(() => {
    const root = sourceRef?.current;
    const source = sourceId ? Array.from(root?.querySelectorAll<HTMLElement>('[data-id]') ?? []).find(element => element.dataset.id === sourceId) : root;
    if (!source) return;
    let frame = 0;
    let previous = '';
    const update = () => {
      frame = 0;
      const value = handleChange ? handleChange(source, 'html') : source.outerHTML;
      if (typeof value === 'string' && value !== previous) { previous = value; editorRef.current?.setValue(value); }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const observer = new MutationObserver(schedule);
    observer.observe(source, { attributes: true, childList: true, subtree: true, characterData: true });
    source.addEventListener('input', schedule);
    source.addEventListener('change', schedule);
    update();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); source.removeEventListener('input', schedule); source.removeEventListener('change', schedule); };
  }, [sourceRef, sourceId, handleChange]);
  return { editorRef };
};
