import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdir, mkdtemp, readFile, writeFile, cp, unlink, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRabMemory } from '../bridge/rab-memory.mjs';
import { createToolHouse } from '../bridge/tool-house.mjs';
import { makeItemSettings } from '../bridge/rab-node.mjs';
import { prepareComponentInputs } from '../tools/react/_component-inputs.mjs';
import { runDomEdit } from '../tools/react/_dom-edit.mjs';
import { inventoryManifestPath, updateInventory } from '../tools/base/_inventory.mjs';

const box = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const toolkit = path.join(path.dirname(box), 'RAB.Toolkits/react');
const json = file => readFile(file, 'utf8').then(JSON.parse);
const put = (file, value) => writeFile(file, JSON.stringify(value, null, 2) + '\n');
const missing = async file => assert.rejects(access(file), { code: 'ENOENT' });
const fixture = async (paths = { components: 'src/components', 'container-atoms': 'src/container-atoms', 'action-atoms': 'src/action-atoms' }) => {
  const parent = path.join(os.homedir(), '.rab/temp/test'); await mkdir(parent, { recursive: true });
  const temp = await mkdtemp(path.join(parent, 'component-inputs-'));
  const source = path.join(temp, 'source'), memory = createRabMemory({ rabHome: path.join(temp, 'memory') });
  for (const value of Object.values(paths)) await mkdir(path.join(source, value), { recursive: true });
  const project = { id: await memory.allocateId(), name: 'Component fixture', root: source };
  await put(path.join(source, 'settings.json'), { id: project.id, name: project.name, type: 'react', paths });
  await memory.registerProject(project);
  const context = { project, rab_home: memory.rabHome };
  const item = async (relative, extras = {}) => {
    const folder = path.join(source, relative); await mkdir(folder, { recursive: true });
    const data = makeItemSettings({ id: await memory.allocateId(), name: path.basename(relative), title: path.basename(relative), description: '', settings: [], meta: { kind: 'atom' }, ...extras });
    await put(path.join(folder, 'settings.json'), data); return data;
  };
  const catalog = path.join(temp, 'catalog');
  const tools = ['react/add/new/component', 'react/add/sub/component', ...['container-atom','action-atom','grid-atom','effect-atom'].map(kind => 'react/css/add/new/' + kind)];
  for (const key of tools) {
    const from = path.join(toolkit, 'tools', key), to = path.join(catalog, 'tools', key);
    await mkdir(to, { recursive: true });
    await cp(path.join(from, 'settings.json'), path.join(to, 'settings.json'));
    await cp(path.join(from, 'template'), path.join(to, 'template'), { recursive: true });
    const owner = key.includes('/css/') ? path.join(toolkit, 'tools/react/css/add/new/new.mjs') : path.join(from, 'component.mjs');
    await writeFile(path.join(to, path.basename(key) + '.mjs'), 'export {run} from ' + JSON.stringify(pathToFileURL(owner).href) + ';\n');
  }
  const house = createToolHouse({ root: catalog });
  const helpers = { listTools: () => house.listTools({ context }), getTool: key => house.getTool(key, { context }), bindSettings: house.bindSettings };
  const prepare = options => prepareComponentInputs({ options, context, helpers });
  const run = options => house.runTool({ key: 'react/add/new/component', options: { name: 'Card', location: path.join(source, paths.components), ...options }, context });
  return { temp, source, memory, context, item, catalog, house, helpers, prepare, run };
};

test('class preflight reads the manifest first and only inspects the configured saved root when it is absent', async () => {
  const f = await fixture();
  const item = await f.item('src/container-atoms/container-main');
  const first = await f.prepare({ class_name: item.name });
  assert.deepEqual(first.questions, []); assert.equal(first.resolvedOptions.class_name, item.name);
  await missing(await inventoryManifestPath(f.context, 'container-atoms'));
  await updateInventory(f.context, 'container-atoms');
  // A manifest hit must not enumerate/read source item descriptors again.
  await writeFile(path.join(f.source, 'src/container-atoms/container-main/settings.json'), '{broken');
  assert.deepEqual((await f.prepare({ class_name: item.name })).questions, []);
  await unlink(await inventoryManifestPath(f.context, 'container-atoms'));
  await assert.rejects(f.prepare({ class_name: item.name }), { code: 'ATOM_INDEX_UNAVAILABLE' });
});

test('missing classes ask create then a real class-producing kind; no skips class metadata', async () => {
  const f = await fixture();
  const request = await f.prepare({ class_name: 'container-new' });
  assert.equal(request.questions[0].name, 'atom:container-new:create');
  assert.equal(request.questions[0].type, 'boolean');
  assert.deepEqual(request.dependencies, []);
  const kind = await f.prepare({ class_name: 'container-new', atom_decisions: { 'container-new': { create: true } } });
  assert.deepEqual(kind.questions[0].enum.sort(), ['action-atom','container-atom']);
  const skipped = await f.run({ class_name: 'container-new', atom_decisions: { 'container-new': { create: false } }, grid: 'none' });
  assert.equal(Object.hasOwn(skipped.result.settings, 'class'), false);
  const source = await readFile(skipped.result.file, 'utf8');
  assert.ok(source.includes('["", className].filter(Boolean)'));
  assert.equal(source.includes('data-grid='), false); assert.equal(source.includes('undefined'), false);
  await missing(path.join(f.source, 'src/container-atoms/container-new'));
});

