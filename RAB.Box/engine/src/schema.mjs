import { record, own, safeKey, insist, fail, every, requireRecord } from './core.mjs';

const supportedTypes = new Set(['text', 'boolean', 'number']);

export const normalizeOptions = options => {
  insist(record(options) || Array.isArray(options), 'INVALID_SCHEMA', 'options must be an object or an array with explicit key fields.');
  const entries = Array.isArray(options) ? options.map(item => {
    requireRecord(item, 'option');
    const { key, ...field } = item;
    return [key, field];
  }) : Object.entries(options);
  const result = {};
  for (const [key, field] of entries) {
    insist(safeKey(key) && !own(result, key), 'INVALID_SCHEMA', 'Option keys must be safe and unique.', { key });
    requireRecord(field, `options.${key}`);
    insist(typeof field.required === 'boolean', 'INVALID_SCHEMA', `options.${key}.required must be true or false.`);
    insist(supportedTypes.has(field.type), 'INVALID_SCHEMA', `Unsupported type for ${key}; use "text", "boolean", or "number".`, { type: field.type });
    if (field.enum !== undefined) insist(Array.isArray(field.enum) && field.enum.length > 0, 'INVALID_SCHEMA', `${key}.enum must be a nonempty array.`);
    if (field.role !== undefined) insist(safeKey(field.role), 'INVALID_SCHEMA', `${key}.role must be a semantic identifier.`);
    if (field.question !== undefined) insist(typeof field.question === 'string', 'INVALID_SCHEMA', `${key}.question must be text.`);
    if (field.validate !== undefined) insist(['project-name', 'identifier', 'css-class', 'css-token', 'relative-directory'].includes(field.validate), 'INVALID_SCHEMA', `Unknown validator on ${key}.`);
    if (field.catalog !== undefined) insist(safeKey(field.catalog), 'INVALID_SCHEMA', `Invalid catalog on ${key}.`);
    if (field.language !== undefined) {
      requireRecord(field.language, `${key}.language`);
      for (const list of ['prefixes', 'true', 'false']) if (field.language[list] !== undefined)
        insist(Array.isArray(field.language[list]) && field.language[list].every(x => typeof x === 'string' && x.trim()), 'INVALID_SCHEMA', `${key}.language.${list} must contain phrases.`);
      if (field.language.references !== undefined) requireRecord(field.language.references, `${key}.language.references`);
    }
    result[key] = { ...field };
    for (const value of [...(field.enum ?? []), ...(own(field, 'default') ? [field.default] : [])])
      insist(validateValue(key, value, result[key]).length === 0, 'INVALID_SCHEMA', `Invalid enum/default on ${key}.`);
  }
  return result;
};

export const normalizeSettings = (settings, reservedName) => {
  requireRecord(settings, 'settings');
  insist((typeof settings.id === 'string' && settings.id.length > 0) || Number.isSafeInteger(settings.id), 'INVALID_SCHEMA', 'settings.id must be an existing string or safe integer.');
  insist(settings.name === reservedName, 'INVALID_SCHEMA', 'Reserved name and settings.name disagree.', { reservedName, received: settings.name });
  for (const key of ['title', 'description']) insist(typeof settings[key] === 'string' && settings[key].length > 0, 'INVALID_SCHEMA', `${key} is required.`);
  if (settings.date_added !== undefined) insist(typeof settings.date_added === 'string' || Number.isSafeInteger(settings.date_added), 'INVALID_SCHEMA', 'date_added must be a date string or epoch-ms integer.');
  return { ...settings, options: normalizeOptions(settings.options) };
};

export const validateValue = (key, value, field) => {
  const errors = [];
  const wrong = reason => errors.push({ field: key, reason, value });
  if (field.type === 'text' && (typeof value !== 'string' || !value.trim() || value.length > 2048 || /[\x00-\x1f]/u.test(value))) wrong('Expected nonempty text without control characters.');
  if (field.type === 'boolean' && typeof value !== 'boolean') wrong('Expected a Boolean, not a string.');
  if (field.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) wrong('Expected a finite number.');
  if (errors.length) return errors;
  if (field.enum && !field.enum.some(x => Object.is(x, value))) wrong('Value is not one of the declared choices.');
  const checks = {
    'project-name': /^[a-z][a-z0-9-]{0,63}$/,
    identifier: /^[A-Z][A-Za-z0-9]{0,63}$/,
    'css-class': /^[A-Za-z_][A-Za-z0-9_-]{0,79}$/,
    'css-token': /^--[A-Za-z_][A-Za-z0-9_-]{0,79}$/,
  };
  if (checks[field.validate] && !checks[field.validate].test(value)) wrong(`Does not satisfy ${field.validate}.`);
  return errors;
};

export const validateSeats = (settings, supplied) => {
  requireRecord(supplied, 'supplied options');
  const values = { ...supplied }, defaults = [], errors = [];
  for (const key of Object.keys(values)) if (!own(settings.options, key)) errors.push({ field: key, reason: 'Undeclared seat.' });
  const seats = Object.entries(settings.options).map(([key, field]) => {
    if (!own(values, key) && own(field, 'default')) { values[key] = field.default; defaults.push(key); }
    const present = own(values, key);
    const localErrors = present ? validateValue(key, values[key], field) : [];
    errors.push(...localErrors);
    return { key, required: field.required, satisfied: present && localErrors.length === 0 };
  });
  const missing = seats.filter(x => x.required && !x.satisfied && !own(values, x.key)).map(x => x.key);
  return { values, defaults, errors, missing, seats, requiredPass: every(x => x.required)(x => x.satisfied)(seats) };
};
