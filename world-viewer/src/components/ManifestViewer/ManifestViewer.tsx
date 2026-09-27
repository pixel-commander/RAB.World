import { useId } from 'react';
import type { ManifestEntry, ManifestViewerProps } from './ManifestViewer.types';
import { useManifest } from './hooks/useManifest';
import './css/manifest-viewer.css';

const Entries = ({ items, onOpenFile }: { items: ManifestEntry[]; onOpenFile?: (path: string) => void }) => {
  return <ul className="manifest-entries">{items.map((item, index) => {
    const children = Object.values(item.items ?? {});
    return <li key={`${item.path ?? item.id ?? item.name}-${index}`}>
      <details className="manifest-branch">
        <summary className="action-ghost"><span>{item.name ?? item.title ?? 'Unnamed entry'}</span><small>{item.type ?? 'entry'}{children.length ? ` · ${children.length}` : ''}</small></summary>
        <div className="manifest-detail">
          {item.title && item.title !== item.name && <strong>{item.title}</strong>}
          {onOpenFile && item.path && !children.length && !item.files && <button className="action-ghost" type="button" onClick={() => onOpenFile(item.path!)}>Open file</button>}
          {item.description && <p>{item.description}</p>}
          <dl>{item.id !== undefined && <><dt>ID</dt><dd>{item.id}</dd></>}{item.path && <><dt>Path</dt><dd>{item.path}</dd></>}{item.key && <><dt>Tool</dt><dd>{item.key}</dd></>}{item.authority && <><dt>Authority</dt><dd>{item.authority}</dd></>}</dl>
          {item.files && <details><summary>Files ({item.files.length})</summary>{item.files.length ? <ul>{item.files.map(file => <li key={file}>{onOpenFile ? <button type="button" className="action-ghost" onClick={() => onOpenFile(`${item.path ?? ""}/${file}`)}>{file}</button> : file}</li>)}</ul> : <p>No files directly in this folder.</p>}</details>}
        </div>
        {children.length > 0 && <Entries items={children} onOpenFile={onOpenFile} />}
      </details>
    </li>;
  })}</ul>;
};

export const ManifestViewer = ({ id, name, title, description, manifest, path, onOpenFile, children, className, ...domProps }: ManifestViewerProps) => {
  const heading = useId();
  const { data, error, loading } = useManifest(manifest, path);
  return <div {...domProps} id={id === undefined ? undefined : String(id)} data-name={name} data-component="ManifestViewer" className={['manifest-viewer', 'container-cell', className].filter(Boolean).join(' ')} aria-labelledby={heading} aria-busy={loading}>
    <header><h3 id={heading}>{title ?? data?.title ?? 'Manifest'}</h3>{(description ?? data?.description) && <p>{description ?? data?.description}</p>}</header>
    {loading && <p role="status">Loading manifest…</p>}
    {error && <p role="alert">{error}</p>}
    {data && <>{data.generated_at && <p className="manifest-date">Updated {new Date(data.generated_at).toLocaleString()}</p>}{Object.keys(data.items).length ? <Entries items={Object.values(data.items)} onOpenFile={onOpenFile} /> : <p>No entries in this manifest.</p>}</>}
    {children}
  </div>;
};
