import type { HTMLAttributes } from 'react';
import data from '../../data/world.generated.json';
import type { ShellViewProps } from '../../shell/components/SiteShell';
import { ManifestViewer } from '../../components/ManifestViewer/ManifestViewer';

export type WorldProps = HTMLAttributes<HTMLElement> & ShellViewProps;
export const World = ({ children, className, url, handleURL, selected: _selected, ...domProps }: WorldProps) => {
  const selectedId = url.url_vars.world ?? String(data.worlds[0]?.id ?? '');
  const world = data.worlds.find(item => String(item.id) === selectedId) ?? data.worlds[0];
  const classes = ['world-view', className].filter(Boolean).join(' ');
  const selectedManifest = data.manifests.find(item => item.name === (url.url_vars.manifest ?? 'base')) ?? data.manifests[0];
  return <main {...domProps} className={classes} data-page="World" data-grid="side-left" data-gap="content">
    <aside data-area="side" className="container-cell">
      <h1>Worlds</h1>
      <ul>
        {data.worlds.map(item => <li key={item.id}>
          <button type="button" className={String(item.id) === String(world?.id) ? 'action-ghost is-active' : 'action-ghost'} aria-pressed={String(item.id) === String(world?.id)} onClick={() => handleURL({ world: String(item.id) }, 'update-var')}>{item.title}</button>
        </li>)}
      </ul>
    </aside>
    <section data-area="main" className="container-cell">
      {world ? <>
        <h2>{world.title}</h2>
        <a href={world.settingsUrl} target="_blank" rel="noreferrer">view settings.json</a>
        <p>{world.description}</p>
        <dl>
          <dt>Name</dt><dd>{world.name}</dd>
          <dt>Path</dt><dd>{world.root}</dd>
          <dt>Beacons</dt><dd>{world.beacon_count}</dd>
          <dt>Known tools</dt><dd>{data.tools.length}</dd>
        </dl>
        <h3>Registered toolkits</h3>
        <ul>{world.toolkits.map(toolkit => <li key={toolkit.id}><strong>{toolkit.title}</strong><br />{toolkit.description}</li>)}</ul>
        <h3>Manifests</h3>
        <nav aria-label="Manifest selection" className="manifest-switcher">
          {data.manifests.map(item => <button key={item.id} type="button" className={item.name === selectedManifest?.name ? 'action-ghost is-active' : 'action-ghost'} aria-pressed={item.name === selectedManifest?.name} onClick={() => handleURL({ manifest: item.name }, 'update-var')}>{item.title}</button>)}
        </nav>
        {selectedManifest ? <ManifestViewer key={selectedManifest.id} {...selectedManifest} /> : <p>No manifests are available.</p>}
      </> : <p>No worlds were found.</p>}
      {children}
    </section>
  </main>;
};