test('all dependency choices and child required fields are complete before any creation', async () => {
  const f = await fixture();
  const options = { class_name: 'container-one container-two', atom_decisions: { 'container-one': { create: true, kind: 'container-atom' } } };
  await assert.rejects(f.run(options), error => error.code === 'INPUT_REQUIRED' && error.details.missing[0].name === 'atom:container-two:create');
  await missing(path.join(f.source, 'src/container-atoms/container-one'));
  await missing(path.join(f.source, 'src/components/Card'));
  await f.item('src/container-atoms/container-two', { indexed: false });
  await assert.rejects(f.run({ ...options, atom_decisions: { ...options.atom_decisions, 'container-two': { create: true, kind: 'container-atom' } } }), { code: 'EEXIST' });
  await missing(path.join(f.source, 'src/container-atoms/container-one'));
  const definition = path.join(f.catalog, 'tools/react/css/add/new/container-atom/settings.json'), tool = await json(definition);
  tool.settings.push({ name: 'theme', type: 'options', title: 'Theme', required: true, enum: ['light','dark'] });
  await put(definition, tool); await f.house.listTools({ fresh: true, context: f.context });
  const prepared = await f.prepare({ class_name: 'container-one', atom_decisions: options.atom_decisions });
  assert.equal(prepared.questions[0].name, 'atom:container-one:theme');
  assert.deepEqual(prepared.questions[0].enum, ['light','dark']);
  assert.deepEqual(prepared.dependencies, []);
  await missing(path.join(f.source, 'src/container-atoms/container-one'));
});

test('shared runner creates the chosen atom then a verified grid component with final component seats', async () => {
  const f = await fixture();
  const result = await f.run({ grid: 'header-main', class_name: 'container-main', atom_decisions: { 'container-main': { create: true, kind: 'container-atom', options: { styles: 'background: var(--surface);' } } } });
  const component = result.result, atom = await json(path.join(f.source, 'src/container-atoms/container-main/settings.json'));
  assert.equal(atom.kind, 'container-atom'); assert.ok(Number.isSafeInteger(atom.id));
  assert.ok((await readFile(path.join(f.source, 'src/container-atoms/container-main/container-main.css'), 'utf8')).includes('background: var(--surface);'));
  assert.equal(component.settings.class, 'container-main'); assert.equal(component.settings.grid, 'header-main');
  assert.deepEqual(component.areas, ['header','main']);
  const source = await readFile(component.file, 'utf8');
  assert.ok(source.includes('data-grid="header-main"')); assert.ok(source.includes('data-area="header"')); assert.ok(source.includes('data-area="main"'));
  assert.ok(source.includes('data-rab-seat="area-main:a1"></section>'));
  assert.ok(source.includes('["container-main", className].filter(Boolean)'));
  assert.ok(source.includes('children = (')); assert.ok(source.includes('{children}</div>'));
  assert.equal(component.provided.seats.target, component.file); assert.equal(component.provided.seats.folder, component.folder);
  assert.equal(result.seats.target, component.file); assert.equal(result.seats.file, component.file); assert.equal(Object.hasOwn(result.seats, 'atom_name'), false);
  assert.equal(component.dependencies.length, 1);
  for (const file of component.verification.files) assert.equal(createHash('sha256').update(await readFile(file.path)).digest('hex'), file.sha256);
  const populated = await runDomEdit({ mode: 'add-element', options: { file: component.file, component: component.name, data_area: 'main', tag: 'div', class_name: 'container-main' }, context: f.context });
  assert.equal(populated.status, 'updated');
  assert.ok((await readFile(component.file, 'utf8')).includes('<div className="container-main"></div>'));
});

test('generic saved atoms path is usable; unavailable and old manifests never become missing-class prompts', async () => {
  const f = await fixture({ components: 'src/components', atoms: 'src/atoms' });
  await f.item('src/atoms/container-main');
  assert.equal((await f.prepare({ class_name: 'container-main' })).questions.length, 0);
  const plan = await f.prepare({ class_name: 'action-main', atom_decisions: { 'action-main': { create: true, kind: 'action-atom' } } });
  assert.equal(plan.dependencies[0].options.location, path.join(f.source, 'src/atoms'));
  const file = await inventoryManifestPath(f.context, 'atoms'); await mkdir(path.dirname(file), { recursive: true });
  await put(file, { version: 'project-inventory/v1', items: [] });
  await assert.rejects(f.prepare({ class_name: 'container-main' }), { code: 'ATOM_INDEX_UNAVAILABLE' });
  await f.memory.setProjectPath(f.context.project, 'atoms', 'unavailable');
  await assert.rejects(f.prepare({ class_name: 'container-main' }), { code: 'ATOM_INDEX_UNAVAILABLE' });
});

test('missing atom location asks the child folder question and invalid grid or styles never create a component', async () => {
  const f = await fixture({ components: 'src/components' });
  const options = { class_name: 'container-main', atom_decisions: { 'container-main': { create: true, kind: 'container-atom' } } };
  const result = await f.prepare(options);
  assert.equal(result.questions[0].name, 'atom:container-main:location');
  await assert.rejects(f.run({ grid: 'unknown' }), { code: 'BAD_REQUEST' });
  options.atom_decisions['container-main'].options = { location: 'src/atoms', styles: 'body {color:red}' };
  await assert.rejects(f.run(options), { code: 'BAD_REQUEST' });
  await missing(path.join(f.source, 'src/components/Card')); await missing(path.join(f.source, 'src/atoms'));
});
