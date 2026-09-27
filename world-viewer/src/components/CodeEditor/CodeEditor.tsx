import { useEffect, useState } from 'react';
import './css/code-editor.css';
export interface CodeEditorProps { path: string; title?: string; className?: string; }
export const CodeEditor = ({ path, title = 'CodeEditor', className }: CodeEditorProps) => {
  const [text, setText] = useState('');
  const [saved, setSaved] = useState('');
  const [revision, setRevision] = useState('');
  const [status, setStatus] = useState('Loading…');
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true); setRevision(''); setStatus('Loading…');
    fetch(path, { signal: controller.signal }).then(async response => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setText(data.text); setSaved(data.text); setRevision(data.revision); setStatus('');
    }).catch(error => { if (!controller.signal.aborted) setStatus(error.message); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [path]);
  const save = async () => {
    try {
      if (title.toLowerCase().endsWith('.json')) JSON.parse(text);
      setBusy(true);
      const response = await fetch(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, revision }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setRevision(data.revision); setSaved(text); setStatus('Saved');
    } catch (error) { setStatus((error as Error).message); }
    finally { setBusy(false); }
  };
  return <section className={['code-editor', 'container-cell', className].filter(Boolean).join(' ')}>
    <header><strong>{title}</strong><button type="button" className="action-ghost" disabled={busy || !revision || text === saved} onClick={save}>Save</button></header>
    <textarea aria-label={title} spellCheck={false} value={text} disabled={busy || !revision} onChange={event => setText(event.target.value)} />
    <p role="status">{status || (text !== saved ? 'Unsaved changes' : 'Ready')}</p>
  </section>;
};
