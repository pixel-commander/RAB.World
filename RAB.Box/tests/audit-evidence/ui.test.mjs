import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../../magic-box/index.html', import.meta.url), 'utf8');
const controller = html.split('// BEGIN INVESTIGATION UI')[1].split('// END INVESTIGATION UI')[0];
const source = controller.slice(controller.indexOf('const createInvestigationUI'));
const createUI = vm.runInNewContext(`${source}\ncreateInvestigationUI;`);
const projectId = 1789940000200, sessionId = 1789940000201, otherSessionId = 1789940000202;

// A small event/DOM boundary harness executes the shipped controller, not a copy.
class Element {
  constructor(tag = 'div', text = '') { this.tag = tag; this.text = text; this.children = []; this.listeners = {}; this.dataset = {}; this.attributes = {}; this.value = ''; this.checked = false; this.disabled = false; this.hidden = false; }
  set textContent(text) { this.text = String(text); this.children = []; }
  get textContent() { return this.text + this.children.map(child => child.textContent).join(' '); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.text = ''; this.children = children; if (this.tag === 'select') this.value = children[0]?.value ?? ''; }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(type, callback) { (this.listeners[type] ??= []).push(callback); }
  querySelectorAll(tag) { return this.children.flatMap(child => [...(child.tag === tag ? [child] : []), ...child.querySelectorAll(tag)]); }
  async emit(type) { for (const listener of this.listeners[type] ?? []) await listener({ preventDefault() {} }); }
}
const activeState = () => ({ token: 'local-token', busy: false,
  session: { session_id: sessionId, bag: { project: { id: projectId, name: 'Fixture', root: 'C:/memory/a' } } },
  project: { project: { id: projectId }, project_path: 'C:/memory/a', settings: { type: 'audit', name: 'Fixture', paths: { folder: 'C:/source' } } }
});
const evidence = () => ({ version: 'audit-evidence/v1', project: { id: projectId }, scan_root: 'C:/source', revision: 'rev-1', subject: 'ui-action',
  entities: [{ kind: 'class-definition', location: { file: 'src/atoms.css', line: 2, column: 1 } }, { kind: 'class-usage', location: { file: 'src/Button.tsx', line: 9, column: 5 } }],
  conclusions: [{ summary: 'One possible consumer.', confidence: { level: 'limited', reasons: ['Static evidence only.'] } }],
  coverage: { completeness: 'partial', limits: ['Runtime reachability is unresolved.'] }, findings: [{ kind: 'dynamic-assignments', summary: 'Unresolved assignment.' }], plans: []
});
const plan = () => ({ id: 'plan-1', status: 'prepared', target: { file: 'src/atoms.css', sha256: 'before-hash' },
  tool: { key: 'css/add/state/class', options: { styles: '--action-ink: var(--ink);' } }, expected: { selectors: ['.ui-action:active', '.ui-action.is-active'] },
  recovery: { before_text: '.ui-action {}' }, limits: ['One file only.']
});
const fixture = (override) => {
  const state = activeState(), nodes = new Map(), calls = [], saved = { file: 'report-1.json', result: evidence(), freshness: { status: 'current', changed: [] } };
  for (const match of html.matchAll(/<(\w+)[^>]*\bid="investigation-([^"]+)"/g)) nodes.set(match[2], new Element(match[1]));
  const node = name => { assert.ok(nodes.has(name), `missing markup: ${name}`); return nodes.get(name); };
  let ui;
  const request = async (route, method, body) => {
    calls.push(structuredClone({ route, method, ...body }));
    if (override) { const response = await override(body, saved); if (response !== undefined) return structuredClone(response); }
    if (body.action === 'list') return { items: [{ file: saved.file, subject: saved.result.subject, action: 'inspect', saved_at: '2026-09-20' }], unavailable: [] };
    if (body.action === 'declare') saved.result.findings.push({ kind: 'declared-intent', decision: body.decision, reason: body.reason, scope: { revision: saved.result.revision } });
    if (body.action === 'plan') { saved.result.plans = [plan()]; saved.file = 'plan.json'; }
    if (body.action === 'execute') { saved.result.verification = { status: 'passed', checks: [{ name: 'bytes', passed: true, detail: 'Expected bytes match.' }], remaining: ['Application build/tests and visual behavior require their own recorded verification.'] }; }
    if (body.action === 'handoff') saved.result.handoff = { objective: 'Review ui-action', gaps: ['Runtime behavior unknown.'] };
    return structuredClone(saved);
  };
  const runTask = async (_label, work) => { if (state.busy) return; state.busy = true; ui.sync(); try { return await work(); } finally { state.busy = false; ui.sync(); } };
  ui = createUI({ getState: () => state, request, runTask, $: selector => node(selector.slice('#investigation-'.length)),
    el: (tag, text = '', className) => Object.assign(new Element(tag, text), { className }), json: value => JSON.stringify(value, null, 2) });
  ui.sync();
  const enter = async (name, value) => { node(name).value = value; await node(name).emit('input'); };
  const run = async () => { await enter('class', 'ui-action'); await node('run-form').emit('submit'); };
  const prepare = async () => { await enter('decision', 'intentional'); await enter('reason', 'Make the paired state skin use the existing ink token.'); await node('declare-form').emit('submit'); await enter('styles', '--action-ink: var(--ink);'); await node('plan-form').emit('submit'); };
  const approve = async () => { node('confirm').checked = true; await node('confirm').emit('change'); };
  return { state, nodes, node, calls, saved, ui, enter, run, prepare, approve };
};

