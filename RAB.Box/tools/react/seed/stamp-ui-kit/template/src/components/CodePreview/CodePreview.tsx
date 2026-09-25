import { CodeEditor } from '../code-editor/CodeEditor.tsx';
import type { CodePreviewProps } from './CodePreview.types.ts';
import { useCodePreview } from './hooks/useCodePreview.ts';
import './css/code-preview.css';
export const CodePreview = (props: CodePreviewProps = {}) => {
  const { editorRef } = useCodePreview(props);
  return <section className="code-preview" data-grid="header-main" aria-label="HTML preview">
    <header data-area="header" className="code-preview__heading">HTML</header>
    <div data-area="main" className="code-preview__body"><CodeEditor ref={editorRef} language="html" viewOnly /></div>
  </section>;
};
