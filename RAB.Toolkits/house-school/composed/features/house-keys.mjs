import { readFileSync } from 'node:fs';
import { choose, rank, hash } from '../core.mjs';

// Shared vocabulary, not copied application implementations.
export const houseKeysSource = readFileSync(new URL('../../../HouseKeys.types.ts', import.meta.url), 'utf8');
export const houseKeysHash = hash(houseKeysSource);
export const handlerKeys = ['handleClick', 'handleSave', 'handleCancel', 'handleSelect', 'handleToggle'];
for (const key of handlerKeys) {
  if (!houseKeysSource.includes(`${key}?:`)) throw new Error(`HouseKeys no longer declares ${key}`);
}
export const selectHandler = (ctx) => {
  const mixed = choose(ctx.knobs.seed, `house-key-coverage:${ctx.level}`, ctx.knobs.houseKeyCoverage);
  const pool = handlerKeys.slice(1);
  return mixed ? pool[Math.floor(rank(ctx.knobs.seed, `house-key-name:${ctx.level}`) * pool.length)] : 'handleClick';
};
