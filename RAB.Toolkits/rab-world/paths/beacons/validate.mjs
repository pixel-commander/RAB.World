import { readFile } from 'node:fs/promises';

// The creator and audits use this owner. Keys/enums come from its current files.
export const assertBeacon = async value => {
  const fail = message => { throw Object.assign(new Error(message), { code: 'BAD_BEACON' }); };
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Beacon must be an object.');
  const template = JSON.parse(await readFile(new URL('./template/beacon.json', import.meta.url), 'utf8'));
  const definition = JSON.parse(await readFile(new URL('./settings.json', import.meta.url), 'utf8'));
  for (const key of Object.keys(template)) if (!Object.hasOwn(value, key)) fail(`Missing beacon field: ${key}.`);
  if (!Number.isSafeInteger(value.id) || value.id <= 0) fail('Beacon id must be a positive numeric timestamp.');
  for (const key of ['name', 'title', 'path']) if (typeof value[key] !== 'string' || !value[key].trim()) fail(`${key} must be nonempty text.`);
  if (typeof value.description !== 'string') fail('description must be text.');
  if (typeof value.date_added !== 'string' || !Number.isFinite(Date.parse(value.date_added))) fail('date_added must be an ISO date string.');
  for (const key of ['types', 'reach']) {
    const allowed = definition.settings.find(field => field.name === key).items.enum;
    if (!Array.isArray(value[key]) || value[key].some(item => !allowed.includes(item)) || new Set(value[key]).size !== value[key].length) fail(`Invalid ${key} array.`);
  }
  if (!definition.settings.find(field => field.name === 'beacon').enum.includes(value.beacon)) fail('Invalid beacon state.');
  if (value.world !== undefined && (!Number.isSafeInteger(value.world) || value.world <= 0)) fail('world must be a positive numeric ID.');
  return value;
};
