import { useEffect, useRef, useState } from 'react';

import { CodeEditor } from '../../components/CodeEditor/CodeEditor';

import type { HTMLAttributes } from 'react';

import { ManifestViewer } from '../../components/ManifestViewer/ManifestViewer';

import '../../atoms/actions/action-rail-left/action-rail-left.css';

import './css/beacon.css';

import data from '../../data/world.generated.json';

import type { ShellViewProps } from '../../shell/components/SiteShell';

export type BeaconProps = HTMLAttributes<HTMLElement> & ShellViewProps;

export const Beacon = ({ children, className, url, handleURL, selected: _selected, ...domProps }: BeaconProps) => {

  const [opened, setOpened] = useState<{ beacon: string; file: string }>();

  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (opened && !dialog.current?.open) dialog.current?.showModal();
    if (!opened && dialog.current?.open) dialog.current?.close();
  }, [opened]);

  const selectedId = url.url_vars.beacon ?? String(data.beacons[0]?.id ?? '');

  const beacon = data.beacons.find(item => String(item.id) === selectedId) ?? data.beacons[0];

  const manifestOpen = url.url_vars.beacon_tab === 'manifest';

  const classes = ['beacon-view', className].filter(Boolean).join(' ');

  return <main {...domProps} className={classes} data-page="Beacon" data-grid="side-left" data-gap="content">

    <aside data-area="side" className="container-cell">

      <h1>Beacons</h1>

      <ul className="beacon-list">

        {data.beacons.map(item => <li key={item.id}>

          <button type="button" className={String(item.id) === String(beacon?.id) ? 'action-rail-left is-active' : 'action-rail-left'} aria-pressed={String(item.id) === String(beacon?.id)} onClick={() => handleURL({ beacon: String(item.id) }, 'update-var')}><span>{item.title}</span><small>{item.type} · {item.beacon}</small></button>

          <button type="button" className="action-ghost beacon-file-link" onClick={() => setOpened({ beacon: String(item.id), file: 'manifest.json' })} aria-label={`View manifest.json for ${item.title}`}>view manifest.json</button>
        </li>)}

      </ul>

    </aside>

    <section data-area="main" className="container-cell">

      {beacon ? <>

        <h2>{beacon.title}</h2>

        <p>{beacon.description}</p>

        <nav className="beacon-tabs" aria-label="Beacon views">

          <button type="button" className={`action-ghost${!manifestOpen ? ' is-active' : ''}`} aria-pressed={!manifestOpen} onClick={() => handleURL({ beacon_tab: 'details' }, 'update-var')}>Details</button>

          <button type="button" className={`action-ghost${manifestOpen ? ' is-active' : ''}`} aria-pressed={manifestOpen} onClick={() => handleURL({ beacon_tab: 'manifest' }, 'update-var')}>Manifest</button>

        </nav>

        {manifestOpen ? <ManifestViewer key={beacon.id} onOpenFile={file => setOpened({ beacon: String(beacon.id), file })} title={`${beacon.title} manifest`} path={`/api/beacon-manifest?id=${encodeURIComponent(String(beacon.id))}`} /> : <dl className="beacon-metadata">

          <dt>Name</dt><dd>{beacon.name}</dd>

          <dt>World</dt><dd>{beacon.world_name}</dd>

          <dt>Type</dt><dd>{beacon.type}</dd>

          <dt>Path</dt><dd>{beacon.path}</dd>

          <dt>Status</dt><dd>{beacon.beacon}</dd>

          <dt>Reach</dt><dd>{beacon.reach.join(', ')}</dd>

          <dt>Contents</dt><dd>{beacon.types.join(', ')}</dd>

        </dl>}

        <button type="button" className="action-ghost" onClick={() => setOpened({ beacon: String(beacon.id), file: 'manifest.json' })}>Edit manifest.json</button>

      </> : <p>No beacons were found.</p>}

      <dialog ref={dialog} className="beacon-editor-popup container-cell" aria-label="File editor" onClose={() => setOpened(undefined)}>
        <div className="beacon-editor-toolbar"><span>File editor</span><button type="button" className="action-ghost" onClick={() => dialog.current?.close()} autoFocus>Close</button></div>
        {opened && <CodeEditor key={`${opened.beacon}/${opened.file}`} title={opened.file} path={`/api/beacon-file?id=${encodeURIComponent(opened.beacon)}&file=${encodeURIComponent(opened.file)}`} />}
      </dialog>
      {children}

    </section>

  </main>;

};