test('page script compiles; isolated Toolbox and Turn Checker branches remain ahead of workspace initialization', () => {
  new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
  assert.match(html, /data-view="investigations">Investigations/);
  const boot = html.slice(html.indexOf('const boot ='));
  assert.ok(boot.indexOf("if(!$('#view-turn-checker').hidden)return;") < boot.indexOf('await loadWorkspace()'));
  assert.ok(boot.indexOf('await loadToolCatalog();return;') < boot.indexOf('await loadWorkspace()'));
  assert.match(boot, /if\(!\$\('#view-investigations'\).hidden\)await investigations.load\(\)/);
});

test('decision markup exposes every supported typed declaration as a valid option', () => {
  const markup = html.match(/<select id="investigation-decision"[^>]*>([\s\S]*?)<\/select>/)[1];
  assert.deepEqual([...markup.matchAll(/<option value="([^"]*)">[^<]*<\/option>/g)].map(x => x[1]), ['', 'intentional', 'accidental', 'unknown']);
  assert.doesNotMatch(markup, /<\/option\s/);
});

test('no matching active audit session disables actions and makes no investigation request', async () => {
  const f = fixture(); f.state.session = null; f.ui.sync(); await f.ui.load(); await f.run();
  assert.equal(f.calls.length, 0); assert.equal(f.node('run').disabled, true); assert.equal(f.node('context').hidden, false);
  f.state.session = activeState().session; f.state.project.project.id = projectId + 10; f.ui.sync(); await f.ui.load();
  assert.equal(f.calls.length, 0); assert.equal(f.node('execute').disabled, true);
});

test('run saves and reads back scoped evidence, locations, limits and unavailable reports', async () => {
  const f = fixture(body => body.action === 'list' ? { items: [], unavailable: [{ file: 'bad.json', message: 'Malformed report' }] } : undefined);
  await f.run();
  assert.deepEqual(f.calls.map(x => x.action), ['run', 'read', 'list']);
  assert.ok(f.calls.every(x => x.session_id === sessionId && x.route === '/api/investigations' && x.method === 'POST'));
  assert.equal(f.node('detail').hidden, false);
  assert.match(f.node('definitions').textContent, /src\/atoms.css:2:1/);
  assert.match(f.node('consumers').textContent, /src\/Button.tsx:9:5/);
  assert.match(f.node('gaps').textContent, /Runtime reachability/);
  assert.match(f.node('unavailable').textContent, /Malformed report/);
  assert.equal(f.node('confirm').checked, false);
});

test('prepared plan never executes without approval; draft editing clears approval; verification exposes remaining limits', async () => {
  const f = fixture(); await f.run(); await f.prepare();
  assert.equal(f.node('execute').disabled, true); await f.node('execute').emit('click');
  assert.ok(!f.calls.some(x => x.action === 'execute'));
  assert.match(f.node('plan-target').textContent, /src\/atoms.css.*before-hash/);
  assert.match(f.node('proposed-styles').textContent, /--action-ink/);
  assert.equal(f.node('before').textContent, '.ui-action {}');
  await f.approve(); assert.equal(f.node('execute').disabled, false);
  await f.enter('styles', '--different: var(--ink);');
  assert.equal(f.node('confirm').checked, false); assert.equal(f.node('execute').disabled, true);
  await f.enter('styles', '--action-ink: var(--ink);'); await f.approve(); await f.node('execute').emit('click');
  assert.equal(f.calls.filter(x => x.action === 'execute').length, 1);
  const sent = f.calls.find(x => x.action === 'execute'); assert.equal(sent.plan_id, 'plan-1'); assert.equal(sent.confirm, true);
  assert.match(f.node('verification-status').textContent, /passed/);
  assert.match(f.node('checks').textContent, /Application build\/tests and visual behavior/);
  assert.equal(f.node('execute').disabled, true);
});

test('failed execution is not retried even after reopening the same plan', async () => {
  const f = fixture(body => { if (body.action === 'execute') throw new Error('Connection lost'); });
  await f.run(); await f.prepare(); await f.approve(); await f.node('execute').emit('click');
  assert.match(f.node('status').textContent, /outcome may be uncertain/);
  await f.node('list').querySelectorAll('button')[0].emit('click'); await f.approve(); await f.node('execute').emit('click');
  assert.equal(f.calls.filter(x => x.action === 'execute').length, 1); assert.equal(f.node('execute').disabled, true);
});

test('stale or unknown evidence cannot prepare or execute, but can preserve a decision and local handoff', async () => {
  const f = fixture(); f.saved.freshness.status = 'stale'; f.saved.result.plans = [plan()]; await f.run();
  await f.enter('styles', '--action-ink: var(--ink);'); await f.approve();
  assert.equal(f.node('plan').disabled, true); assert.equal(f.node('execute').disabled, true);
  await f.enter('decision', 'unknown'); await f.enter('reason', 'Need runtime evidence.'); await f.node('declare-form').emit('submit');
  assert.equal(f.calls.find(x => x.action === 'declare').reason, 'Need runtime evidence.');
  await f.node('handoff').emit('click'); assert.equal(f.node('handoff-json').hidden, false); assert.match(f.node('handoff-json').textContent, /Runtime behavior unknown/);
});

test('switching sessions clears selection and ignores an in-flight response from the previous session', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const f = fixture(async body => { if (body.action === 'read') await gate; });
  const running = f.run();
  while (!f.calls.some(x => x.action === 'read')) await new Promise(resolve => setImmediate(resolve));
  f.state.session.session_id = otherSessionId; f.ui.sync(); release(); await running;
  assert.equal(f.node('detail').hidden, true); assert.equal(f.node('confirm').checked, false);
  assert.match(f.node('list').textContent, /Refresh the saved list/);
  assert.equal(f.calls.filter(x => x.action === 'list').length, 0);
  await f.ui.load(); assert.equal(f.calls.at(-1).session_id, otherSessionId);
});

