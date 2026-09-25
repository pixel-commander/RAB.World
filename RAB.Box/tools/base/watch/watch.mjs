import path from 'node:path';
import { watch } from 'node:fs';
import { readFile, lstat, writeFile, rename, unlink } from 'node:fs/promises';
import { createRabMemory } from '../../../bridge/rab-memory.mjs';
import { assertNumericId } from '../../../bridge/rab-id.mjs';
import { withMemoryLock } from '../../../bridge/rab-memory-lock.mjs';
import { containedPath, insist, record } from '../../../engine/src/core.mjs';
import { normalizeInventoryConditions, resolveInventory, updateInventory } from '../_inventory.mjs';

const VERSION = 'project-listener/v1';
const instances = new Map();
const ignored = new Set(['.git', '.rab', 'node_modules', 'template']);
const errorInfo = error => ({ code: error.code ?? 'WATCH_FAILED', message: error.message });
const inFolder = (root, target) => { const rel = path.relative(root, target); return rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel)); };
const validateType = type => insist(typeof type === 'string' && /^[a-z][a-z0-9_-]{0,63}$/i.test(type) && !['constructor','prototype','__proto__'].includes(type), 'BAD_INPUT', 'Supply a named project path key.');
const milliseconds = (value, fallback, min, name) => {
  const selected = value === undefined ? fallback : value;
  insist(Number.isSafeInteger(selected) && selected >= min && selected <= 86400000, 'BAD_INPUT', name + ' is outside its supported millisecond range.');
  return selected;
};
const registration = (options, prior = {}) => {
  validateType(options.type);
  return { ...normalizeInventoryConditions({ ...prior, ...options }), type: options.type,
    debounce_ms: milliseconds(options.debounce_ms, prior.debounce_ms ?? 200, 0, 'debounce_ms'),
    reconcile_ms: milliseconds(options.reconcile_ms, prior.reconcile_ms ?? 30000, 250, 'reconcile_ms') };
};

