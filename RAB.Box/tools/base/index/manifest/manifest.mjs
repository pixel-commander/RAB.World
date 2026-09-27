import path from 'node:path';
import { readdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { createRabMemory } from '../../../../bridge/rab-memory.mjs';
import { withMemoryLock } from '../../../../bridge/rab-memory-lock.mjs';

// A folder manifest, not a beacon. Never follow links out of the selected tree.
export const scanBase = async (root) => {
  const walk = async (folder, relative = '') => {
    const entries = (await readdir(folder, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name));
    const files = entries.filter(e => e.isFile() && e.name !== 'manifest.json' && !e.name.startsWith('.manifest-')).map(e => e.name);
    const node = { name: relative ? path.basename(folder) : 'base', title: relative ? path.basename(folder) : 'Base', description: '', path: relative || '.', type: 'folder', files, items: [] };
    if (files.includes('settings.json') && !relative.split('/').includes('template')) {
      const settings = JSON.parse(await readFile(path.join(folder, 'settings.json'), 'utf8'));
      if (settings.meta?.domain === 'base' && Number.isSafeInteger(settings.id) && settings.id > 0) {
        Object.assign(node, { id: settings.id, title: settings.title ?? node.name, description: settings.description ?? '', type: 'tool', key: `base/${relative}`, authority: settings.meta.authority ?? null });
      }
    }
    for (const entry of entries) {
      if (entry.isDirectory() && !['.git', 'node_modules'].includes(entry.name)) node.items.push(await walk(path.join(folder, entry.name), relative ? `${relative}/${entry.name}` : entry.name));
    }
    return node;
  };
  return walk(root);
};

export const run = async ({ root, context = {}, options = {} }) => {
  if (Object.keys(options).length) throw new Error('Base manifest scanner takes no options.');
  const base = path.join(root, 'tools', 'base');
  const file = path.join(base, 'manifest.json');
  const memory = createRabMemory({ rabHome: context.rab_home });
  return withMemoryLock(path.join(memory.rabHome, '.memory-locks', 'base-manifest'), async () => {
    let previous;
    try { previous = JSON.parse(await readFile(file, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (previous && (previous.version !== 'folder-manifest/v1' || !Number.isSafeInteger(previous.id))) throw new Error('Existing Base manifest has an unsupported shape; left unchanged.');
    const tree = await scanBase(base);
    const manifest = { version: 'folder-manifest/v1', id: previous?.id ?? await memory.allocateId(), ...tree, title: 'Base tools', description: 'Folder hierarchy and tool metadata for the built-in Base tools.', generated_at: new Date().toISOString() };
    const temporary = path.join(base, `.manifest-${await memory.allocateId()}.tmp`);
    try {
      await writeFile(temporary, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
      await rename(temporary, file);
    } finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
    return { status: 'updated', path: file, manifest };
  });
};
