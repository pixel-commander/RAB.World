import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile, writeFile, rm, mkdir, rename, symlink, lstat, readdir } from 'node:fs/promises';
import { createMagicBox } from './fixtures/runtime-reference.mjs';
import { fixture, update, json, clock, sentence, readySentence, respond } from './helpers.mjs';

const exists = async file => { try { await lstat(file); return true; } catch { return false; } };

test('same reserved stamp, different paths and required seats in two projects', async t => {
  const a = await fixture(t, 'a'), b = await fixture(t, 'b');
  const ra = await a.box.prepare(sentence), rb = await b.box.prepare(sentence);
  assert.equal(ra.capability, rb.capability);
  assert.notEqual(ra.frames[0].settings, rb.frames[0].settings);
  assert.deepEqual(ra.questions.map(q => q.key), ['type']);
  assert.deepEqual(rb.questions.map(q => q.key), ['type', 'theme']);
});
test('fresh instance resumes saved ticket, fills only the pending field', async t => {
  const { root, box } = await fixture(t);
  const first = await box.prepare(sentence);
  const fresh = createMagicBox({ projectRoot: root, clock });
  const r = await fresh.answer(JSON.parse(JSON.stringify(first.ticket)), respond(first, 'react-project', { type: 'app' }));
  assert.equal(r.status, 'ready', JSON.stringify(r));
  assert.equal(r.ticket.id, first.ticket.id);
  assert.equal(r.frames[0].options.name, 'test-project');
});
test('answer for wrong request is rejected', async t => {
  const { box } = await fixture(t);
  const r = await box.prepare(sentence);
  assert.equal((await box.answer(r.ticket, { request_id: r.ticket.id + 1, stamp: 'react-project', values: { type: 'app' } })).status, 'invalid-input');
});
test('answer cannot overwrite an already supplied seat', async t => {
  const { box } = await fixture(t);
  const r = await box.prepare(sentence);
  assert.equal((await box.answer(r.ticket, respond(r, 'react-project', { name: 'other' }))).status, 'invalid-input');
});
test('answer cannot grant permissions or invent fields', async t => {
  const { box } = await fixture(t);
  const r = await box.prepare(sentence);
  assert.equal((await box.answer(r.ticket, respond(r, 'react-project', { authority: 1 }))).status, 'invalid-input');
});
test('ticket from a different project is rejected', async t => {
  const a = await fixture(t, 'a'), b = await fixture(t, 'b');
  const r = await a.box.prepare(sentence);
  assert.equal((await b.box.answer(r.ticket, respond(r, 'react-project', { type: 'app' }))).status, 'invalid-input');
});
test('canonical input reaches the same options as language', async t => {
  const { box } = await fixture(t);
  const text = await box.prepare(readySentence);
  const canonical = await box.prepare({ mode: 'command', capability: 'react-project', options: { name: 'test-project', location: '.', type: 'app' } });
  assert.equal(canonical.status, 'ready');
  assert.deepEqual(canonical.frames[0].options, text.frames[0].options);
});
test('canonical ingress rejects extra authority fields', async t => {
  const { box } = await fixture(t);
  const r = await box.prepare({ mode: 'command', capability: 'react-project', options: {}, authority: 1 });
  assert.equal(r.status, 'invalid-input');
});
test('canonical Boolean strings do not coerce to true', async t => {
  const { box } = await fixture(t);
  const r = await box.prepare({ mode: 'command', capability: 'react-project', options: { name: 'x', location: '.', type: 'app', add_database: 'false' } });
  assert.equal(r.status, 'invalid-input');
});
test('existing class bypasses atom creation', async t => {
  const { box } = await fixture(t);
  const r = await box.prepare('make a div with class container-main');
  assert.equal(r.status, 'ready');
  assert.deepEqual(r.frames.map(x => x.capability), ['div-stamp']);
});
test('existing class works even if the unused atom script was removed', async t => {
  const { root, box } = await fixture(t);
  await rm(path.join(root, 'stamps/Atom'), { recursive: true });
  const r = await box.prepare('make a div with class container-main');
  assert.equal(r.status, 'ready', JSON.stringify(r));
});
test('missing class cannot use a deleted atom script', async t => {
  const { root, box } = await fixture(t);
  await rm(path.join(root, 'stamps/Atom'), { recursive: true });
  const r = await box.prepare('make a div with class unknown-class');
  assert.equal(r.status, 'capability-unavailable', JSON.stringify(r));
});
test('missing class retains the original parent and asks for appearance, not name', async t => {
  const { box } = await fixture(t);
  const r = await box.prepare('make a div with class x');
  assert.equal(r.status, 'input-required');
  assert.deepEqual(r.questions.map(q => [q.stamp, q.key]), [['atom-stamp', 'token']]);
  assert.equal(r.frames[0].options.name, 'x');
  assert.deepEqual(r.questions[0].returnTo, { request_id: r.ticket.id, stamp: 'div-stamp', key: 'class' });
});
test('dependency fills its inputs from the original request', async t => {
  const { box } = await fixture(t);
  const r = await box.prepare('make div using token --surface-main with class x');
  assert.equal(r.status, 'ready', JSON.stringify(r));
  assert.equal(r.frames[0].options.token, '--surface-main');
});
test('project B dependency asks for its extra fields', async t => {
  const { box } = await fixture(t, 'b');
  const r = await box.prepare('make div with class x using token --surface-main');
  assert.equal(r.status, 'input-required');
  assert.deepEqual(r.questions.map(q => q.key), ['theme', 'exportTarget']);
});
test('unused dependency input is not silently discarded', async t => {
  const { box } = await fixture(t);
  assert.equal((await box.prepare('make div with class container-main using token --surface-main')).status, 'conflict');
});
test('lookup failure is not missing class', async t => {
  const { root, box } = await fixture(t);
  await rm(path.join(root, 'atoms'), { recursive: true });
  const r = await box.prepare('make div with class x');
  assert.equal(r.status, 'lookup-failed');
});
test('incomplete catalog entry is a lookup failure, not absence', async t => {
  const { root, box } = await fixture(t);
  await mkdir(path.join(root, 'atoms/x'));
  assert.equal((await box.prepare('make div with class x')).status, 'lookup-failed');
});
test('unknown appearance token is rejected', async t => {
  const { box } = await fixture(t);
  assert.equal((await box.prepare('make div with class x using token --made-up')).status, 'invalid-input');
});
test('incomplete token index never establishes absence', async t => {
  const { root, box } = await fixture(t);
  await update(path.join(root, 'tokens.json'), x => { x.complete = false; });
  assert.equal((await box.prepare('make div with class x using token --surface-main')).status, 'lookup-failed');
});
test('changed settings invalidate a pending ticket', async t => {
  const { root, box } = await fixture(t);
  const r = await box.prepare(sentence);
  await update(path.join(root, 'stamps/ReactProject/settings.json'), x => { x.options.owner = { required: true, type: 'text' }; });
  assert.equal((await box.answer(r.ticket, respond(r, 'react-project', { type: 'app' }))).status, 'stale-contract');
  const fresh = await box.prepare(readySentence);
  assert.deepEqual(fresh.questions.map(q => q.key), ['owner']);
});
test('changed supporting template invalidates pending ticket', async t => {
  const { root, box } = await fixture(t);
  const r = await box.prepare(sentence);
  await update(path.join(root, 'stamps/ReactProject/template.json'), x => { x.files.push({ path: 'more.txt', text: 'new' }); });
  assert.equal((await box.answer(r.ticket, respond(r, 'react-project', { type: 'app' }))).status, 'stale-contract');
});
test('moving a stamp and updating PATHS changes resolution without parser changes', async t => {
  const { root, box } = await fixture(t);
  await rename(path.join(root, 'stamps/ReactProject'), path.join(root, 'stamps/Moved'));
  await update(path.join(root, 'PATHS.json'), x => {
    const s = x.stamps['react-project'];
    s.settings = 'stamps/Moved/settings.json'; s.script = 'stamps/Moved/stamp.mjs'; s.supporting_files.template = 'stamps/Moved/template.json';
  });
  const r = await box.prepare(readySentence);
  assert.equal(r.status, 'ready');
  assert.equal(r.frames[0].script, 'stamps/Moved/stamp.mjs');
});
test('removing a stamp folder removes it from the live inspection list', async t => {
  const { root, box } = await fixture(t);
  await rm(path.join(root, 'stamps/ReactProject'), { recursive: true });
  const r = await box.inspect();
  assert.equal(r.capabilities.some(x => x.name === 'react-project'), false);
  assert.equal(r.unavailable[0].name, 'react-project');
});
test('reserved name cannot drift inside settings', async t => {
  const { root, box } = await fixture(t);
  await update(path.join(root, 'stamps/ReactProject/settings.json'), x => { x.name = 'other'; });
  assert.equal((await box.prepare(readySentence)).code, 'INVALID_SCHEMA');
});
test('a description does not automatically create language synonyms', async t => {
  const { root, box } = await fixture(t);
  await update(path.join(root, 'stamps/ReactProject/settings.json'), x => { x.description += ' Also called a flying-banana.'; });
  assert.equal((await box.prepare('make flying-banana named x')).status, 'unsupported-language');
});
test('host write authorization is required even for complete valid inputs', async t => {
  const { root, box } = await fixture(t);
  const r = await box.prepare(readySentence);
  assert.equal((await box.execute(r.ticket)).status, 'denied');
  assert.equal(await exists(path.join(root, 'test-project')), false);
});
test('missing inputs do not cause partial writes', async t => {
  const { root, box } = await fixture(t, 'a', { allowWrites: true });
  const r = await box.prepare(sentence);
  assert.equal((await box.execute(r.ticket)).status, 'input-required');
  assert.equal(await exists(path.join(root, 'test-project')), false);
});
test('fully resolved query never writes', async t => {
  const { root, box } = await fixture(t, 'a', { allowWrites: true });
  const r = await box.prepare(`can you ${readySentence}?`);
  assert.equal(r.status, 'query-result');
  assert.equal((await box.execute(r.ticket)).status, 'query-result');
  assert.equal(await exists(path.join(root, 'test-project')), false);
});
test('execute creates React starter and verifies all planned file hashes', async t => {
  const { root, box } = await fixture(t, 'a', { allowWrites: true });
  const r = await box.prepare(readySentence);
  const done = await box.execute(r.ticket);
  assert.equal(done.status, 'completed', JSON.stringify(done));
  assert.ok(done.receipt.steps[0].files.length >= 15);
  assert.equal((await json(path.join(root, 'test-project/package.json'))).name, 'test-project');
  assert.equal(await exists(path.join(root, 'test-project/src/dashboards/StyleGuide.tsx')), true);
  assert.equal(await exists(path.join(root, 'test-project/src/components/Button/Button.tsx')), true);
  assert.equal(done.receipt.cloud_calls, 0);
});
test('optional database creates actual SQLite bytes', async t => {
  const { root, box } = await fixture(t, 'a', { allowWrites: true });
  const r = await box.prepare(`${readySentence} with a database`);
  const done = await box.execute(r.ticket);
  assert.equal(done.status, 'completed', JSON.stringify(done));
  const bytes = await readFile(path.join(root, 'test-project/data/app.sqlite'));
  assert.equal(bytes.subarray(0, 16).toString(), 'SQLite format 3\u0000');
});
test('missing-class dependency executes first, verifies, then parent resumes', async t => {
  const { root, box } = await fixture(t, 'a', { allowWrites: true });
  const pending = await box.prepare('make div with class x');
  const ready = await box.answer(pending.ticket, respond(pending, 'atom-stamp', { token: '--surface-main' }));
  assert.equal(ready.status, 'ready', JSON.stringify(ready));
  const done = await box.execute(ready.ticket);
  assert.equal(done.status, 'completed', JSON.stringify(done));
  assert.deepEqual(done.receipt.steps.map(x => x.capability), ['atom-stamp', 'div-stamp']);
  assert.equal(await exists(path.join(root, 'atoms/x/atom.css')), true);
  assert.match(await readFile(path.join(root, 'output/demo-div/index.html'), 'utf8'), /class="x"/);
});
test('Project B requirements are satisfied through targeted clarification', async t => {
  const { box } = await fixture(t, 'b', { allowWrites: true });
  const first = await box.prepare('make div with class x using token --surface-main');
  const ready = await box.answer(first.ticket, respond(first, 'atom-stamp', { theme: 'dark', exportTarget: 'public' }));
  assert.equal(ready.status, 'ready', JSON.stringify(ready));
  const done = await box.execute(ready.ticket);
  assert.equal(done.status, 'completed', JSON.stringify(done));
});
test('existing destination is not overwritten', async t => {
  const { root, box } = await fixture(t, 'a', { allowWrites: true });
  await mkdir(path.join(root, 'test-project'));
  await writeFile(path.join(root, 'test-project/keep.txt'), 'keep');
  const r = await box.prepare(readySentence), done = await box.execute(r.ticket);
  assert.equal(done.code, 'DESTINATION_EXISTS', JSON.stringify(done));
  assert.equal(await readFile(path.join(root, 'test-project/keep.txt'), 'utf8'), 'keep');
});
test('parent destination failure does not leave a newly created child', async t => {
  const { root, box } = await fixture(t, 'a', { allowWrites: true });
  await mkdir(path.join(root, 'output/demo-div'));
  const r = await box.prepare('make div with class x using token --surface-main');
  assert.equal((await box.execute(r.ticket)).code, 'DESTINATION_EXISTS');
  assert.equal(await exists(path.join(root, 'atoms/x')), false);
});
test('execution denial by host covers dependencies too', async t => {
  const { root, box } = await fixture(t, 'a', { allowWrites: true, authorize: async job => job.capability !== 'atom-stamp' });
  const r = await box.prepare('make div with class x using token --surface-main');
  assert.equal((await box.execute(r.ticket)).status, 'denied');
  assert.equal(await exists(path.join(root, 'atoms/x')), false);
});
test('same ticket cannot be executed twice in one instance', async t => {
  const { box } = await fixture(t, 'a', { allowWrites: true });
  const r = await box.prepare(readySentence);
  assert.equal((await box.execute(r.ticket)).status, 'completed');
  assert.equal((await box.execute(r.ticket)).code, 'ALREADY_EXECUTED');
});
test('concurrent duplicate execute does not clear another invocation lock', async t => {
  const { box } = await fixture(t, 'a', { allowWrites: true });
  const r = await box.prepare(readySentence);
  const first = box.execute(r.ticket);
  assert.equal((await box.execute(r.ticket)).code, 'ALREADY_EXECUTED');
  assert.equal((await box.execute(r.ticket)).code, 'ALREADY_EXECUTED');
  assert.equal((await first).status, 'completed');
});
test('same millisecond ID is an explicit alarm, not silently salted', async t => {
  const { box } = await fixture(t, 'a', { clock: () => 12345 });
  assert.equal((await box.prepare(sentence)).status, 'input-required');
  assert.equal((await box.prepare(sentence)).code, 'ID_COLLISION');
});
test('JavaScript settings require explicit host trust', async t => {
  const { root, box } = await fixture(t);
  await writeFile(path.join(root, 'stamps/ReactProject/settings.js'), 'export default ' + JSON.stringify(await json(path.join(root, 'stamps/ReactProject/settings.json')), null, 2) + ';');
  await rm(path.join(root, 'stamps/ReactProject/settings.json'));
  await update(path.join(root, 'PATHS.json'), x => { x.stamps['react-project'].settings = 'stamps/ReactProject/settings.js'; });
  assert.equal((await box.prepare(sentence)).status, 'denied');
  const trusted = createMagicBox({ projectRoot: root, allowExecutableSettings: true, clock });
  assert.equal((await trusted.prepare(sentence)).status, 'input-required');
});
test('JavaScript settings are freshly evaluated, not cached in the main process', async t => {
  const { root } = await fixture(t);
  await writeFile(path.join(root, 'stamps/ReactProject/settings.js'), 'export default ' + JSON.stringify(await json(path.join(root, 'stamps/ReactProject/settings.json')), null, 2) + ';');
  await rm(path.join(root, 'stamps/ReactProject/settings.json'));
  await update(path.join(root, 'PATHS.json'), x => { x.stamps['react-project'].settings = 'stamps/ReactProject/settings.js'; });
  const box = createMagicBox({ projectRoot: root, allowExecutableSettings: true, clock });
  assert.deepEqual((await box.prepare(sentence)).questions.map(q => q.key), ['type']);
  const source = await readFile(path.join(root, 'stamps/ReactProject/settings.js'), 'utf8');
  await writeFile(path.join(root, 'stamps/ReactProject/settings.js'), source.replace('"options": {', '"options": {"newSeat":{"type":"text","required":true},'));
  assert.deepEqual((await box.prepare(sentence)).questions.map(q => q.key), ['newSeat', 'type']);
});
test('dependency cycles stop', async t => {
  const { root, box } = await fixture(t);
  await update(path.join(root, 'PATHS.json'), x => { x.stamps['atom-stamp'].dependencies = [{ capability: 'atom-stamp', field: 'name', catalog: 'classes', bindings: { name: 'name' } }]; });
  assert.equal((await box.prepare('make div with class x')).code, 'DEPENDENCY_CYCLE');
});
test('path traversal request is refused', async t => {
  const { box } = await fixture(t);
  const r = await box.prepare('make react project named test-project location "../out" type app');
  assert.equal(r.code, 'INVALID_PATH');
});
test('symlink destination is refused', async t => {
  const { root, temp, box } = await fixture(t);
  const outside = path.join(temp, 'outside');
  await mkdir(outside);
  await symlink(outside, path.join(root, 'shortcut'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal((await box.prepare('make react project named test-project location shortcut type app')).code, 'INVALID_PATH');
});
test('malformed plan is refused before mutation writes', async t => {
  const { root, box } = await fixture(t, 'a', { allowWrites: true });
  await writeFile(path.join(root, 'stamps/ReactProject/stamp.mjs'), 'export const plan = () => ({ destination: "../escape", files: [{path:"x.txt",text:"x"}] });');
  const r = await box.prepare(readySentence);
  assert.equal((await box.execute(r.ticket)).code, 'INVALID_PATH');
});
test('stamp stdout must be a single structured plan', async t => {
  const { root, box } = await fixture(t, 'a', { allowWrites: true });
  await writeFile(path.join(root, 'stamps/ReactProject/stamp.mjs'), 'export const plan = () => { console.log("hey"); return {}; };');
  const r = await box.prepare(readySentence);
  assert.equal((await box.execute(r.ticket)).code, 'INVALID_STAMP_OUTPUT');
});
test('changed token catalog is rechecked before execution', async t => {
  const { root, box } = await fixture(t, 'a', { allowWrites: true });
  const r = await box.prepare('make div with class x using token --surface-main');
  await update(path.join(root, 'tokens.json'), x => { x.values = []; });
  assert.equal((await box.execute(r.ticket)).status, 'invalid-input');
  assert.equal(await exists(path.join(root, 'atoms/x')), false);
});

test('one pending seat accepts a bare textual reply without repeating the request', async t => {
  const { box } = await fixture(t);
  const r = await box.prepare(sentence);
  const next = await box.answerText(r.ticket, 'app');
  assert.equal(next.status, 'ready');
  assert.equal(next.frames[0].options.type, 'app');
});
test('multi-field text reply binds the declared fields in either order', async t => {
  const { box } = await fixture(t, 'b');
  const r = await box.prepare(sentence);
  const next = await box.answerText(r.ticket, 'theme dark type app');
  assert.equal(next.status, 'ready', JSON.stringify(next));
  assert.equal(next.frames[0].options.theme, 'dark');
});
test('bare reply is ambiguous when several seats are pending', async t => {
  const { box } = await fixture(t, 'b');
  const r = await box.prepare(sentence);
  assert.equal((await box.answerText(r.ticket, 'app')).status, 'ambiguous');
});
test('UI supplied return address disambiguates a bare reply', async t => {
  const { box } = await fixture(t, 'b');
  const r = await box.prepare(sentence);
  const next = await box.answerText(r.ticket, 'app', { stamp: 'react-project', key: 'type' });
  assert.equal(next.status, 'input-required');
  assert.deepEqual(next.questions.map(q => q.key), ['theme']);
});
test('text reply never discards extra words', async t => {
  const { box } = await fixture(t);
  const r = await box.prepare(sentence);
  assert.equal((await box.answerText(r.ticket, 'app and delete files')).status, 'unsupported-language');
});
test('adding a brand-new stamp uses the same house schema and parser', async t => {
  const { root, box } = await fixture(t, 'a', { allowWrites: true });
  const directory = path.join(root, 'stamps/Note');
  await mkdir(directory);
  await writeFile(path.join(directory, 'settings.json'), JSON.stringify({ id: 88, name: 'note-stamp', title: 'Note', description: 'Create a note', date_added: 1789380000000, options: { name: { required: true, type: 'text', validate: 'project-name', language: { prefixes: ['named'] } }, message: { required: true, type: 'text', language: { prefixes: ['saying'] } } } }));
  await writeFile(path.join(directory, 'stamp.mjs'), 'export const plan = ({options}) => ({destination:`output/${options.name}`,files:[{path:"note.txt",text:options.message}]});');
  await update(path.join(root, 'PATHS.json'), x => { x.stamps['note-stamp'] = { settings: 'stamps/Note/settings.json', script: 'stamps/Note/stamp.mjs', language: { verbs: ['make'], names: ['note'] }, write_roots: ['output'] }; });
  const ready = await box.prepare('make note saying "Keep the original caller" named resume');
  assert.equal(ready.status, 'ready', JSON.stringify(ready));
  assert.equal((await box.execute(ready.ticket)).status, 'completed');
  assert.equal(await readFile(path.join(root, 'output/resume/note.txt'), 'utf8'), 'Keep the original caller');
});

test('optional undefined in an in-process canonical request is rejected, not dropped', async t => {
  const { box } = await fixture(t);
  const result = await box.prepare({ mode: 'command', capability: 'react-project', options: { name: 'x', location: '.', type: 'app', add_database: undefined } });
  assert.equal(result.status, 'invalid-input');
});
test('malformed pending input is revalidated on resume', async t => {
  const { box } = await fixture(t);
  const r = await box.prepare(sentence);
  r.ticket.answers = [{ request_id: r.ticket.id, stamp: 'react-project', values: { type: 'unknown' } }];
  assert.equal((await box.resume(r.ticket)).status, 'invalid-input');
});