// One lifecycle owner. It calls the existing inventory writer, not a second scanner.
export const createProjectWatcher = ({ rabHome, watchFactory = watch } = {}) => {
  const memory = createRabMemory({ rabHome });
  const active = new Map();
  let closed = false;
  const configFile = async context => {
    await memory.readProjectSettings(context.project);
    return containedPath(memory.rabHome, path.relative(memory.rabHome, path.join(memory.paths(context.project).project, 'listener.json')), { allowMissing: true });
  };
  const readConfig = async context => {
    const file = await configFile(context);
    try {
      const info = await lstat(file);
      insist(info.isFile() && !info.isSymbolicLink() && info.size <= 1024 * 1024, 'BAD_LISTENER', 'Listener settings must be a regular file under 1 MiB.');
      const data = JSON.parse(await readFile(file, 'utf8'));
      insist(data.version === VERSION && record(data.paths) && Object.keys(data.paths).length <= 256, 'BAD_LISTENER', 'Invalid listener settings.');
      for (const [type, item] of Object.entries(data.paths)) {
        insist(record(item) && type === item.type, 'BAD_LISTENER', 'Listener path key and registration must agree.');
        assertNumericId(item.id); registration(item);
      }
      return data;
    } catch (error) { if (error.code === 'ENOENT') return { version: VERSION, paths: {} }; throw error; }
  };
  const saveConfig = async (context, change) => {
    const file = await configFile(context);
    return withMemoryLock(path.join(path.dirname(file), '.listener-lock'), async () => {
      const data = await readConfig(context), result = await change(data);
      const temporary = file + '.tmp';
      try {
        await writeFile(temporary, JSON.stringify(data, null, 2) + '\n');
        await rename(temporary, file);
      } finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
      return result;
    });
  };
  const keyFor = (context, type) => memory.paths(context.project).project + '\0' + type;
  const view = state => ({ ...state.registration, project_id: state.context.project.id, status: state.status, root: state.root ?? null,
    last_update: state.lastUpdate ?? null, count: state.count ?? null, manifest: state.manifest ?? null,
    error: state.error ?? null, watch_error: state.watchError ?? null });
  const dispose = state => {
    state.stopped = true;
    clearTimeout(state.timer); clearInterval(state.interval);
    state.rootWatch?.close(); state.settingsWatch?.close();
    state.rootWatch = null; state.settingsWatch = null;
    if (active.get(state.key) === state) active.delete(state.key);
  };
  const schedule = state => {
    if (closed || state.stopped) return;
    state.dirty = true;
    if (state.running || state.timer) return;
    state.timer = setTimeout(() => { state.timer = null; void refresh(state); }, state.registration.debounce_ms);
    state.timer.unref?.();
  };
  const attach = (state, scope) => {
    if (state.root !== scope.root) { state.rootWatch?.close(); state.rootWatch = null; state.root = scope.root; }
    if (!state.rootWatch) {
      try {
        state.rootWatch = watchFactory(scope.root, { recursive: true, persistent: false }, (event, filename) => {
          if (filename === null || filename === undefined) { schedule(state); return; }
          const relative = String(filename).replaceAll('\\', '/');
          if (relative.split('/').some(part => ignored.has(part.toLowerCase()))) return;
          if (inFolder(path.join(memory.paths(state.context.project).project, 'manifests'), path.resolve(scope.root, relative))) return;
          if (event === 'rename' || path.basename(relative).toLowerCase() === 'settings.json') schedule(state);
        });
        state.rootWatch.on('error', error => { state.watchError = errorInfo(error); state.rootWatch?.close(); state.rootWatch = null; schedule(state); });
        state.watchError = null;
      } catch (error) { state.watchError = errorInfo(error); }
    }
    if (!state.settingsWatch) {
      try {
        state.settingsWatch = watchFactory(path.dirname(scope.settings_file), { persistent: false }, (event, filename) => {
          if (!filename || ['settings.json','listener.json'].includes(String(filename).toLowerCase())) schedule(state);
        });
        state.settingsWatch.on('error', error => { state.watchError = errorInfo(error); state.settingsWatch?.close(); state.settingsWatch = null; });
      } catch (error) { state.watchError = errorInfo(error); }
    }
  };
  const refresh = state => {
    if (closed || state.stopped) return Promise.resolve();
    if (state.running) { state.dirty = true; return state.running; }
    state.dirty = false;
    state.running = (async () => {
      try {
        const saved = (await readConfig(state.context)).paths[state.registration.type];
        if (!saved) { dispose(state); return; }
        if (JSON.stringify(saved) !== JSON.stringify(state.registration)) {
          state.registration = saved;
          clearInterval(state.interval);
          state.interval = setInterval(() => schedule(state), saved.reconcile_ms); state.interval.unref?.();
        }
        const scope = await resolveInventory(state.context, saved.type);
        if (scope.status !== 'configured') {
          state.rootWatch?.close(); state.rootWatch = null;
          state.status = scope.status; state.error = { code: scope.status, message: scope.message }; return;
        }
        attach(state, scope);
        const result = await updateInventory(state.context, saved.type, saved);
        if (result.status === 'completed') {
          state.status = state.rootWatch ? 'watching' : 'polling';
          state.lastUpdate = new Date().toISOString(); state.count = result.count; state.manifest = result.manifest; state.error = null;
        } else { state.status = result.status; state.error = { code: result.status, message: result.message, ...(result.unavailable ? { unavailable: result.unavailable } : {}) }; }
      } catch (error) { state.status = 'error'; state.error = errorInfo(error); }
    })().finally(() => {
      state.running = null;
      if (state.dirty && !state.stopped && !closed) schedule(state);
    });
    return state.running;
  };
  const install = async (context, item) => {
    const key = keyFor(context, item.type), previous = active.get(key);
    if (previous) { dispose(previous); await previous.running; }
    const state = { key, context: { rab_home: memory.rabHome, project: { ...context.project } }, registration: item, status: 'starting', stopped: false, dirty: false };
    active.set(key, state);
    state.interval = setInterval(() => schedule(state), item.reconcile_ms); state.interval.unref?.();
    await refresh(state);
    return view(state);
  };
  const add = async (context, options) => {
    insist(!closed, 'LISTENER_CLOSED', 'Listener has been closed.');
    if(Array.isArray(options))return add(context,{paths:options});
    insist(record(options),'BAD_INPUT','Supply a named path or an array of path registrations.');
    if(options.paths!==undefined){
      insist(options.type===undefined&&Array.isArray(options.paths)&&options.paths.length>0&&options.paths.length<=256,'BAD_INPUT','Supply paths as a nonempty array, without a separate type.');
      const {paths:requested,...defaults}=options;
      const keys=new Set(),entries=[];
      for(const entry of requested){
        insist(typeof entry==='string'||record(entry),'BAD_INPUT','Each path needs a saved project path key or an object with type and conditions.');
        const selected={...defaults,...(typeof entry==='string'?{type:entry}:entry)};
        insist(Object.keys(selected).every(key=>['type','recursive','include','exclude','debounce_ms','reconcile_ms'].includes(key)),'BAD_INPUT','A path registration accepts type and listener conditions only.');
        insist(!Object.hasOwn(selected,'paths'),'BAD_INPUT','Nested path arrays are not supported.');
        registration(selected);
        insist(!keys.has(selected.type),'BAD_INPUT','Each named path may appear only once in the array.');
        keys.add(selected.type);entries.push(selected);
      }
      const saved=await readConfig(context);
      insist(new Set([...Object.keys(saved.paths),...keys]).size<=256,'LISTENER_LIMIT','This project supports at most 256 watched paths.');
      const unavailable=[];
      for(const entry of entries){const scope=await resolveInventory(context,entry.type);if(scope.status!=='configured')unavailable.push(scope);}
      if(unavailable.length)return {status:'unavailable',count:0,items:[],unavailable,message:'Some paths are unavailable; no registrations from this array were changed.'};
      const items=[];
      for(const entry of entries){
        const result=await add(context,entry);
        if(result.watch)items.push(result.watch);else unavailable.push(result);
      }
      return {status:unavailable.length?'partial':'registered',count:items.length,items,...(unavailable.length?{unavailable}:{})};
    }
    validateType(options.type);
    const scope = await resolveInventory(context, options.type);
    if (scope.status !== 'configured') return scope;
    const item = await saveConfig(context, async data => {
      const prior = data.paths[options.type];
      const entry = { id: prior?.id ?? await memory.allocateId(), ...registration(options, prior) };
      insist(prior || Object.keys(data.paths).length < 256, 'LISTENER_LIMIT', 'This project already has the maximum number of watched paths.');
      data.paths[options.type] = entry;
      return entry;
    });
    return { status: 'registered', watch: await install(context, item) };
  };
  const remove = async (context, { type }) => {
    validateType(type);
    const removed = await saveConfig(context, data => { const found = Object.hasOwn(data.paths, type); delete data.paths[type]; return found; });
    const state = active.get(keyFor(context, type));
    if (state) { dispose(state); await state.running; }
    return { status: removed ? 'removed' : 'not-found', type, removed };
  };
  const list = async context => {
    const saved = await readConfig(context);
    const items = Object.values(saved.paths).map(item => {
      const state = active.get(keyFor(context, item.type));
      return state ? view(state) : { ...item, status: 'stopped', project_id: context.project.id };
    });
    return { status: 'completed', count: items.length, items };
  };
  const restore = async () => {
    insist(!closed, 'LISTENER_CLOSED', 'Listener has been closed.');
    const projects = await memory.listProjects(), items = [], unavailable = [...projects.unavailable];
    for (const project of projects.items) {
      const context = { rab_home: memory.rabHome, project };
      try {
        for (const item of Object.values((await readConfig(context)).paths)) items.push(await install(context, item));
      } catch (error) { unavailable.push({ project_id: project.id, ...errorInfo(error) }); }
    }
    return { items, unavailable };
  };
  const close = async () => {
    closed = true;
    const states = [...active.values()]; states.forEach(dispose);
    await Promise.all(states.map(state => state.running));
  };
  return Object.freeze({ add, remove, list, restore, close, get closed() { return closed; } });
};

export const getProjectWatcher = ({ rabHome } = {}) => {
  const memory = createRabMemory({ rabHome });
  const key = process.platform === 'win32' ? memory.rabHome.toLowerCase() : memory.rabHome;
  if (!instances.has(key) || instances.get(key).closed) instances.set(key, createProjectWatcher({ rabHome: memory.rabHome }));
  return instances.get(key);
};

export const run = async ({ options, context, tool }) => {
  if (!context?.project?.root || !context.rab_home) throw Object.assign(new Error('Select a project first.'), { code: 'PROJECT_CONTEXT_REQUIRED' });
  const listener = getProjectWatcher({ rabHome: context.rab_home });
  const action = tool.key.split('/').at(-1);
  if (action === 'add') return listener.add(context, options);
  if (action === 'remove') return listener.remove(context, options);
  if (action === 'list') return listener.list(context);
  throw Object.assign(new Error('Unknown listener control.'), { code: 'BAD_TOOL' });
};

