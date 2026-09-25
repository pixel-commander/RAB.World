import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPlanner } from './fixtures/planner-reference.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const planner = createPlanner({ root });

test('compound request becomes inspectable tasks and capability gaps', async () => {
  const out = await planner.plan({
    text: 'start a new react project named "test" and give it a home page that says "coming soon". then make the homepage be wrapped in "container-main" container atom.',
    context: { projectRoot: 'D:/Projects' }
  });
  assert.equal(out.frames.length, 3);
  assert.equal(out.tasks.length, 3);
  assert.equal(out.tasks[0].type, 'stamp');
  assert.equal(out.tasks[0].stamp.name, 'react-project');
  assert.equal(out.tasks[0].options.name.value, 'test');
  assert.equal(out.tasks[0].options.location.value, 'D:/Projects');
  assert.equal(out.tasks[0].options.type.value, 'app');
  assert.equal(out.tasks[1].type, 'unresolved');
  assert.ok(out.tasks[1].candidates.suggestions.some(x => x.name === 'page'));
  assert.equal(out.tasks[2].type, 'unresolved');
  assert.ok(out.tasks[2].candidates.suggestions.some(x => x.name === 'atom-container'));
  assert.equal(out.gaps.capabilities.length, 2);
  assert.equal(out.readyToExecute, false);
  assert.equal(out.authority, 0);
});

test('required stamp fields are visible instead of silently guessed', async () => {
  const out = await planner.plan({ text: 'make a component named "TestComponent"' });
  assert.equal(out.tasks.length, 1);
  assert.equal(out.tasks[0].stamp.name, 'component-stamp');
  assert.equal(out.tasks[0].options.name.value, 'TestComponent');
  assert.equal(out.tasks[0].options.class.status, 'unknown');
  assert.deepEqual(out.gaps.requiredInputs.map(x => x.field), ['class']);
  assert.equal(out.readyForInputCollection, true);
  assert.equal(out.readyToExecute, false);
});

test('unsupported destructive/attachment semantics remain gaps even when related stamps exist', async () => {
  const out = await planner.plan({ text: 'remove container-main from the home page' });
  assert.equal(out.readyForInputCollection, false);
  assert.equal(out.gaps.capabilities.length, 1);
  assert.equal(out.gaps.capabilities[0].operation, 'detach');
});

test('negation never becomes execution authority', async () => {
  const out = await planner.plan({ text: 'do not make a component named "X"' });
  assert.equal(out.tasks.length, 0);
  assert.equal(out.gaps.semantic[0].type, 'negation');
  assert.equal(out.readyToExecute, false);
});

test('audit domain locks into Bag and resolves state hook Tool without repeating audit', async () => {
  const setup = await planner.plan({ text: 'I want to audit C:\\project' });
  assert.equal(setup.domain, 'audit');
  assert.equal(setup.bag.projectRoot, 'C:\\project');
  const out = await planner.plan({ text: 'find all the state hooks', context: setup.bag });
  assert.equal(out.domain, 'audit');
  assert.equal(out.tasks.length, 1);
  assert.equal(out.tasks[0].type, 'tool');
  assert.equal(out.tasks[0].tool.address, 'find-state-hooks');
  assert.equal(out.tasks[0].options.folder.value, 'C:\\project');
  assert.equal(out.gaps.capabilities.length, 0);
});

test('audit unknown capability stays visible and offers nearby Tools', async () => {
  const out = await planner.plan({ text: 'find all the orphaned files', context: { domain:'audit', projectRoot:'C:\\project' } });
  assert.equal(out.tasks.length, 1);
  assert.equal(out.tasks[0].type, 'unresolved');
  assert.equal(out.gaps.capabilities.length, 1);
  assert.equal(out.readyToExecute, false);
});

test('generic project creation asks for project kind instead of guessing', async () => {
  const out = await planner.plan({ text: 'start a new project named "test"' });
  assert.ok(out.gaps.semantic.some(g => g.type === 'project-kind'));
  assert.equal(out.readyToExecute, false);
});
