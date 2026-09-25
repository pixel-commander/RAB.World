import path from 'node:path';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { defaultRabHome } from './rab-memory.mjs';
import { withMemoryLock } from './rab-memory-lock.mjs';

export const createSearchUsage = ({ rabHome = defaultRabHome() } = {}) => {
  const file = path.join(rabHome, 'usage', 'world-search.json');
  const update = operation => withMemoryLock(path.join(rabHome, '.memory-locks', 'world-search-usage'), async () => {
    let data;
    try { data = JSON.parse(await readFile(file, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; data = {}; }
    if (!data || typeof data !== 'object' || Array.isArray(data) || Object.entries(data).some(([id, v]) => !/^[1-9][0-9]*$/.test(id) || !Number.isSafeInteger(Number(id)) || !v || !Number.isSafeInteger(v.used) || v.used < 0 || !Number.isSafeInteger(v.shown) || v.shown < 0)) throw new Error('Invalid counters; original preserved.');
    const result = operation(data);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file + '.tmp', JSON.stringify(data, null, 2) + '\n');
    await rename(file + '.tmp', file);
    return result;
  });
  return {
    async recordSearch(result) {
      const ids = [...new Set(result.items.map(item => item.id))];
      if (ids.some(id => !Number.isSafeInteger(id) || id <= 0)) throw new Error('Search results require permanent numeric IDs.');
      if (ids.length) await update(counters => {
        for (const id of ids) {
          counters[id] ??= { used: 0, shown: 0 };
          counters[id].shown++;
        }
      });
      return result;
    },
    async feedback({ id }) {
      if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Provide a positive numeric item ID.');
      return update(counters => {
        if (!Object.hasOwn(counters, id)) throw new Error('Item has not appeared in search.');
        counters[id].used++;
        return { id, ...counters[id] };
      });
    }
  };
};
