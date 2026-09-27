import { CodeEditor } from '../CodeEditor.tsx';
const CSS = `.action-accent {\n  color: var(--content-inverse);\n  background: var(--accent-surface);\n}`;
export default () => { return <div className="code-editor-demo"><CodeEditor value={CSS} language="css" /></div>; };
