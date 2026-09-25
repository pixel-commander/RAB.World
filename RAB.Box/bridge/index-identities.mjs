import path from 'node:path';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { createRabMemory } from './rab-memory.mjs';
import { withMemoryLock } from './rab-memory-lock.mjs';
import { checkedAbsolutePath } from '../tools/_artifact-plan.mjs';

const valid = id => Number.isSafeInteger(id) && id > 0;
export const maintainIndexIds = async (manifestFile, { rabHome } = {}) => {
  const memory = createRabMemory({ rabHome });
  const key = createHash('sha256').update(path.resolve(manifestFile).toLowerCase()).digest('hex');
  return withMemoryLock(path.join(memory.rabHome, '.memory-locks', `index-${key}`), async () => {
    await checkedAbsolutePath(manifestFile);
    const original = await readFile(manifestFile, 'utf8');
    const manifest = JSON.parse(original);
    if (manifest.version !== 'manifest/v1' || !Array.isArray(manifest.items)) throw new Error('Invalid manifest.');
    const root = path.dirname(manifestFile);
    let backup;
    const writeBackedUp = async (file, before, value) => {
      if (!backup) {
        backup = path.join(memory.rabHome, 'backups', 'index-identities', String(await memory.allocateId()));
        await mkdir(backup, { recursive: true });
      }
      const name = createHash('sha256').update(file).digest('hex');
      await writeFile(path.join(backup, `${name}.json`), JSON.stringify({ path: file, original: before }), { flag: 'wx' });
      if (await readFile(file, 'utf8') !== before) throw new Error('File changed during ID maintenance; retry.');
      await writeFile(file + '.ids.tmp', JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
      await rename(file + '.ids.tmp', file);
    };
    let changed = false;
    for (const item of manifest.items) {
      if (!item || valid(item.id)) continue;
      if (item.id != null) throw new Error('Malformed nonempty item ID; refusing replacement.');
      if (typeof item.path !== 'string' || !item.path) throw new Error('Missing item path.');
      const folder = path.resolve(root, item.path);
      const relative = path.relative(root, folder);
      if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error('Item escapes beacon root.');
      const file = await checkedAbsolutePath(path.join(folder, 'settings.json'));
      const before = await readFile(file, 'utf8');
      const settings = JSON.parse(before);
      if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw new Error('Invalid item settings.');
      if (settings.id != null && !valid(settings.id)) throw new Error('Malformed source ID; refusing replacement.');
      if (!valid(settings.id)) {
        settings.id = await memory.allocateId();
        await writeBackedUp(file, before, settings);
      }
      item.id = settings.id;
      changed = true;
    }
    if (changed) await writeBackedUp(manifestFile, original, manifest);
    return manifest;
  });
};
