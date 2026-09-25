import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { assertBeacon } from './validate.mjs';

const requireValue = (condition, message) => {
  if (!condition) throw Object.assign(new Error(message), { code: 'BAD_INPUT' });
};

export const run = async ({ options, context, tool, helpers }) => {
  const projectRoot = context?.project?.root;
  if (projectRoot !== undefined) requireValue(typeof projectRoot === 'string' && path.isAbsolute(projectRoot), 'The selected world needs an absolute source root.');
  for (const key of ['name', 'path']) {
    requireValue(typeof options[key] === 'string' && options[key].trim().length > 0, `${key} is required.`);
  }
  const title = options.title === undefined ? options.name : options.title;
  const description = options.description === undefined ? '' : options.description;
  const types = options.types === undefined ? [] : options.types;
  requireValue(typeof title === 'string' && typeof description === 'string', 'title and description must be text.');
  const relative = options.path.replaceAll('\\', '/');
  requireValue(!relative.includes('\0'), 'path must not contain null characters.');
  if (projectRoot !== undefined) {
    requireValue(!path.posix.isAbsolute(relative) && !path.win32.isAbsolute(relative) && !relative.includes(':') && !relative.split('/').includes('..'), 'path must stay relative to the selected world.');
  } else {
    requireValue(path.isAbsolute(options.path) && (process.platform !== 'win32' || /^(?:[A-Za-z]:\/|\/\/[^/]+\/[^/]+)/.test(relative)), 'Without a selected world, supply an absolute folder path.');
  }
  const folder = projectRoot === undefined ? path.resolve(options.path) : path.resolve(projectRoot, relative);
  const fields = tool.settings;
  const allowedTypes = fields.find(field => field.name === 'types').items.enum;
  requireValue(Array.isArray(types) && types.every(type => allowedTypes.includes(type)), `types must be an array containing only: ${allowedTypes.join(', ')}.`);
  requireValue(new Set(types).size === types.length, 'types must not repeat.');
  const reachField = fields.find(field => field.name === 'reach');
  const reach = options.reach === undefined ? [...reachField.default] : options.reach;
  requireValue(Array.isArray(reach) && reach.every(value => reachField.items.enum.includes(value)), 'reach must be an array containing only world and project.');
  requireValue(new Set(reach).size === reach.length, 'reach must not repeat.');
  const stateField = fields.find(field => field.name === 'beacon');
  const state = options.beacon === undefined ? stateField.default : options.beacon;
  requireValue(stateField.enum.includes(state), 'beacon must be on or off.');

  const template = JSON.parse(await readFile(new URL('./template/beacon.json', import.meta.url), 'utf8'));
  const identity = await helpers.createItemSettings({ name: options.name, title: options.name, description, settings: [], meta: { kind: 'beacon' } });
  const values = { name: options.name, id: identity.id, title, description, date_added: new Date().toISOString(), path: projectRoot === undefined ? folder : path.posix.normalize(relative), types: [...types], beacon: state, reach: [...reach] };
  const beacon = Object.fromEntries(Object.keys(template).map(key => [key, Object.hasOwn(values, key) ? values[key] : template[key]]));
  await assertBeacon(beacon);
  const verification = await helpers.writeArtifactPlan({ destination: folder, allowedRoot: projectRoot ?? folder, uniqueDirectory: false, files: [{ path: 'beacon.json', text: JSON.stringify(beacon, null, 2) + '\n' }] });
  return { status: 'created', beacon, file: path.join(folder, 'beacon.json'), verification };
};
