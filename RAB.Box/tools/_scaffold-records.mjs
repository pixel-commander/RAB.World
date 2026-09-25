import path from 'node:path';
import { validateSignalContract } from '../bridge/tool-contract.mjs';
import { makeSignalSettings } from '../bridge/rab-node.mjs';

// Opted-in template records get destination identities, never source identities.
export const stampScaffoldRecords = async ({ files, target, memory, projectName }) => {
  const records = new Map();
  for (const file of files) {
    if (file.path.endsWith('.json') && file.text !== undefined) {
      const value = JSON.parse(file.text);
      if (value?._scaffold === true || (path.posix.basename(file.path) === 'settings.json' && typeof value?.signal === 'boolean')) records.set(file.path, value);
    }
  }
  if (!records.size) return files;
  for (const [file, value] of records) {
    if (path.posix.basename(file) !== 'settings.json' || typeof value.signal !== 'boolean') continue;
    const contractPath = path.posix.join(path.posix.dirname(file), 'contract.json');
    const contract = files.find(item => item.path === contractPath);
    if (!contract || contract.text === undefined) throw new Error(`Signal template missing ${contractPath}`);
    validateSignalContract(JSON.parse(contract.text));
  }
  const ids = await memory.allocateIds(records.size);
  const date = new Date().toISOString();
  let index = 0;
  for (const [file, value] of records) {
    if (path.posix.basename(file) === 'settings.json' && typeof value.signal === 'boolean') {
      records.set(file, makeSignalSettings({ ...value, id: ids[index++], date_created: Date.now(), date_modified: Date.now() }));
      continue;
    }
    delete value._scaffold;
    Object.assign(value, { id: ids[index++], date_added: date, path: path.resolve(target, path.posix.dirname(file)) });
    if (projectName !== undefined) value.project_name = projectName;
    if (Object.hasOwn(value, 'created')) value.created = date;
    if (Object.hasOwn(value, 'modified')) value.modified = date;
    if (path.posix.basename(file) === 'beacon.json') value.beacon = 'on';
  }
  for (const [file, value] of records) {
    if (path.posix.basename(file) !== 'manifest.json') continue;
    const folder = path.posix.dirname(file);
    value.items = [...records].filter(([key]) => path.posix.basename(key) === 'settings.json' &&
      path.posix.dirname(path.posix.dirname(key)) === folder).map(([key, item]) => ({
      id: item.id, name: item.name, title: item.title ?? item.name,
      description: item.description ?? '', type: item.type,
      path: path.posix.relative(folder, path.posix.dirname(key)),
      signal: item.signal, transmitting: item.transmitting
    }));
  }
  return files.map(file => records.has(file.path) ? { ...file, text: JSON.stringify(records.get(file.path), null, 2) + '\n' } : file);
};
