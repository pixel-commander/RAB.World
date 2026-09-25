import path from 'node:path';

export const resolveDestination = (value, context) => {
  const requireValue = (condition, message) => {
    if (!condition) throw Object.assign(new Error(message), { code: 'BAD_INPUT' });
  };
  const root = context?.project?.root;
  if (root !== undefined) requireValue(typeof root === 'string' && path.isAbsolute(root), 'The selected world needs an absolute source root.');
  requireValue(typeof value === 'string' && value.trim().length > 0, 'path is required.');
  const relative = value.replaceAll('\\', '/');
  requireValue(!relative.includes('\0'), 'path must not contain null characters.');
  if (root !== undefined) {
    requireValue(!path.posix.isAbsolute(relative) && !path.win32.isAbsolute(relative) && !relative.includes(':') && !relative.split('/').includes('..'), 'path must stay relative to the selected world.');
  } else {
    requireValue(path.isAbsolute(value) && (process.platform !== 'win32' || /^(?:[A-Za-z]:\/|\/\/[^/]+\/[^/]+)/.test(relative)), 'Without a selected world, supply an absolute folder path.');
  }
  const folder = root === undefined ? path.resolve(value) : path.resolve(root, relative);
  return { folder, allowedRoot: root ?? folder, path: root === undefined ? folder : path.posix.normalize(relative) };
};