test('an unknown or absent decision keeps plan preparation disabled with an actionable explanation', async () => {
  const f = fixture(); await f.run(); await f.enter('styles', '--action-ink: var(--ink);');
  assert.equal(f.node('plan').disabled, true); assert.match(f.node('plan-hint').textContent, /record an intentional or accidental decision/);
  await f.enter('decision', 'unknown'); await f.enter('reason', 'Intent still needs investigation.'); await f.node('declare-form').emit('submit');
  await f.enter('styles', '--action-ink: var(--ink);'); assert.equal(f.node('plan').disabled, true);
});

test('changing the project or scan folder clears evidence; a mismatched report is rejected', async () => {
  const f = fixture(); await f.run();
  f.state.project.settings.paths.folder = 'C:/different'; f.ui.sync();
  assert.equal(f.node('detail').hidden, true); await f.run();
  assert.match(f.node('status').textContent, /does not match/); assert.equal(f.node('detail').hidden, true);
});

test('evidence is rendered as text and a no-definition class cannot select an arbitrary output file', async () => {
  const f = fixture(); f.saved.result.subject = '<img src=x onerror=alert(1)>'; f.saved.result.entities = [];
  await f.run(); assert.equal(f.node('subject').textContent, '<img src=x onerror=alert(1)>');
  assert.equal(f.node('location').value, ''); await f.enter('styles', '--x: var(--ink);'); assert.equal(f.node('plan').disabled, true);
  assert.match(f.node('consumers').textContent, /does not establish/);
});
