import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdir, mkdtemp, readFile, writeFile, rename, rm, readdir } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { createRabMemory } from '../bridge/rab-memory.mjs';
import { makeItemSettings } from '../bridge/rab-node.mjs';
import { createProjectWatcher, getProjectWatcher } from '../tools/base/watch/watch.mjs';
import { inventoryManifestPath, readInventory, updateInventory } from '../tools/base/_inventory.mjs';
import { createToolHouse } from '../bridge/tool-house.mjs';
import { startServer } from '../server.mjs';
import { controlWatcher } from '../scripts/watcher.mjs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = file => readFile(file, 'utf8').then(JSON.parse);
const put = (file, value) => writeFile(file, JSON.stringify(value, null, 2) + '\n');
const fixture = async (paths = { components: 'src/components', pages: 'src/pages' }) => {
  const parent = path.join(os.homedir(), '.rab', 'temp', 'test');
  await mkdir(parent, { recursive: true });
  const temp = await mkdtemp(path.join(parent, 'project-listener-'));
  const source = path.join(temp, 'source'), memory = createRabMemory({ rabHome: path.join(temp, 'memory') });
  for (const folder of Object.values(paths)) await mkdir(path.join(source, folder), { recursive: true });
  const project = { id: await memory.allocateId(), name: 'Listener fixture', root: source };
  await put(path.join(source, 'settings.json'), { id: project.id, name: project.name, type: 'base', paths });
  await memory.registerProject(project);
  const context = { project, rab_home: memory.rabHome };
  const item = async (relative, extras = {}) => {
    const folder = path.join(source, relative); await mkdir(folder, { recursive: true });
    const descriptor = makeItemSettings({ id: await memory.allocateId(), name: path.basename(relative), title: path.basename(relative), description: '', settings: [], meta: {}, ...extras });
    await put(path.join(folder, 'settings.json'), descriptor);
    return descriptor;
  };
  return { temp, source, memory, context, item };
};
const until = async (operation, check, label) => {
  let result, error;
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    try { result = await operation(); if (check(result)) return result; } catch (caught) { error = caught; }
    await delay(30);
  }
  assert.fail(label + ': ' + JSON.stringify(result ?? { error: error?.message }));
};

test('start/stop/restart commands control the server watcher without losing registrations', async t => {
  const f = await fixture();
  await f.item('src/components/Card');
  const initial = createProjectWatcher({ rabHome: f.memory.rabHome });
  const first = await initial.add(f.context, { type: 'components', debounce_ms: 0, reconcile_ms: 250 });
  await initial.close();
  const appRoot = path.join(f.temp, 'control-app');
  for (const folder of ['tools/base/watch', 'language']) await mkdir(path.join(appRoot, folder), { recursive: true });
  for (const action of ['start', 'stop', 'restart']) {
    const dir = path.join(appRoot, 'tools/base/watch', action);
    await mkdir(dir);
    await writeFile(path.join(dir, 'settings.json'), await readFile(path.join(root, 'tools/base/watch', action, 'settings.json')));
    await writeFile(path.join(dir, action + '.mjs'), 'export {run} from ' + JSON.stringify(pathToFileURL(path.join(root, 'tools/base/watch', action, action + '.mjs')).href) + ';\n');
  }
  await put(path.join(appRoot, 'HOST.json'), { project: 'not-selected', runs: 'runs', interface: 'index.html', language: 'language' });
  await writeFile(path.join(appRoot, 'index.html'), '<!doctype html><title>Watcher controls</title>');
  const app = await startServer({ root: appRoot, port: 0, rabHome: f.memory.rabHome });
  t.after(() => app.close());
  const listener = getProjectWatcher({ rabHome: f.memory.rabHome });
  const invoke = async action => {
    if (process.platform !== 'win32') return controlWatcher(action, app.origin);
    const { stdout } = await promisify(execFile)('cmd.exe', ['/d', '/c', path.join(root, 'tools/base/watch', action.toUpperCase() + '.cmd'), app.origin], { windowsHide: true });
    return JSON.parse(stdout);
  };
  const manifest = await inventoryManifestPath(f.context, 'components');
  const saved = path.join(f.memory.paths(f.context.project).project, 'listener.json');
  const beforeRegistration = await readFile(saved, 'utf8');
  assert.equal((await invoke('stop')).status, 'stopped');
  assert.equal(listener.stopped, true);
  const frozen = await readFile(manifest, 'utf8');
  await f.item('src/components/WhileStopped');
  await delay(350);
  assert.equal(await readFile(manifest, 'utf8'), frozen);
  assert.equal(await readFile(saved, 'utf8'), beforeRegistration);
  assert.equal((await listener.add(f.context, { type: 'pages' })).watch.status, 'stopped');
  assert.equal((await invoke('start')).status, 'started');
  assert.equal((await read(manifest)).meta.count, 2);
  assert.equal((await listener.list(f.context)).items.find(item => item.type === 'components').id, first.watch.id);
  assert.equal((await invoke('restart')).action, 'restart');
  assert.equal((await invoke('start')).count, 2);
  assert.equal(getProjectWatcher({ rabHome: f.memory.rabHome }), listener);
  await Promise.all([controlWatcher('restart', app.origin), controlWatcher('stop', app.origin)]);
  // Final explicit stop establishes an observable quiescent state.
  await controlWatcher('stop', app.origin);
  assert.equal((await listener.list(f.context)).items.every(item => item.status === 'stopped'), true);
  await assert.rejects(controlWatcher('invalid', app.origin), /Usage/);
});

