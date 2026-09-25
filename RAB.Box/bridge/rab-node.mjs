import { assertNumericId } from './rab-id.mjs';

export const NODE_VERSION = 'rab-node/v1';
export const NODE_KINDS = Object.freeze(['app', 'project', 'session', 'request', 'group', 'step', 'turn', 'execution', 'receipt', 'failure']);
const kinds = new Set(NODE_KINDS);
const requestTypes = new Set(['tool', 'feature', 'ui', 'stamp']);
const unsafeKeys = new Set(['__proto__', 'prototype', 'constructor']);
const fail = message => { throw Object.assign(new Error(message), { code: 'BAD_NODE' }); };
const plain = value => value !== null && typeof value === 'object' && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const text = value => typeof value === 'string' && value.trim().length > 0;

const dataProperties = (value, array = false) => {
  if (Object.getOwnPropertySymbols(value).length) fail('Node data must not contain symbol keys.');
  const entries = Object.entries(Object.getOwnPropertyDescriptors(value));
  for (const [key, descriptor] of entries) {
    if (array && key === 'length') continue;
    if (unsafeKeys.has(key) || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) fail(`Unsupported node property: ${key}.`);
  }
  return entries;
};

// Validate before cloning: JSON serialization must not silently drop values,
// execute getters/toJSON, coerce dates, or replace non-finite numbers with null.
const assertJson = root => {
  const ancestors = new Set();
  let visited = 0;
  const visit = (value, depth) => {
    if (++visited > 100_000 || depth > 64) fail('Node data exceeds validation bounds.');
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
    if (typeof value === 'number' && Number.isFinite(value)) return;
    if (!Array.isArray(value) && !plain(value)) fail('Node data must contain only JSON values.');
    if (ancestors.has(value)) fail('Node data must not contain cycles.');
    ancestors.add(value);
    const entries = dataProperties(value, Array.isArray(value));
    if (Array.isArray(value)) {
      if (value.length > 100_000 || entries.length !== value.length + 1) fail('Node arrays must be dense and contain no extra properties.');
      for (let index = 0; index < value.length; index++) {
        if (!Object.hasOwn(value, index)) fail('Node arrays must be dense.');
        visit(value[index], depth + 1);
      }
    } else {
      for (const [, descriptor] of entries) visit(descriptor.value, depth + 1);
    }
    ancestors.delete(value);
  };
  visit(root, 0);
};

export const assertNode = node => {
  if (!plain(node)) fail('Node must be a plain object.');
  assertJson(node);
  if (node.version !== NODE_VERSION) fail('Unsupported node version.');
  assertNumericId(node.id);
  if (!text(node.name) || !text(node.title) || typeof node.description !== 'string') fail('Node needs name, title and a string description.');
  if (!Array.isArray(node.settings)) fail('settings must be an input declaration array.');
  if (!plain(node.meta) || !kinds.has(node.meta.kind)) fail('Unsupported or missing meta.kind.');
  const names = new Set();
  for (const field of node.settings) {
    if (!plain(field) || !text(field.name) || unsafeKeys.has(field.name) || !text(field.type)) fail('Each setting needs a safe name and input type.');
    if (names.has(field.name)) fail(`Duplicate setting: ${field.name}.`);
    if (Object.hasOwn(field, 'required') && typeof field.required !== 'boolean') fail('Setting required must be boolean.');
    names.add(field.name);
  }
  if (node.meta.parent !== undefined && node.meta.parent !== null) {
    if (!plain(node.meta.parent) || !kinds.has(node.meta.parent.kind)) fail('Parent must be a typed numeric node reference.');
    assertNumericId(node.meta.parent.id);
    if (node.meta.parent.id === node.id) fail('A node cannot parent itself.');
  }
  if (node.meta.kind === 'project') {
    if (!text(node.type)) fail('Project type is required; it is not the node role.');
    if (node.paths !== undefined && !plain(node.paths)) fail('Project paths must be an object.');
  }
  if (node.meta.kind === 'request' && !requestTypes.has(node.type)) fail('Request type must be tool, feature, ui or stamp.');
  return node;
};

// Construction is pure: no allocation, persistence, inherited bag mutation or
// execution permission. Typed extension values are retained, never truthy-merged.
export const makeNode = input => {
  if (!plain(input)) fail('Node input must be a plain object.');
  dataProperties(input);
  const node = { ...input };
  if (node.version === undefined) node.version = NODE_VERSION;
  if (node.settings === undefined) node.settings = [];
  if (node.meta === undefined) node.meta = {};
  assertNode(node);
  return JSON.parse(JSON.stringify(node));
};

// Item descriptors use the same house identity and JSON-safety contract without
// claiming to be a runtime node kind. Allocation belongs to the caller.
export const assertItemSettings = item => {
  if (!plain(item)) fail('Item settings must be a plain object.');
  assertJson(item);
  assertNumericId(item.id);
  if (!text(item.name) || !text(item.title) || typeof item.description !== 'string') fail('Item settings need name, title and a string description.');
  if (!Array.isArray(item.settings)) fail('Item settings need an input declaration array.');
  if (!plain(item.meta)) fail('Item settings need a meta object.');
  if (item.indexed !== undefined && typeof item.indexed !== 'boolean') fail('indexed must be boolean.');
  const names = new Set();
  for (const field of item.settings) {
    if (!plain(field) || !text(field.name) || unsafeKeys.has(field.name) || !text(field.type)) fail('Each setting needs a safe name and input type.');
    if (names.has(field.name)) fail(`Duplicate setting: ${field.name}.`);
    if (Object.hasOwn(field, 'required') && typeof field.required !== 'boolean') fail('Setting required must be boolean.');
    names.add(field.name);
  }
  return item;
};

export const makeItemSettings = input => {
  if (!plain(input)) fail('Item settings input must be a plain object.');
  dataProperties(input);
  const item = { ...input };
  if (item.indexed === undefined) item.indexed = true;
  assertItemSettings(item);
  return JSON.parse(JSON.stringify(item));
};
