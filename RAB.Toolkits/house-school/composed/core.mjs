import { createHash } from 'node:crypto';

export const hash = (value) => createHash('sha256').update(String(value)).digest('hex');
export const rank = (seed, key) => parseInt(hash(`${seed}:${key}`).slice(0, 8), 16) / 0x100000000;
export const choose = (seed, key, amount) => rank(seed, key) < amount;
export const seat = (ctx, family, suffix, good, bad) => {
  const token = `__SEAT_${ctx.level}_${ctx.seats.length}__`;
  ctx.seats.push({ id: `${ctx.level}:${family}:${suffix}`, family, level: ctx.level,
    file: ctx.file, token, good, bad });
  return token;
};
export const enabled = (ctx, feature) => {
  const rule = ctx.knobs.features[feature];
  return rule.enabled && choose(rule.seed ?? ctx.knobs.seed, `${feature}:${ctx.level}`, rule.coverage);
};
export const featureNames = ['classes', 'container-atom', 'action-atom', 'effect-atom', 'css', 'data-grid', 'house-handlers', 'bags', 'loops'];
export const normalize = (input = {}) => {
  const knobs = { seed: 1, depth: 3, width: 2, areas: 3, atomTypes: 3, houseKeyCoverage: 0.5, ...input, features: {}, errors: input.errors || {} };
  if (!Number.isFinite(knobs.houseKeyCoverage) || knobs.houseKeyCoverage < 0 || knobs.houseKeyCoverage > 1) throw new RangeError('houseKeyCoverage');
  for (const [name, low, high] of [['depth', 1, 32], ['width', 1, 8], ['atomTypes', 0, 3]]) {
    if (!Number.isInteger(knobs[name]) || knobs[name] < low || knobs[name] > high) throw new RangeError(name);
  }
  if (![2, 3, 5].includes(knobs.areas)) throw new RangeError('areas must be 2, 3, or 5 (supported House grids)');
  for (const name of Object.keys(input.features || {})) if (!featureNames.includes(name)) throw new Error(`Unknown feature ${name}`);
  for (const name of featureNames) {
    const group = ['css', 'data-grid'].includes(name) ? input.groups?.layout : undefined;
    const config = { enabled: true, coverage: 1, ...group, ...input.features?.[name] };
    if (typeof config.enabled !== 'boolean' || !Number.isFinite(config.coverage) || config.coverage < 0 || config.coverage > 1) throw new RangeError(name);
    knobs.features[name] = config;
  }
  return knobs;
};