test('all roots index the same source descriptor, preserve IDs, honor false and never invent identities', async () => {
  const f = await fixture();
  const card = await f.item('src/components/Card', { description: 'Blue card', zero: 0, empty: '', flag: false });
  const page = await f.item('src/pages/Home', { meta: { kind: 'page', platform: 'html' } });
  await mkdir(path.join(f.source, 'src/components/bare'), { recursive: true });
  const result = await updateInventory(f.context, 'components');
  assert.equal(result.status, 'completed'); assert.equal(result.count, 1);
  const firstManifest=await read(result.manifest);
  assert.equal(firstManifest.name,'components');assert.ok(Number.isSafeInteger(firstManifest.id));
  assert.equal(Array.isArray(firstManifest.items),false);assert.equal(firstManifest.items[card.id].id,card.id);
  assert.deepEqual(firstManifest.items[card.id].items,{});
  assert.equal(result.items[0].id, card.id); assert.equal(result.items[0].zero, 0); assert.equal(result.items[0].flag, false); assert.equal(result.items[0].empty, '');
  assert.equal((await updateInventory(f.context, 'pages')).items[0].id, page.id);
  const sourceFile = path.join(f.source, 'src/components/Card/settings.json');
  await put(sourceFile, { ...card, indexed: false });
  assert.equal((await updateInventory(f.context, 'components')).count, 0);
  await put(sourceFile, { ...card, indexed: true, description: 'Changed settings' });
  await rename(path.dirname(sourceFile), path.join(f.source, 'src/components/Renamed'));
  const changed = await updateInventory(f.context, 'components');
  assert.equal((await read(changed.manifest)).id,firstManifest.id);
  assert.equal(changed.items[0].id, card.id); assert.equal(changed.items[0].description, 'Changed settings');
  assert.equal(changed.items[0].path, 'src/components/Renamed');
  assert.equal((await readInventory(f.context, 'components', { query: 'changed' })).count, 1);
  assert.equal((await readInventory(f.context, 'components', { query: 'missing' })).count, 0);
  const before = await readFile(changed.manifest, 'utf8');
  await writeFile(path.join(f.source, 'src/components/Renamed/settings.json'), '{');
  assert.equal((await updateInventory(f.context, 'components')).status, 'unavailable');
  assert.equal(await readFile(changed.manifest, 'utf8'), before);
  // Lookup stays manifest-only even when source descriptor bytes are malformed.
  assert.equal((await readInventory(f.context, 'components')).items[0].id, card.id);
  await put(path.join(f.source, 'src/components/Renamed/settings.json'), card);
  await f.item('src/components/Duplicate', { id: card.id });
  const duplicate = await updateInventory(f.context, 'components');
  assert.equal(duplicate.status, 'unavailable'); assert.equal(duplicate.unavailable[0].code, 'DUPLICATE_ITEM_ID');
  assert.equal(await readFile(changed.manifest, 'utf8'), before);
  const old = { version: 'project-inventory/v1', type: 'pages', items: [] };
  const oldFile = await inventoryManifestPath(f.context, 'pages'); await put(oldFile, old);
  assert.equal((await updateInventory(f.context, 'pages')).status, 'migration-required'); assert.deepEqual(await read(oldFile), old);
  assert.equal((await readInventory(f.context, 'widgets')).status, 'path-required');
  await put(oldFile,{version:'project-inventory/v2',type:'pages',items:[]});
  assert.equal((await updateInventory(f.context,'pages')).status,'migration-required');
});

