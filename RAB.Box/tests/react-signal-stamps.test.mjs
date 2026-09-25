import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { createRabMemory } from '../bridge/rab-memory.mjs';
import { makeItemSettings } from '../bridge/rab-node.mjs';
import { writeArtifactPlan } from '../tools/_artifact-plan.mjs';
import { runReactComponentStamp, runProjectStamp } from '../tools/_stamp-engines.mjs';

const reactAdd = process.env.RAB_REACT_ADD ?? fileURLToPath(new URL('../../RAB.Toolkits/rab-react-kit/add/new/project/template/toolkit/add', import.meta.url));

test('React template stamps populate signal settings and preserve explicit false', async () => {
  const parent = path.join(os.homedir(), '.rab', 'tests');
  await mkdir(parent, { recursive: true });
  const root = await mkdtemp(path.join(parent, 'react-signals-'));
  const memory = createRabMemory({ rabHome: path.join(root, 'memory') });
  const context = { project: { root } };
  const ids = new Set();
  for (const leaf of ['component', 'page', 'dashboard', 'container-class', 'action-class', 'effect-class', 'grid-class']) {
    const { run } = await import(pathToFileURL(path.join(reactAdd, leaf, `${leaf}.mjs`)));
    for (const transmitting of [undefined, false]) {
      const location = path.join(root, leaf, transmitting === false ? 'off' : 'default');
      const name = leaf.endsWith('-class') ? 'sample' : 'Sample';
      const options = { name, location, page_location: location, title: 'Supplied title', description: '',
        grid: '', class_name: '', ...(transmitting === undefined ? {} : { transmitting, indexed: false }) };
      const helpers = {
        createItemSettings: async input => makeItemSettings({ ...input, id: await memory.allocateId() }),
        writeArtifactPlan,
        resolveProjectFolder: async ({ explicit }) => explicit ?? path.join(root, 'components'),
        // Dashboard's layout/navigation collaborators are outside this settings test.
        runTool: async ({ options: child }) => ({ result: { layout: child.layout, construction_seats: [] } })
      };
      helpers.runReactComponentStamp = extra => runReactComponentStamp({ ...extra, options, context, helpers });
      const result = await run({ options, context, helpers });
      const folder = result.folder ?? path.dirname(result.page.file);
      const saved = JSON.parse(await readFile(path.join(folder, 'settings.json'), 'utf8'));
      assert.equal(saved.name, name);
      assert.equal(saved.title, options.title);
      assert.equal(saved.description, '');
      assert.equal(saved.type, leaf.endsWith('-class') ? 'style' : 'component');
      assert.equal(saved.meta.kind, 'signal');
      assert.equal(saved.transmitting, transmitting ?? true);
      assert.equal(saved.indexed, transmitting === false ? false : true);
      assert.equal(saved.path, path.relative(root, folder).split(path.sep).join('/'));
      assert.deepEqual(saved.settings, []);
      assert.ok(Number.isSafeInteger(saved.id) && !ids.has(saved.id));
      ids.add(saved.id);
      if (leaf.endsWith('-class')) {
        const template = await readFile(path.join(reactAdd, leaf, 'template', `${leaf.replace('-class', '')}-[name].css`), 'utf8');
        assert.equal(await readFile(result.file, 'utf8'), template.replaceAll('[name]', name));
      }
      await assert.rejects(run({ options, context, helpers }), { code: 'EEXIST' });
      assert.deepEqual(JSON.parse(await readFile(path.join(folder, 'settings.json'), 'utf8')), saved);
    }
  }
  console.log(`Signal outputs inspected: ${root}`);
});

test('React project stamp fills live beacon identities and preserves signal templates', async () => {
  const parent = path.join(os.homedir(), '.rab', 'tests');
  await mkdir(parent, { recursive: true });
  const fixture = await mkdtemp(path.join(parent, 'react-beacons-'));
  const result = await runProjectStamp({
    options: { name: 'BeaconExample', folder: fixture, custom_toolkit_path: null },
    context: { rab_home: path.join(fixture, 'memory') },
    tool: { root: path.resolve(reactAdd, '../../..') }
  });
  const ids = new Set([result.project.id]);
  for (const name of ['components', 'pages', 'dashboards', 'atoms']) {
    const beacon = JSON.parse(await readFile(path.join(result.project.root, 'src', name, 'beacon.json'), 'utf8'));
    assert.equal(beacon.name, name);
    assert.equal(beacon.type, 'react');
    assert.equal(beacon.path, `src/${name}`);
    assert.ok(Number.isSafeInteger(beacon.id) && !ids.has(beacon.id));
    ids.add(beacon.id);
    assert.equal(new Date(beacon.date_added).toISOString(), beacon.date_added);
  }
  const template = JSON.parse(await readFile(path.join(result.project.root, 'toolkit/add/component/template/settings.json'), 'utf8'));
  assert.equal(template.id, null);
  assert.equal(template.transmitting, true);
  console.log(`Generated project inspected: ${result.project.root}`);
});
