import { useEffect, useState } from 'react';
import type { WorldViewProps, WorldSettings } from '../WorldView.types';

export const useDashboard = (props: WorldViewProps) => {
  const [state, setState] = useState<{ path?: string; settings?: WorldSettings; error?: string }>({});
  useEffect(() => {
    const controller = new AbortController();
    const path = props.path;
    setState({ path });
    fetch(`/api/world-settings?path=${encodeURIComponent(path ?? '')}`, { signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? 'Could not load world settings.');
        if (!data || typeof data.name !== 'string' || typeof data.id !== 'number') throw new Error('Invalid world settings.');
        if (!controller.signal.aborted) setState({ path, settings: data });
      })
      .catch(error => { if (!controller.signal.aborted) setState({ path, error: error.message }); });
    return () => controller.abort();
  }, [props.path]);
  const current = state.path === props.path ? state : {};
  const handleSaved = (settings: WorldSettings) => setState({ path: props.path, settings });
  return { ...props, handleSaved, settings: current.settings, error: current.error, loading: !current.settings && !current.error };
};

export const useSettingsEditor = (path: string, settings: WorldSettings, handleSaved: (settings: WorldSettings) => void) => {
  const [text, setText] = useState(() => JSON.stringify(settings, null, 2));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const handleSave = async (value = text) => {
    if (saving) return;
    setError(''); setMessage(''); setSaving(true);
    try {
      const next = JSON.parse(value);
      const response = await fetch(`/api/world-settings?path=${encodeURIComponent(path)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ original: settings, settings: next }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Save failed.');
      handleSaved(result); setMessage('Saved.');
    } catch (error) { setError(error instanceof Error ? error.message : 'Save failed.'); }
    finally { setSaving(false); }
  };
  return { text, saving, message, error, handleSave, handleChange: (value: string) => { setText(value); setMessage(''); } };
};

export interface WorldEntry { id: string | number; name: string; title?: string; path: string; type?: string; types?: string[]; }
export const useWorldCollection = (path: string, collection: 'toolkits' | 'beacons', entry?: string) => {
  const [state, setState] = useState<{ items?: WorldEntry[]; error?: string }>({});
  useEffect(() => {
    const controller = new AbortController(); setState({});
    fetch(`/api/world-settings?path=${encodeURIComponent(path)}&collection=${collection}${entry ? `&entry=${encodeURIComponent(entry)}` : ''}`, { signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? 'Could not load manifest.');
        if (!Array.isArray(data.items)) throw new Error('Invalid manifest.');
        if (!controller.signal.aborted) setState({ items: data.items });
      }).catch(error => { if (!controller.signal.aborted) setState({ error: error.message }); });
    return () => controller.abort();
  }, [path, collection, entry]);
  return state;
};
