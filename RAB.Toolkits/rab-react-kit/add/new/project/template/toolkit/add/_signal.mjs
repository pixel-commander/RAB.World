import path from 'node:path';
import { readFile } from 'node:fs/promises';

// Templates own defaults. Callers supply the identity and values already gathered.
export const createSignalSettings = async ({ templateUrl, folder, values, options = {}, context = {}, helpers }) => {
  const { id: placeholder, ...defaults } = JSON.parse(await readFile(templateUrl, 'utf8'));
  const root = context.project?.root;
  const relative = root ? path.relative(root, folder) : null;
  const locator = relative !== null && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative)
    ? relative.split(path.sep).join('/') || '.' : path.resolve(folder);
  const record = { ...defaults, ...values, path: locator,
    meta: { ...values.meta, ...defaults.meta } };
  for (const key of ['title', 'description', 'transmitting', 'indexed']) {
    if (options[key] !== undefined) record[key] = options[key];
  }
  if (typeof record.transmitting !== 'boolean')
    throw Object.assign(new Error('transmitting must be boolean.'), { code: 'BAD_INPUT' });
  return helpers.createItemSettings(record);
};