test('real listener updates multiple paths, re-enables ignored items, preserves conditions and stops on removal', async t => {
  const f = await fixture(), watcher = createProjectWatcher({ rabHome: f.memory.rabHome });
  t.after(() => watcher.close());
  const card = await f.item('src/components/Card');
  await f.item('src/pages/Home');
  const first = await watcher.add(f.context, { type: 'components', debounce_ms: 0, reconcile_ms: 250 });
  await watcher.add(f.context, { type: 'pages', include: ['Home'], debounce_ms: 0, reconcile_ms: 250 });
  assert.equal(first.watch.status, 'watching'); assert.equal(first.watch.debounce_ms, 0);
  assert.equal((await watcher.list(f.context)).count, 2);
  const componentsFile = await inventoryManifestPath(f.context, 'components');
  const pagesFile = await inventoryManifestPath(f.context, 'pages');
  const button = await f.item('src/components/Button');
  await until(() => read(componentsFile), value => Object.values(value.items).some(item => item.id === button.id), 'addition');
  const cardFile = path.join(f.source, 'src/components/Card/settings.json');
  await put(cardFile, { ...card, indexed: false });
  await until(() => read(componentsFile), value => value.meta.count === 1, 'opt out');
  await put(cardFile, { ...card, indexed: true, title: 'Updated Card' });
  await until(() => read(componentsFile), value => Object.values(value.items).some(item => item.title === 'Updated Card'), 'opt in and edit');
  await f.item('src/pages/Hidden'); await delay(400);
  assert.equal((await read(pagesFile)).meta.count, 1);
  const repeat = await watcher.add(f.context, { type: 'components' });
  assert.equal(repeat.watch.id, first.watch.id); assert.equal(repeat.watch.debounce_ms, 0); assert.equal(repeat.watch.reconcile_ms, 250);
  const removedFolder = path.join(f.source, 'src/components/Button');
  assert.ok(removedFolder.startsWith(f.temp + path.sep)); await rm(removedFolder, { recursive: true });
  await until(() => read(componentsFile), value => value.meta.count === 1, 'deletion');
  await watcher.remove(f.context, { type: 'components' });
  const frozen = await readFile(componentsFile, 'utf8');
  await f.item('src/components/AfterStop'); await delay(500);
  assert.equal(await readFile(componentsFile, 'utf8'), frozen);
  assert.equal((await watcher.list(f.context)).count, 1);
});

test('saved registrations restore and reconciliation recovers without native watch events', async t => {
  const f = await fixture(); await f.item('src/components/Card');
  const noEvents = () => { throw Object.assign(new Error('fixture watch unavailable'), { code: 'WATCH_UNAVAILABLE' }); };
  const first = createProjectWatcher({ rabHome: f.memory.rabHome, watchFactory: noEvents });
  t.after(() => first.close());
  const added = await first.add(f.context, { type: 'components', reconcile_ms: 250, debounce_ms: 0 });
  assert.equal(added.watch.status, 'polling'); assert.equal(added.watch.watch_error.code, 'WATCH_UNAVAILABLE');
  await first.close();
  const second = createProjectWatcher({ rabHome: f.memory.rabHome, watchFactory: noEvents });
  t.after(() => second.close());
  const restored = await second.restore(); assert.equal(restored.items.length, 1); assert.equal(restored.unavailable.length, 0);
  const file = await inventoryManifestPath(f.context, 'components');
  await f.item('src/components/Later');
  await until(() => read(file), value => value.meta.count === 2, 'reconcile missed event');
  await f.memory.setProjectPath(f.context.project, 'components', 'replacement');
  await f.item('replacement/NewRoot');
  await until(() => read(file), value => value.meta.path === 'replacement' && value.meta.count === 1, 'saved root change');
  await rename(path.join(f.source, 'replacement'), path.join(f.source, 'disconnected'));
  await until(() => second.list(f.context), value => value.items[0].status === 'path-unavailable', 'missing root status');
  assert.equal((await read(file)).meta.count, 1);
  await rename(path.join(f.source, 'disconnected'), path.join(f.source, 'replacement'));
  await until(() => second.list(f.context), value => value.items[0].status === 'polling', 'reconnect');
});

