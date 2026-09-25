import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createRunPreparation, decodeFieldValue, isRecord } from '../magic-box/run-preparation.mjs';

class Element {
  constructor(tag, document) { this.tagName = tag; this.ownerDocument = document; this.children = []; this.attributes = new Map(); this.events = new Map(); this.dataset = {}; this.value = ''; this.textContent = ''; this.hidden = false; this.disabled = false; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  addEventListener(name, handler) { this.events.set(name, handler); }
  focus() { this.ownerDocument.activeElement = this; }
  emit(name) { return this.events.get(name)?.({ preventDefault() {} }); }
}
const all = root => [root, ...root.children.flatMap(all)];
const find = (root, predicate) => all(root).find(predicate);
const named = (root, name) => find(root, node => node.name === name);
const button = (root, text) => find(root, node => node.tagName === 'button' && node.textContent === text);
const form = root => find(root, node => node.tagName === 'form');
const text = root => all(root).map(node => node.textContent).join('\n');
const edit = (root, name, value) => { const input = named(root, name); assert.ok(input, name); input.value = value; input.emit('input'); return input; };
const field = (name, type = 'text', extra = {}) => ({ name, title: name, type, required: true, status: 'unknown', source: null, editable: true, ...extra });
const preparation = (settings = [field('name')], extra = {}) => ({ version: 'run-preparation/v1', session_id: 11, revision: 1, group_id: 31, status: 'input-required', ready_to_confirm: false, steps: [{ id: 41, title: 'Test tool', status: 'input-required', settings, gaps: {} }], ...extra });
const fixture = handlers => {
  const document = { createElement(tag) { return new Element(tag, document); } };
  const root = new Element('div', document), panel = createRunPreparation(root, handlers);
  return { root, panel, document };
};

test('typed answers preserve false, zero, empty text, JSON, and non-string enum values', () => {
  assert.equal(decodeFieldValue(field('flag', 'boolean'), 'false'), false);
  assert.equal(decodeFieldValue(field('count', 'number'), '0'), 0);
  assert.equal(decodeFieldValue(field('text', 'text', { required: false }), ''), '');
  assert.deepEqual(decodeFieldValue(field('json', 'json'), '{"enabled":false}'), { enabled: false });
  assert.equal(decodeFieldValue(field('choice', 'text', { enum: [0, false, 'x'] }), '1'), false);
  for (const [definition, raw] of [[field('flag', 'boolean'), ''], [field('count', 'number'), ''], [field('count', 'number'), 'Infinity'], [field('json', 'json'), '{'], [field('name'), ' '], [field('enum', 'text', { enum: ['x'] }), '-1']]) assert.throws(() => decodeFieldValue(definition, raw));
  assert.equal(isRecord([]), false); assert.equal(isRecord(null), false); assert.equal(isRecord({}), true);
});

test('saving edited fields leaves untouched questions unresolved and never executes', async () => {
  const calls = [], actions = [];
  const { root, panel } = fixture({ handleSubmit: (data, type) => calls.push({ data, type }), handleClick: data => actions.push(data) });
  panel.update(preparation([field('flag', 'boolean'), field('count', 'number'), field('untouched'), field('notes', 'text', { required: false }), field('path.with:colon')]));
  assert.equal(named(root, 'flag').value, ''); assert.equal(button(root, 'Save answers').disabled, true);
  edit(root, 'flag', 'false'); edit(root, 'count', '0'); edit(root, 'notes', ''); edit(root, 'path.with:colon', 'literal field name');
  await form(root).emit('submit');
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [{ data: { answers: [{ step_id: 41, values: { flag: false, count: 0, notes: '', 'path.with:colon': 'literal field name' } }] }, type: 'session-inputs' }]);
  assert.equal(actions.length, 0); assert.equal(button(root, 'Confirm & run').disabled, true);
});

test('all local values validate before callback and errors retain drafts accessibly', async () => {
  const calls = [];
  const { root, panel, document } = fixture({ handleSubmit: data => calls.push(data) });
  panel.update(preparation([field('name'), field('config', 'json')]));
  edit(root, 'name', 'keep me'); const invalid = edit(root, 'config', '{');
  await form(root).emit('submit');
  assert.equal(calls.length, 0); assert.equal(invalid.attributes.get('aria-invalid'), 'true');
  assert.equal(document.activeElement.attributes.get('role'), 'alert');
  assert.match(text(root), /config: Enter valid JSON/); assert.equal(named(root, 'name').value, 'keep me');
  edit(root, 'config', '{}'); await form(root).emit('submit'); assert.equal(calls.length, 1);
});

test('server rejection retains answers and same snapshot rerender preserves unsaved drafts', async () => {
  const { root, panel } = fixture({ handleSubmit: () => { throw new Error('INVALID_INPUT: folder does not exist'); } });
  const data = preparation(); panel.update(data); edit(root, 'name', 'do not lose');
  await form(root).emit('submit'); assert.match(text(root), /INVALID_INPUT/); assert.equal(named(root, 'name').value, 'do not lose');
  panel.update(data); assert.equal(named(root, 'name').value, 'do not lose');
});

