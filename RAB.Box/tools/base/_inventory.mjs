import path from 'node:path';
import { readFile, readdir, lstat, writeFile, rename, unlink } from 'node:fs/promises';
import { withMemoryLock } from '../../bridge/rab-memory-lock.mjs';
import { createRabMemory } from '../../bridge/rab-memory.mjs';
import { makeItemSettings } from '../../bridge/rab-node.mjs';
import { pathValue } from '../../bridge/project-paths.mjs';
import { containedPath, insist, record } from '../../engine/src/core.mjs';

export const INVENTORY_VERSION = 'project-inventory/v3';
const excluded = new Set(['.git', '.rab', 'node_modules', 'template']);
const slash = value => value.split(path.sep).join('/');
const problem = (status, type, message, extra = {}) => ({ status, type, message, count: 0, items: [], ...extra });
const validateType = type => insist(typeof type === 'string' && /^[a-z][a-z0-9_-]{0,63}$/i.test(type) && !['constructor','prototype','__proto__'].includes(type), 'BAD_INPUT', 'Supply a named collection path key.');
const collectionItems = manifest => Object.values(manifest.items);
const itemRecord = (input, depth=0) => {
  insist(depth<=64,'INDEX_LIMIT','Item nesting exceeded the supported depth.');
  const item=makeItemSettings(input),children=item.items===undefined?{}:item.items;
  insist(record(children),'BAD_ITEM_SETTINGS','items must be an object keyed by record ID.');
  const items={};
  for(const [key,child] of Object.entries(children)){
    if(child?.indexed===false)continue;
    const value=itemRecord(child,depth+1);
    insist(key===String(value.id),'BAD_ITEM_SETTINGS','Each items key must match the contained record ID.');
    items[key]=value;
  }
  return {...item,items};
};
const json = async (file, max = 1024 * 1024) => {
  const info = await lstat(file);
  insist(info.isFile() && !info.isSymbolicLink() && info.size <= max, 'BAD_FILE', 'Expected a regular bounded JSON file: ' + file);
  return JSON.parse(await readFile(file, 'utf8'));
};

export const normalizeInventoryConditions = (input = {}) => {
  insist(record(input), 'BAD_INPUT', 'Index conditions must be an object.');
  const recursive = input.recursive === undefined ? true : input.recursive;
  insist(typeof recursive === 'boolean', 'BAD_INPUT', 'recursive must be boolean.');
  const patterns = (value, defaults, name) => {
    const result = value === undefined ? defaults : value;
    insist(Array.isArray(result) && result.length <= 100 && result.every(pattern => typeof pattern === 'string' && pattern.length > 0 && pattern.length <= 256 && !pattern.includes('\\') && !pattern.startsWith('/') && !pattern.split('/').includes('..')), 'BAD_INPUT', name + ' must be root-relative glob patterns using forward slashes.');
    return [...result];
  };
  return { recursive, include: patterns(input.include, ['**'], 'include'), exclude: patterns(input.exclude, [], 'exclude') };
};

// * stays within a path segment; ** crosses folders. Patterns are data, never code.
const glob = pattern => {
  let source = '^';
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    if (char === '*' && pattern[i + 1] === '*') {
      i++;
      if (pattern[i + 1] === '/') { i++; source += '(?:.*/)?'; }
      else source += '.*';
    } else if (char === '*') source += '[^/]*';
    else if (char === '?') source += '[^/]';
    else source += /[a-z0-9/_-]/i.test(char) ? char : '\\' + char;
  }
  return new RegExp(source + '$');
};

export const inventoryManifestPath = async (context, type) => {
  validateType(type);
  const memory = createRabMemory({ rabHome: context.rab_home });
  await memory.readProjectSettings(context.project);
  return containedPath(memory.rabHome, path.relative(memory.rabHome, path.join(memory.paths(context.project).project, 'manifests', type, 'manifest.json')), { allowMissing: true });
};

