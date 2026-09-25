import { createHash } from 'node:crypto';
import path from 'node:path';
import { lstat, realpath } from 'node:fs/promises';

export const every = P => Q => domain => domain.every(x => !P(x) || Q(x));
export const own = (value, key) => Object.hasOwn(value, key);
export const record = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
export const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const hash = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
export const fail = (code, message, details = {}) => { throw Object.assign(new Error(message), { code, details }); };
export const insist = (value, code, message, details) => { if (!value) fail(code, message, details); };
export const safeKey = key => typeof key === 'string' && /^[A-Za-z][A-Za-z0-9_.-]*$/.test(key) && !['__proto__', 'prototype', 'constructor'].includes(key);
export const requireRecord = (value, label) => insist(record(value), 'INVALID_SCHEMA', `${label} must be an object.`);
export const clone = value => JSON.parse(JSON.stringify(value));
export const fault = error => ({ status: ({ AMBIGUOUS: 'ambiguous', CONFLICT: 'conflict', DENIED: 'denied', STALE_CONTRACT: 'stale-contract', UNSUPPORTED_LANGUAGE: 'unsupported-language', LOOKUP_FAILED: 'lookup-failed', CAPABILITY_UNAVAILABLE: 'capability-unavailable', INVALID_INPUT: 'invalid-input' })[error.code] ?? 'error', code: error.code ?? 'INTERNAL_ERROR', message: error.message, details: error.details ?? {}, authority: 0 });

export const relativePath = value => {
  insist(typeof value === 'string' && value.length > 0 && value.length < 4096, 'INVALID_PATH', 'Supply a nonempty project-relative path.');
  insist(!/[\x00-\x1f<>:"|?*]/u.test(value), 'INVALID_PATH', 'This path contains unsupported or unsafe characters.');
  insist(!path.posix.isAbsolute(value) && !path.win32.isAbsolute(value), 'INVALID_PATH', 'Only project-relative paths are allowed.');
  const parts = value.replaceAll('\\', '/').split('/');
  insist(!parts.includes('..') && !parts.some(part => /[. ]$/.test(part) && part !== '.' || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)), 'INVALID_PATH', 'Traversal and ambiguous Windows path segments are not allowed.');
  return parts.filter(part => part && part !== '.').join('/') || '.';
};

export const containedPath = async (root, relative, { allowMissing = false } = {}) => {
  const clean = relativePath(relative);
  const canonicalRoot = await realpath(root);
  let current = canonicalRoot;
  for (const part of clean === '.' ? [] : clean.split('/')) {
    current = path.join(current, part);
    try {
      const info = await lstat(current);
      insist(!info.isSymbolicLink(), 'INVALID_PATH', 'Symlink/junction traversal is not allowed by this adapter.', { relative });
    } catch (error) {
      if (error.code === 'ENOENT' && allowMissing) continue;
      throw error;
    }
  }
  const rel = path.relative(canonicalRoot, current);
  insist(!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel), 'INVALID_PATH', 'Path leaves the selected project.');
  return current;
};

export const bind = (bindings, evidence, key, value, source) => {
  insist(safeKey(key), 'INVALID_INPUT', 'Invalid seat name.', { key });
  if (own(bindings, key) && !equal(bindings[key], value)) fail('CONFLICT', `Two different values target ${key}.`, { key, existing: bindings[key], incoming: value, source });
  bindings[key] = value;
  evidence[key] = [...(evidence[key] ?? []), source];
};