test('new session/revision/group clears drafts and rejects events from detached forms', async () => {
  const calls = [];
  const { root, panel } = fixture({ handleSubmit: data => calls.push(data) });
  panel.update(preparation()); edit(root, 'name', 'stale'); const staleForm = form(root);
  panel.update(preparation(undefined, { revision: 2 }));
  assert.equal(named(root, 'name').value, ''); await staleForm.emit('submit'); assert.equal(calls.length, 0);
  edit(root, 'name', 'fresh'); await form(root).emit('submit'); assert.equal(calls.length, 1);
  panel.update(preparation(undefined, { session_id: 12, group_id: 32 })); assert.equal(named(root, 'name').value, '');
});

test('busy actions cannot double-submit; readiness requires separate explicit confirmation', async () => {
  let finish; const submissions = [], runs = [];
  const { root, panel } = fixture({ handleSubmit: data => { submissions.push(data); return new Promise(resolve => { finish = resolve; }); }, handleClick: (data, type) => runs.push({ data, type }) });
  panel.update(preparation()); edit(root, 'name', 'ready');
  const pending = form(root).emit('submit'); await form(root).emit('submit'); assert.equal(submissions.length, 1);
  assert.equal(named(root, 'name').disabled, true); assert.equal(button(root, 'Cancel').disabled, true);
  panel.update(preparation([field('name', 'text', { value: 'ready', status: 'known', source: 'answer', editable: false })], { revision: 2, status: 'ready', ready_to_confirm: true }));
  finish(); await pending;
  assert.equal(runs.length, 0); assert.equal(button(root, 'Confirm & run').disabled, false);
  await button(root, 'Confirm & run').emit('click'); assert.deepEqual(runs, [{ data: { confirm: true }, type: 'session-execute' }]);
  panel.setBusy(true); assert.equal(button(root, 'Confirm & run').disabled, true);
});

test('cancel uses a narrow callback; completed and chat-guided project actions have no false execution controls', async () => {
  const cancels = [];
  const { root, panel } = fixture({ handleCancel: (data, type) => cancels.push({ data, type }) });
  panel.update(preparation()); await button(root, 'Cancel').emit('click'); assert.deepEqual(cancels, [{ data: undefined, type: 'session-inputs' }]);
  const data = preparation(); data.steps[0].projectAction = 'new-project'; panel.update(data);
  assert.equal(named(root, 'name'), undefined); assert.equal(button(root, 'Confirm & run'), undefined); assert.match(text(root), /Continue this project setup in Chat/);
  panel.update(preparation([], { revision: 2, status: 'cancelled' })); assert.equal(button(root, 'Cancel'), undefined); assert.equal(root.hidden,true);
});

test('untrusted labels stay text, prototypes stay values, and invalid receiver data hides safely', async () => {
  const calls = [];
  const { root, panel } = fixture({ handleSubmit: data => calls.push(data) });
  panel.update(preparation([field('__proto__'), field('<img src=x onerror=bad()>', 'text', { editable: false, value: '<script>bad()</script>', source: 'project' })]));
  edit(root, '__proto__', 'literal'); await form(root).emit('submit');
  assert.equal(calls[0].answers[0].values.__proto__, 'literal'); assert.equal(Object.getPrototypeOf(calls[0].answers[0].values), null);
  assert.equal(named(root, '<img src=x onerror=bad()>').value, '<script>bad()</script>'); assert.ok(all(root).every(node => node.tagName !== 'script' && node.tagName !== 'img'));
  panel.update(undefined); assert.equal(root.hidden, true); panel.update([]); assert.equal(root.hidden, true);
});

test('helper dependencies, actual receipt paths, zero duration, and execution errors stay visible', () => {
  const { root, panel } = fixture({});
  const data = preparation([field('helper', 'text', { editable: false, status: 'auto-resolver' }), field('parent', 'folder', { editable: false, status: 'pending-dependency' })]);
  panel.update(data); assert.match(text(root), /declared helper will supply/); assert.match(text(root), /preceding step’s result/);
  data.steps[0].receipt = { id: 91, duration_ms: 0, steps: [{ result_file: 'C:/project/audit-results/report.json' }] };
  data.status = 'completed'; data.revision++; panel.update(data);
  assert.equal(root.hidden,true);assert.equal(root.children.length,0);
  delete data.steps[0].receipt; data.steps[0].error = { code: 'TOOL_FAILED', message: 'File was removed.' }; data.status = 'input-required'; data.revision++;
  panel.update(data); assert.match(text(root), /TOOL_FAILED: File was removed/);
});

test('all fields stay visible with supplied values, required labels and locked dependencies', () => {
  const { root, panel } = fixture({});
  panel.update(preparation([
    field('name'),
    field('folder', 'folder', { editable: false, status: 'derived', value: 'C:/project', source: 'project' }),
    field('optional', 'text', { editable: false, status: 'unbound', required: false }),
    field('parent', 'folder', { editable: false, status: 'pending-dependency' }),
    field('helper', 'text', { editable: false, status: 'auto-resolver' }),
  ]));
  assert.equal(find(root, node => node.tagName === 'details'), undefined);
  assert.equal(named(root, 'folder').value, 'C:/project');
  assert.equal(named(root, 'parent').disabled, true);
  assert.equal(named(root, 'helper').disabled, true);
  assert.equal(named(root, 'name').required, true);
  assert.equal(named(root, 'optional').required, false);
  assert.match(text(root), /name · Required/); assert.match(text(root), /optional · Optional/);
  assert.match(text(root), /Waiting for the preceding step/); assert.match(text(root), /declared helper will supply/);
});

