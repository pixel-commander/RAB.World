import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
const toolkitRoot = String.raw`\\Desktop-t72isdi\l\RAB.World\RAB.Toolkits`;
export const auditTools = () => {
  const install = server => { server.middlewares.use(async (req, res, next) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname !== '/api/audit-tools') return next();
    res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET') { res.statusCode = 405; return res.end(JSON.stringify({ error: 'GET required.' })); }
    try {
      const root = await realpath(toolkitRoot);
      const folder = await realpath(url.searchParams.get('path') ?? '');
      const relative = path.relative(root, folder);
      if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) throw new Error('Choose a folder inside server RAB.Toolkits.');
      const items = [];
      const visit = async (dir, depth = 0) => {
        if (depth > 20) throw new Error('Tool folder nesting exceeds the supported depth.');
        const entries = await readdir(dir, { withFileTypes: true });
        if (entries.some(e => e.name === 'settings.json' && e.isFile())) {
          const settings = JSON.parse(await readFile(path.join(dir, 'settings.json'), 'utf8'));
          if (settings.type === 'tool' && settings.signal !== false && settings.transmitting !== false) {
            const executor = path.resolve(dir, settings.path ?? `${settings.name}.mjs`);
            const rel = path.relative(dir, executor);
            if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('Invalid tool executor path.');
            if ((await stat(executor)).isFile()) items.push({ id: settings.id, name: settings.name, title: settings.title, description: settings.description, settings: settings.settings ?? [], path: dir });
          }
        }
        for (const entry of entries) if (entry.isDirectory() && !entry.isSymbolicLink() && !['node_modules', '.git', 'template'].includes(entry.name)) await visit(path.join(dir, entry.name), depth + 1);
      };
      await visit(folder); items.sort((a,b) => a.name.localeCompare(b.name)); res.end(JSON.stringify({ items }));
    } catch (error) { res.statusCode = 400; res.end(JSON.stringify({ error: error.message })); }
  }); };
  return { name: 'audit-tools', configureServer: install, configurePreviewServer: install };
};
