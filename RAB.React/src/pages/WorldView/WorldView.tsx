import { useURL } from '../../hooks/useURL/useURL';
import { useMemo } from 'react';
import { Tabs } from '../../components/Tabs/Tabs';
import { CodeEditor } from '../../components/CodeEditor/CodeEditor';
import { useDashboard, useSettingsEditor, useWorldCollection } from './hooks/useDashboard';
import type { WorldViewProps, WorldSettings } from './WorldView.types';
import './css/world-view.css';

export const WorldView = (props: WorldViewProps) => {
  props = { ...props, path: props.path ?? String.raw`\\Desktop-t72isdi\c\Users\gauge\.rab\worlds\server` };
  const [url] = useURL();
  const entry = url.url_vars.entry;
  const collection = url.url_vars.tab === 'Beacons' ? 'beacons' : 'toolkits';
  const { settings, loading, error, handleSaved } = useDashboard(props);
  return <section className="world-view" data-grid="holy-grail" data-gap="content">
    <div data-area="header">
      {settings ? <><span>{settings.name}</span><h1>{settings.title}</h1><p>{settings.description}</p></> : <h1>World View</h1>}
    </div>
    <div data-area="left" className="scroll-y"><WorldNavigation path={props.path!} /></div>
    <div data-area="main" className="scroll-y">
      {loading && <p role="status">Loading world settings�</p>}
      {error && <p role="alert">{error}</p>}
      {entry && <WorldPaths key={`${collection}:${entry}`} path={props.path!} collection={collection} entry={entry} />}

    </div>
    <div data-area="right" className="scroll-y">{settings && <WorldSettingsEditor key={props.path} path={props.path!} settings={settings} handleSaved={handleSaved} />}</div>
    <div data-area="footer">{settings?.date_added && <time dateTime={settings.date_added}>Added: {settings.date_added}</time>}</div>
  </section>;
};
export default WorldView;

export const WorldSettingsEditor = ({ path, settings, handleSaved }: { path: string; settings: WorldSettings; handleSaved: (settings: WorldSettings) => void }) => {
  const { text, saving, message, error, handleSave, handleChange } = useSettingsEditor(path, settings, handleSaved);
  return <section className="world-settings-editor">
    <h2>settings.json</h2>
    <CodeEditor value={text} language="plain" onChange={handleChange} onSave={handleSave} viewOnly={saving} />
    <button className="action-ghost" type="button" disabled={saving} onClick={() => handleSave()}>{saving ? 'Saving...' : 'Save'}</button>
    {error && <p role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
  </section>;
};

export const WorldPaths = ({ path, collection, entry }: { path: string; collection: 'toolkits' | 'beacons'; entry?: string }) => {
  const { items, error } = useWorldCollection(path, collection, entry);
  const [, handleURL] = useURL();
  if (error) return <p role="alert">{error}</p>;
  if (!items) return <p role="status">Loading...</p>;
  return <ul className="world-paths">{items.length ? items.map(item => <li key={item.id}>
    {entry ? <strong>{item.title ?? item.name}</strong> : <a className="action-ghost" href={`#tab=${collection === 'beacons' ? 'Beacons' : 'Toolkits'}&entry=${encodeURIComponent(item.id)}`} onClick={event => { event.preventDefault(); handleURL({ tab: collection === 'beacons' ? 'Beacons' : 'Toolkits', entry: String(item.id) }, 'update-var'); }}>{item.title ?? item.name}</a>}<code>{item.path}</code>
  </li>) : <li>No {collection} listed.</li>}</ul>;
};

export const WorldNavigation = ({ path }: { path: string }) => {
  const [, handleURL] = useURL();
  const tabs = useMemo(() => [
    { id: 'toolkits', name: 'Toolkits', View: () => <WorldPaths path={path} collection="toolkits" /> },
    { id: 'beacons', name: 'Beacons', View: () => <WorldPaths path={path} collection="beacons" /> },
  ], [path]);
  return <Tabs tabs={tabs} use_url handleClick={(item) => { if (item) handleURL({ tab: item.name, entry: '' }, 'update-var'); }} />;
};