test('condition checks, containment, discovery and shared runner controls', async t => {
  const f = await fixture();
  await f.item('src/components/Top'); await f.item('src/components/Top/Nested');
  assert.equal((await updateInventory(f.context, 'components', { recursive: false })).count, 1);
  assert.equal((await updateInventory(f.context, 'components', { include: [] })).count, 0);
  assert.equal((await updateInventory(f.context, 'components', { include: ['**'], exclude: ['Top'] })).count, 1);
  await assert.rejects(updateInventory(f.context, 'components', { recursive: 'false' }), { code: 'BAD_INPUT' });
  await assert.rejects(updateInventory(f.context, 'components', { include: ['../escape'] }), { code: 'BAD_INPUT' });
  await f.memory.setProjectPath(f.context.project, 'outside', '../outside');
  await assert.rejects(updateInventory(f.context, 'outside'), { code: 'INVALID_PATH' });
  const listener = getProjectWatcher({ rabHome: f.memory.rabHome }); t.after(() => listener.close());
  // Discover the real control definitions in an isolated catalog; don't repeat
  // a whole network toolkit walk for each runner assertion.
  const catalog = path.join(f.temp, 'catalog'), controls = path.join(catalog, 'tools/base/watch');
  await mkdir(controls, { recursive: true });
  await writeFile(path.join(controls, 'watch.mjs'), 'export { run } from ' + JSON.stringify(pathToFileURL(path.join(root, 'tools/base/watch/watch.mjs')).href) + ';\n');
  for (const name of ['add','remove','list']) {
    await mkdir(path.join(controls, name));
    await writeFile(path.join(controls, name, 'settings.json'), await readFile(path.join(root, 'tools/base/watch', name, 'settings.json')));
  }
  const house = createToolHouse({ root: catalog });
  for (const name of ['add','remove','list']) {
    const tool = await house.getTool('base/watch/' + name);
    assert.equal(tool.inheritedExecutor, true); assert.ok(tool.id > 0);
  }
  const run = await house.runTool({ key: 'base/watch/add', options: { paths:['components'], reconcile_ms: 250 }, context: f.context });
  assert.equal(run.result.status, 'registered');
  const listing = await house.runTool({ key: 'base/watch/list', context: f.context });
  assert.equal(listing.result.count, 1);
  const many=await house.runTool({key:'base/watch/add',options:{paths:['components',{type:'pages',include:[],recursive:false}],debounce_ms:0,reconcile_ms:250},context:f.context});
  assert.equal(many.result.count,2);assert.equal(many.result.items[0].id,run.result.items[0].id);
  assert.equal(many.result.items[1].recursive,false);assert.deepEqual(many.result.items[1].include,[]);
  assert.equal((await house.runTool({ key: 'base/watch/remove', options: { type: 'components' }, context: f.context })).result.removed, true);
  assert.equal((await readdir(path.join(f.memory.paths(f.context.project).project, 'manifests'))).includes('components'), true);
  const disabledFile = path.join(controls, 'add/settings.json'), definition = await read(disabledFile);
  await put(disabledFile, { ...definition, indexed: false });
  assert.equal((await house.listTools({ fresh: true })).items.some(tool => tool.key === 'base/watch/add'), false);
  await put(disabledFile, { ...definition, indexed: true });
  assert.equal((await house.listTools({ fresh: true })).items.find(tool => tool.key === 'base/watch/add').id, definition.id);
  const override=path.join(f.source,'tools/base/watch/add');await mkdir(override,{recursive:true});
  await put(path.join(override,'settings.json'),{...definition,indexed:false});
  await writeFile(path.join(override,'add.mjs'),'export {run} from '+JSON.stringify(pathToFileURL(path.join(root,'tools/base/watch/watch.mjs')).href)+';\n');
  await put(path.join(f.source,'PATHS.json'),{project:f.context.project,tools:{'local-watch':{id:definition.id,path:'tools/base/watch/add'}},stamps:{}});
  await assert.rejects(house.getTool('local-watch',{context:f.context}),{code:'TOOL_NOT_FOUND'});
});