export const resolveInventory = async (context, type) => {
  validateType(type);
  insist(context?.project?.root, 'PROJECT_CONTEXT_REQUIRED', 'Select a project first.');
  const memory = createRabMemory({ rabHome: context.rab_home });
  const settings = await memory.readProjectSettings(context.project);
  const pathSettings = settings.paths?.[type];
  const configured = pathValue(pathSettings);
  if (configured===undefined || configured===null || configured==='') return problem('path-required', type, 'No ' + type + ' path is configured. Do you want to add a new path?');
  insist(typeof configured==='string'&&configured.trim(),'BAD_INPUT','A collection path must be a nonempty folder path.');
  const title=record(pathSettings)&&pathSettings.title!==undefined?pathSettings.title:type.replaceAll('_',' ').replaceAll('-',' ').replace(/^./,letter=>letter.toUpperCase());
  const description=record(pathSettings)&&pathSettings.description!==undefined?pathSettings.description:'';
  const file = await inventoryManifestPath(context, type);
  try {
    const root = await containedPath(context.project.root, configured);
    insist((await lstat(root)).isDirectory(), 'INVALID_PATH', 'An inventory path must be a directory.');
    return { status: 'configured', type, title, description, path: configured, root, file, settings_file: path.join(memory.paths(context.project).project, 'settings.json') };
  } catch (error) {
    if (['ENOENT','ENOTDIR'].includes(error.code)) return problem('path-unavailable', type, 'Path unavailable: ' + configured, { path: configured, file });
    throw error;
  }
};

