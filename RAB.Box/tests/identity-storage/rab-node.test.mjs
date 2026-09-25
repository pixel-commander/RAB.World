import test from 'node:test';
import assert from 'node:assert/strict';
import { makeNode, assertNode, makeItemSettings, assertItemSettings, NODE_VERSION, NODE_KINDS } from '../../bridge/rab-node.mjs';

const input = (kind = 'session') => ({ id: 1789920825354, name: 'work', title: 'Work', description: '', meta: { kind } });

test('constructs common core with detached defaults and typed role', () => {
  const source = input();
  const node = makeNode(source);
  assert.equal(node.version, NODE_VERSION);
  assert.deepEqual(node.settings, []);
  assert.equal(assertNode(node), node);
  node.meta.note = 'changed';
  assert.equal(source.meta.note, undefined);
  assert.equal(source.settings, undefined);
});

test('preserves false, zero, empty string, null and typed extensions', () => {
  const source = { ...input('project'), type: 'react', paths: { styles: '' }, enabled: false, count: 0,
    settings: [{ name: 'enabled', type: 'boolean', required: false, value: false }, { name: 'limit', type: 'number', value: 0 }, { name: 'label', type: 'text', value: '' }, { name: 'optional', type: 'text', value: null }] };
  const node = makeNode(source);
  assert.equal(node.type, 'react');
  assert.deepEqual(node.paths, { styles: '' });
  assert.equal(node.enabled, false);
  assert.equal(node.count, 0);
  assert.deepEqual(node.settings, source.settings);
  node.settings[0].value = true;
  assert.equal(source.settings[0].value, false);
});

test('no legacy IDs, unknown roles, or invalid core values', () => {
  for (const change of [{ id: '123' }, { name: '' }, { title: false }, { description: null }, { version: 'old' }, { meta: { kind: 'category' } }, { meta: null }, { settings: null }]) {
    assert.throws(() => makeNode({ ...input(), ...change }));
  }
  for (const kind of NODE_KINDS) {
    const value = { ...input(kind), ...(kind === 'project' ? { type: 'audit' } : kind === 'request' ? { type: 'feature' } : kind === 'world' ? { paths: [] } : {}) };
    assert.equal(makeNode(value).meta.kind, kind);
  }
});

test('settings are declarations with unique safe names, not runtime state', () => {
  for (const settings of [{ foo: true }, [{}], [{ name: 'foo' }], [{ name: 'foo', type: 'text', required: 0 }], [{ name: 'constructor', type: 'text' }], [{ name: 'x', type: 'text' }, { name: 'x', type: 'number' }]]) {
    assert.throws(() => makeNode({ ...input(), settings }), { code: 'BAD_NODE' });
  }
});

test('request and project type meanings are not conflated', () => {
  for (const type of ['tool', 'feature', 'ui', 'stamp']) assert.equal(makeNode({ ...input('request'), type }).type, type);
  assert.throws(() => makeNode({ ...input('request'), type: 'react' }), { code: 'BAD_NODE' });
  assert.throws(() => makeNode(input('project')), { code: 'BAD_NODE' });
  assert.throws(() => makeNode({ ...input('project'), type: 'react', paths: [] }), { code: 'BAD_NODE' });
  assert.deepEqual(makeNode({ ...input('world'), paths: [] }).paths, []);
  assert.throws(() => makeNode({ ...input('world'), paths: {} }), { code: 'BAD_NODE' });
});

test('parent references are typed numeric records, not self or legacy strings', () => {
  const node = input();
  node.meta.parent = { kind: 'project', id: node.id - 1 };
  assert.deepEqual(makeNode(node).meta.parent, node.meta.parent);
  for (const parent of [{ kind: 'project', id: node.id }, { kind: 'project', id: 'old' }, { kind: 'unknown', id: 1 }]) {
    assert.throws(() => makeNode({ ...input(), meta: { kind: 'session', parent } }));
  }
});

test('rejects lossy/non-JSON data and cycles without invoking getters', () => {
  const cycle = {}; cycle.self = cycle;
  for (const bad of [undefined, NaN, Infinity, 1n, () => {}, new Date(), new Map(), cycle, [, 1]]) {
    assert.throws(() => makeNode({ ...input(), extra: bad }), { code: 'BAD_NODE' });
  }
  let invoked = false;
  const getter = { ...input(), get extra() { invoked = true; return 1; } };
  assert.throws(() => makeNode(getter), { code: 'BAD_NODE' });
  assert.equal(invoked, false);
  assert.throws(() => makeNode({ ...input(), extra: JSON.parse('{"__proto__":{"polluted":true}}') }), { code: 'BAD_NODE' });
  assert.equal({}.polluted, undefined);
});

test('undefined defaults fill; null is not treated as absent; JSON round trip stable', () => {
  const node = makeNode({ ...input(), version: undefined, settings: undefined });
  assert.deepEqual(JSON.parse(JSON.stringify(node)), node);
  assert.throws(() => makeNode({ ...input(), version: null }), { code: 'BAD_NODE' });
});

test('item settings preserve extensions and explicit indexed false without a runtime node kind', () => {
  const source = { id: 1789920825354, name: 'Panel', title: 'Panel', description: '',
    settings: [{ name: 'visible', type: 'boolean', required: false, default: false }],
    meta: { kind: 'component', reason: '' }, indexed: false, count: 0, optional: '', enabled: false };
  const item = makeItemSettings(source);
  assert.equal(assertItemSettings(item), item);
  assert.deepEqual(item, source);
  item.meta.reason = 'edited';
  assert.equal(source.meta.reason, '');
  assert.equal(makeItemSettings({ ...source, indexed: undefined }).indexed, true);
});

test('item settings reject invented identities, invalid indexed values and lossy extensions', () => {
  const source = { id: 1789920825354, name: 'Panel', title: 'Panel', description: '', settings: [], meta: {} };
  for (const change of [{ id: '1789920825354' }, { indexed: null }, { indexed: 0 }, { settings: [{ name: 'x', type: 'text' }, { name: 'x', type: 'text' }] }, { extra: NaN }]) {
    assert.throws(() => makeItemSettings({ ...source, ...change }));
  }
});
