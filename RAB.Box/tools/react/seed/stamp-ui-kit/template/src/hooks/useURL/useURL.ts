import { useState, useEffect, useCallback } from 'react';
import type { HandlerKey } from '../../HouseKeys.types.ts';

export type HandleType = 'update-path' | 'set-path' | 'update-var' | 'update' | 'remove-var';
export type UrlVars = Record<string, string>;
export type URLHandleData = Record<string, unknown>;

export interface UrlState {
  [key: string]: string | UrlVars;
  url_vars: UrlVars;
}

export type HandleURL = HandlerKey<URLHandleData, HandleType, UrlState>;

export const DEFAULT_TEMPLATE = 'page/section';

const VAR_DELIMS = /[?#$]/;

const recordOf = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

const templateKeys = (template: string): string[] => template.split('/').filter(Boolean);

const parsePaths = (template: string, pathname: string): Record<string, string> => {
  const segments = (pathname || '').split('/').filter(Boolean);
  const out: Record<string, string> = {};
  templateKeys(template).forEach((key, i) => { out[key] = segments[i] || ''; });
  return out;
};

const parseVars = (href: string): UrlVars => {
  const out: UrlVars = {};
  const tail = (href || '').split(VAR_DELIMS).slice(1).join('&');
  tail.split('&').forEach(pair => {
    if (!pair) return;
    const eq = pair.indexOf('=');
    if (eq === -1) return;
    const key = pair.slice(0, eq);
    if (key) out[key] = pair.slice(eq + 1);
  });
  return out;
};

const buildHref = (template: string, paths: Record<string, string>, vars: UrlVars): string => {
  const path = '/' + templateKeys(template).map(key => paths[key]).filter(Boolean).join('/');
  const var_keys = Object.keys(vars).filter(key => vars[key] !== '');
  const search = var_keys.length
    ? '#' + var_keys.map(key => `${key}=${vars[key]}`).join('&')
    : '';
  return path + search;
};

const pathsOf = (state: UrlState): Record<string, string> => {
  const out: Record<string, string> = {};
  Object.keys(state).forEach(key => {
    if (key !== 'url_vars') out[key] = state[key] as string;
  });
  return out;
};

const applyPaths = (
  template: string,
  current: Record<string, string>,
  options: Record<string, unknown>,
): Record<string, string> => {
  const keys = templateKeys(template);
  const named = Object.keys(options).filter(key => keys.includes(key));
  if (!named.length) return { ...current };

  const deepest = Math.max(...named.map(key => keys.indexOf(key)));
  const cleared = named.some(key => options[key] === undefined && keys.indexOf(key) === deepest);
  const cut = cleared ? deepest : deepest + 1;

  const out: Record<string, string> = {};
  keys.forEach((key, i) => {
    if (i >= cut) return;
    const given = Object.prototype.hasOwnProperty.call(options, key) ? options[key] : undefined;
    out[key] = given === undefined ? (current[key] || '') : String(given);
  });
  return out;
};

const stringed = (next: Record<string, unknown>): UrlVars => {
  const out: UrlVars = {};
  Object.keys(next || {}).forEach((key) => { out[key] = String(next[key] ?? ''); });
  return out;
};

const URL_SUBS = new Set<() => void>();
const announceURL = () => URL_SUBS.forEach((fn) => { try { fn(); } catch {  } });

export const useURL = (template: string = DEFAULT_TEMPLATE) => {
  const safeTemplate = typeof template === 'string' ? template : DEFAULT_TEMPLATE;
  const read = useCallback((): UrlState => {
    if (typeof window === 'undefined') return { ...parsePaths(safeTemplate, ''), url_vars: {} };
    return { ...parsePaths(safeTemplate, window.location.pathname || ''), url_vars: parseVars(window.location.href || '') };
  }, [safeTemplate]);

  const [state, setState] = useState<UrlState>(read);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sync = () => setState(read());
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    URL_SUBS.add(sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hashchange', sync);
      URL_SUBS.delete(sync);
    };
  }, [read]);

  const handleURL = useCallback<HandleURL>((data = {}, type) => {
    const current = read();
    const options = recordOf(data);

    const commit = (paths: Record<string, string>, vars: UrlVars): UrlState => {
      if (typeof window === 'undefined') return current;
      window.history.pushState({}, '', buildHref(safeTemplate, paths, vars));
      const next = read();
      setState(next);
      announceURL();
      return next;
    };

    switch (type) {
      case 'update-path':
      case 'set-path': {
        const named = Object.prototype.hasOwnProperty.call(options, 'url_vars');
        const given = options.url_vars;
        const vars = type === 'set-path' ? {}
          : !named ? current.url_vars
          : given === undefined ? {}
          : { ...current.url_vars, ...stringed(recordOf(given)) };
        return commit(applyPaths(safeTemplate, pathsOf(current), options), vars);
      }
      case 'update-var':
        return commit(pathsOf(current), { ...current.url_vars, ...stringed(options) });
      case 'update':
        return commit(
          applyPaths(safeTemplate, pathsOf(current), recordOf(options.paths)),
          { ...current.url_vars, ...stringed(recordOf(options.vars)) },
        );
      case 'remove-var': {
        const next_vars = { ...current.url_vars };
        Object.keys(options).forEach(key => { delete next_vars[key]; });
        return commit(pathsOf(current), next_vars);
      }
      default:
        console.error(
          `invalid handler for useURL: '${type}'. The five verbs are ` +
          `update-path, set-path, update-var, update, remove-var. The URL was NOT changed.`,
        );
        return current;
    }
  }, [read, safeTemplate]);

  return [state, handleURL] as const;
};

export const useScopedVars = (scope?: string) => {
  const [{ url_vars }, handleURL] = useURL();
  const tag = scope ? scope + '.' : '';
  const vars: UrlVars = {};
  Object.keys(url_vars || {}).forEach((key) => {
    if (!tag) { vars[key] = (url_vars as UrlVars)[key]; return; }
    if (key.indexOf(tag) === 0) vars[key.slice(tag.length)] = (url_vars as UrlVars)[key];
  });
  const get = (key: string) => (key in vars ? vars[key] : null);
  const set = (key: string, value: unknown) => handleURL({ [tag + key]: String(value ?? '') }, 'update-var');
  const patch = (next: Record<string, unknown>) => {
    const writes: Record<string, string> = {};
    Object.keys(next || {}).forEach((key) => { writes[tag + key] = String(next[key] ?? ''); });
    handleURL(writes, 'update-var');
  };
  const clear = (...keys: string[]) => {
    const drops: Record<string, string> = {};
    keys.forEach((key) => { drops[tag + key] = ''; });
    handleURL(drops, 'remove-var');
  };
  return { params: vars, vars, get, set, patch, clear };
};