const priorManifest = async (file, type) => {
  let manifest;
  try { manifest = await json(file, 16 * 1024 * 1024); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  if (manifest.meta?.version !== INVENTORY_VERSION) return problem('migration-required', type, 'This saved manifest uses an older contract. An explicit backed-up rebuild is required; the original was left untouched.', { file });
  makeItemSettings(manifest);
  insist(manifest.meta.collection===type&&manifest.name===type&&record(manifest.items)&&manifest.meta.count===Object.keys(manifest.items).length,'BAD_MANIFEST','Manifest identity or items are invalid.');
  const ids = new Set();
  for (const [key,item] of Object.entries(manifest.items)) {
    itemRecord(item);
    insist(key===String(item.id)&&typeof item.path === 'string' && !ids.has(item.id), 'BAD_MANIFEST', 'Collection keys must match their record IDs, with valid unique paths and IDs.');
    ids.add(item.id);
  }
  return manifest;
};

export const readInventory = async (context, type, { query } = {}) => {
  const scope = await resolveInventory(context, type);
  if (scope.status !== 'configured') return scope;
  const manifest = await priorManifest(scope.file, type);
  if (manifest?.status) return manifest;
  if (!manifest || manifest.meta.path !== scope.path) return problem('not-indexed', type, 'The ' + type + ' path has no current manifest. Add it to the listener to index it.', { manifest: scope.file, path: scope.path });
  insist(query === undefined || typeof query === 'string', 'BAD_INPUT', 'Search text must be a string.');
  const words = (query ?? '').toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const items = collectionItems(manifest).filter(item => {
    const text = JSON.stringify(item).toLocaleLowerCase();
    return words.every(word => text.includes(word));
  });
  return { status: 'completed', id:manifest.id, name:manifest.name, title:manifest.title, description:manifest.description, type, count: items.length, items, index_status: 'current', manifest: scope.file, scanned_at: manifest.meta.scanned_at };
};

export const inspectInventory = async (context, type, input = {}) => {
  const conditions = normalizeInventoryConditions(input);
  const scope = await resolveInventory(context, type);
  if (scope.status !== 'configured') return scope;
  const prior = await priorManifest(scope.file, type);
  if (prior?.status) return prior;
  const includes = conditions.include.map(glob), excludes = conditions.exclude.map(glob);
  const items = [], unavailable = [], identities = new Map();
  const memory = createRabMemory({ rabHome: context.rab_home });
  const manifestRoot = path.join(memory.paths(context.project).project, 'manifests');
  let visited = 0;
  const walk = async (relative = '.', depth = 0) => {
    insist(depth <= 64 && ++visited <= 20000, 'INDEX_LIMIT', 'Inventory exceeded its folder or depth limit.');
    const absolute = await containedPath(scope.root, relative);
    let descriptor;
    const selected = includes.some(re => re.test(relative)) && !excludes.some(re => re.test(relative));
    if (selected) {
      try { descriptor = await json(path.join(absolute, 'settings.json')); }
      catch (error) {
        if (error.code !== 'ENOENT') unavailable.push({ path: slash(path.relative(context.project.root, absolute)) || '.', code: error.code ?? 'BAD_ITEM_SETTINGS', message: error.message });
      }
    }
    if (descriptor !== undefined && descriptor?.indexed !== false) {
      try {
        const item = itemRecord(descriptor);
        const locator = slash(path.relative(context.project.root, absolute)) || '.';
        insist(!identities.has(item.id), 'DUPLICATE_ITEM_ID', 'ID ' + item.id + ' is shared by ' + identities.get(item.id) + ' and ' + locator + '.');
        identities.set(item.id, locator);
        items.push({ ...item, path: locator, kind: 'folder' });
      } catch (error) { unavailable.push({ path: relative, code: error.code ?? 'BAD_ITEM_SETTINGS', message: error.message }); }
    }
    if (!conditions.recursive && depth >= 1) return;
    const entries = await readdir(absolute, { withFileTypes: true });
    visited += entries.length;
    insist(visited <= 20000, 'INDEX_LIMIT', 'Inventory exceeded its entry limit.');
    for (const entry of entries.sort((a,b) => a.name.localeCompare(b.name))) {
      if (!entry.isDirectory() || entry.isSymbolicLink() || excluded.has(entry.name.toLowerCase())) continue;
      const child = path.join(absolute, entry.name);
      if (path.relative(manifestRoot, child) === '') continue;
      await walk(slash(path.relative(scope.root, child)), depth + 1);
    }
  };
  try { await walk(); }
  catch (error) { unavailable.push({ path: scope.path, code: error.code ?? 'SCAN_FAILED', message: error.message }); }
  if (unavailable.length) return problem('unavailable', type, 'Settings could not be indexed completely; the previous manifest was preserved.', { unavailable, file: scope.file });
  const snapshot = { path: scope.path, title:scope.title, description:scope.description, conditions, items };
  const priorSnapshot = prior ? { path: prior.meta.path, title:prior.title, description:prior.description, conditions: prior.meta.conditions, items: collectionItems(prior) } : null;
  return { ...scope, ...(prior?{id:prior.id}:{}), status: !prior ? 'not-indexed' : JSON.stringify(snapshot) === JSON.stringify(priorSnapshot) ? 'current' : 'stale', conditions, items, count: items.length };
};

export const updateInventory = async (context, type, conditions = {}) => {
  const file = await inventoryManifestPath(context, type);
  return withMemoryLock(path.join(path.dirname(file), '.inventory-lock'), async () => {
    const scan = await inspectInventory(context, type, conditions);
    if (!['not-indexed','current','stale'].includes(scan.status)) return scan;
    if (scan.status === 'current') return { ...scan, status: 'completed', index_status: 'current', manifest: file };
    const memory=createRabMemory({rabHome:context.rab_home});
    const manifest=makeItemSettings({id:scan.id??await memory.allocateId(),name:type,title:scan.title,description:scan.description,settings:[],meta:{kind:'manifest',version:INVENTORY_VERSION,collection:type,project_id:context.project.id,path:scan.path,conditions:scan.conditions,scanned_at:new Date().toISOString(),count:scan.items.length},items:Object.fromEntries(scan.items.map(item=>[String(item.id),item]))});
    // Serialized by the inventory lock; this fixed temporary name is not an ID.
    const temporary = path.join(path.dirname(file), 'manifest.json.tmp');
    const serialized = JSON.stringify(manifest, null, 2) + '\n';
    insist(Buffer.byteLength(serialized) <= 16 * 1024 * 1024, 'INDEX_LIMIT', 'Inventory exceeds the saved manifest size limit.');
    try {
      await writeFile(temporary, serialized, { flag: 'w' });
      await rename(temporary, file);
    } finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
    return { status: 'completed', id:manifest.id, name:manifest.name, title:manifest.title, description:manifest.description, type, count: scan.items.length, items: scan.items, index_status: scan.status, manifest: file };
  });
};