test('Box startup restores saved registrations and server shutdown closes the listener', async t => {
  const f = await fixture(); await f.item('src/components/Card');
  const first = createProjectWatcher({ rabHome: f.memory.rabHome });
  await first.add(f.context, { type: 'components', debounce_ms: 0, reconcile_ms: 250 }); await first.close();
  const appRoot = path.join(f.temp, 'app');
  for (const folder of ['tools','language']) await mkdir(path.join(appRoot, folder), { recursive: true });
  await put(path.join(appRoot, 'HOST.json'), { project: 'project', runs: 'runs', interface: 'index.html', language: 'language' });
  await writeFile(path.join(appRoot, 'index.html'), '<!doctype html><title>Listener fixture</title>');
  const app = await startServer({ root: appRoot, port: 0, rabHome: f.memory.rabHome });
  t.after(async () => { if (app.server.listening) await app.close(); });
  const listener = getProjectWatcher({ rabHome: f.memory.rabHome });
  assert.equal((await listener.list(f.context)).count, 1);
  await f.item('src/components/Running');
  const file = await inventoryManifestPath(f.context, 'components');
  await until(() => read(file), manifest => manifest.meta.count === 2, 'restored live listener');
  await app.close(); assert.equal(listener.closed, true);
  const frozen = await readFile(file, 'utf8'); await f.item('src/components/AfterShutdown'); await delay(400);
  assert.equal(await readFile(file, 'utf8'), frozen);
});


test('unregistered callers write only the canonical named project storage', async t => {
  const parent = path.join(os.homedir(), '.rab', 'temp', 'test');
  await mkdir(parent, { recursive: true });
  const temp = await mkdtemp(path.join(parent, 'listener-registration-'));
  const source = path.join(temp, 'source'); await mkdir(path.join(source, 'items'), { recursive: true });
  const memory = createRabMemory({ rabHome: path.join(temp, 'memory') });
  const project = { id: await memory.allocateId(), name: 'Named storage', root: source };
  await put(path.join(source, 'settings.json'), { id: project.id, name: project.name, type: 'base', paths: { items: 'items' } });
  const context = { rab_home: memory.rabHome, project };
  const indexed = await updateInventory(context, 'items');
  assert.equal(indexed.status, 'completed');
  assert.equal(indexed.manifest, path.join(memory.paths(project).project, 'manifests', 'items', 'manifest.json'));
  assert.equal(path.basename(memory.paths(project).project), project.name);
  assert.deepEqual(await readdir(path.join(memory.rabHome, 'projects')), [project.name]);
  const secondMemory = createRabMemory({ rabHome: path.join(temp, 'second-memory') });
  const watcher = createProjectWatcher({ rabHome: secondMemory.rabHome }); t.after(() => watcher.close());
  await watcher.remove({ project, rab_home: secondMemory.rabHome }, { type: 'items' });
  assert.deepEqual(await readdir(path.join(secondMemory.rabHome, 'projects')), [project.name]);
});

test('one path array writes the same recursive items shape to independent manifest locations',async t=>{
  const f=await fixture(),watcher=createProjectWatcher({rabHome:f.memory.rabHome});t.after(()=>watcher.close());
  const nested=makeItemSettings({id:await f.memory.allocateId(),name:'Action',title:'Action',description:'Nested action',settings:[],meta:{}});
  const card=await f.item('src/components/Card',{items:{[nested.id]:nested}}),page=await f.item('src/pages/Home',{meta:{platform:'html'}});
  const run=await watcher.add(f.context,['components',{type:'pages',include:['Home'],debounce_ms:0}]);
  assert.equal(run.status,'registered');assert.equal(run.count,2);
  const [components,pages]=await Promise.all(['components','pages'].map(async key=>read(await inventoryManifestPath(f.context,key))));
  assert.deepEqual(Object.keys(components).sort(),Object.keys(pages).sort());
  assert.deepEqual(Object.keys(components.items[card.id]).sort(),Object.keys(pages.items[page.id]).sort());
  assert.equal(components.name,'components');assert.equal(pages.name,'pages');assert.notEqual(components.id,pages.id);
  assert.equal(components.items[card.id].id,card.id);assert.equal(pages.items[page.id].id,page.id);
  assert.equal(components.items[card.id].items[nested.id].id,nested.id);
  assert.deepEqual(components.items[card.id].items[nested.id].items,{});
  assert.equal(Object.hasOwn(components,'components'),false);assert.equal(Object.hasOwn(pages,'pages'),false);
  const savedBefore=await readFile(path.join(f.memory.paths(f.context.project).project,'listener.json'),'utf8');
  await assert.rejects(watcher.add(f.context,{paths:['components','components']}),{code:'BAD_INPUT'});
  await assert.rejects(watcher.add(f.context,{paths:[{type:'components',recursive:'false'}]}),{code:'BAD_INPUT'});
  assert.equal((await watcher.add(f.context,{paths:['components','missing']})).status,'unavailable');
  assert.equal(await readFile(path.join(f.memory.paths(f.context.project).project,'listener.json'),'utf8'),savedBefore);
});