test('ready form prefills typed values and submits literal multiline code without running', async () => {
  const submissions = [], runs = [];
  const {root,panel} = fixture({handleSubmit: data => submissions.push(data),handleClick: data => runs.push(data)});
  const code = '  const view = <Card path="C:\\source" title="<&>: /">\n\t{item?.name ?? ""}</Card>;\n';
  const fields = [field('code','textarea',{value:code,status:'resolved'}),field('flag','boolean',{value:false}),field('count','number',{value:0}),field('choice','text',{enum:[0,false,'x'],value:false}),field('notes','text',{required:false,value:''})];
  panel.update(preparation(fields,{status:'ready',ready_to_confirm:true}));
  assert.equal(named(root,'code').tagName,'textarea');assert.equal(named(root,'code').value,code);
  assert.equal(named(root,'flag').value,'false');assert.equal(named(root,'count').value,'0');assert.equal(named(root,'choice').value,'1');assert.equal(named(root,'notes').value,'');
  assert.equal(button(root,'Confirm & run').disabled,false);
  edit(root,'code',code+'// revised: `x` & :hover\n');
  assert.equal(button(root,'Confirm & run').disabled,true);
  await button(root,'Confirm & run').emit('click');assert.equal(runs.length,0);
  await form(root).emit('submit');
  assert.equal(submissions[0].answers[0].values.code,code+'// revised: `x` & :hover\n');assert.equal(runs.length,0);
});

test('ready Chat reply names the action without numeric group identifiers or YOLO wording', () => {
  const html=readFileSync(new URL('../magic-box/index.html',import.meta.url),'utf8');
  const declaration=html.slice(html.indexOf('const sessionReply ='),html.indexOf('const syncChatSend ='));
  const reply=vm.runInNewContext(`${declaration};sessionReply`);
  const step={id:41,capability:{title:'New Component'},options:{name:{value:'IDEViewer'}}};
  const message=reply({ready_to_confirm:true,current_group:{id:1830000000738},current_steps:[step],steps:[],last_turn:{stepIds:[]}});
  assert.match(message,/New Component “IDEViewer” is ready/);assert.match(message,/Review the fields on the right/);
  assert.doesNotMatch(message,/1830000000738|Group|YOLO/);
  assert.match(reply({ready_to_confirm:true,current_steps:[step,step],steps:[]}),/Your 2 actions are ready/);
});

test('editable questions are not duplicated in gaps; other blockers stay visible', () => {
  const { root, panel } = fixture({});
  const data = preparation([field('name', 'text', { description: 'What is name?' })]);
  data.steps[0].gaps = {
    requiredInputs: [{ field: 'name', question: 'What is name?' }],
    configuration: [{ field: 'path:components', question: 'Where should components go?' }],
    conflicts: [{ field: 'name', message: 'Two tools conflict.' }],
  };
  panel.update(data);
  assert.equal(text(root).match(/What is name\?/g)?.length, 1);
  assert.match(text(root), /Where should components go/); assert.match(text(root), /Two tools conflict/);
});

test('terminal actions clear the form so the history entry owns their summary', () => {
  const { root, panel } = fixture({});
  for (const status of ['completed','cancelled','failed', 'interrupted', 'superseded', 'execution-failed', 'execution-interrupted']) {
    panel.update(preparation([field('name')], { status, ready_to_confirm: true }));
    assert.equal(root.hidden,true);assert.equal(root.children.length,0); assert.equal(named(root, 'name'), undefined);
    assert.equal(button(root, 'Save answers'), undefined); assert.equal(button(root, 'Cancel'), undefined); assert.equal(button(root, 'Confirm & run'), undefined);
    assert.doesNotMatch(text(root), /Fill the missing inputs|confirm Run/);
  }
});

test('Magic Box preserves classic bootstrap, shared revision mutation, cancellation vocabulary, and separate Run', () => {
  const html = readFileSync(new URL('../magic-box/index.html', import.meta.url), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  assert.doesNotThrow(() => new vm.Script(script));
  assert.match(script, /import\('\/magic-box\/run-preparation\.mjs'\)/);
  assert.match(script, /sessionMutation\('\/api\/session\/answer', \{ answers: data\.answers \}\)/);
  assert.match(script, /assertPreparationContext\(\); await submitChatTurn\('nevermind'\)/);
  const submit = script.slice(script.indexOf('handleSubmit: async (data, type)'), script.indexOf('handleCancel: async (data, type)'));
  assert.doesNotMatch(submit, /session\/execute|yolo/);
  assert.match(html, /id="chat-step-history"/); assert.match(html, /id="chat-project-tab"/);
});
