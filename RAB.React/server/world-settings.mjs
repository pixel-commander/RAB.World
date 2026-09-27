import { readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
const worldRoot = String.raw`\\Desktop-t72isdi\c\Users\gauge\.rab\worlds`;
export const worldSettings = () => {
  const install = server => { server.middlewares.use(async (req, res, next) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname !== '/api/world-settings') return next();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'PUT'].includes(req.method)) { res.statusCode = 405; return res.end(JSON.stringify({ error: 'GET or PUT required.' })); }
    try {
      const requested = url.searchParams.get('path');
      if (!requested) { res.statusCode = 400; return res.end(JSON.stringify({ error: 'World path required.' })); }
      const root = await realpath(worldRoot);
      const collection = url.searchParams.get('collection');
      if (collection && (!['toolkits', 'beacons'].includes(collection) || req.method !== 'GET')) { res.statusCode = 400; return res.end(JSON.stringify({ error: 'Invalid collection request.' })); }
      let file = await realpath(collection ? path.join(requested, collection, 'manifest.json') : path.join(requested, 'settings.json'));
      const relative = path.relative(root, file);
      if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
        res.statusCode = 403; return res.end(JSON.stringify({ error: 'Path must be inside the worlds folder.' }));
      }
      const entryId = url.searchParams.get('entry');
      if (entryId) {
        if (!collection || req.method !== 'GET') { res.statusCode = 400; return res.end(JSON.stringify({ error: 'Select a collection first.' })); }
        const manifest = JSON.parse(await readFile(file, 'utf8'));
        const entry = manifest.items?.find(item => String(item.id) === entryId);
        if (!entry || typeof entry.path !== 'string') { res.statusCode = 404; return res.end(JSON.stringify({ error: 'Entry not found.' })); }
        // Stored drive paths belong to the house server, never to the laptop.
        const folder = /^[A-Za-z]:[\\/]/.test(entry.path)
          ? path.join(String.raw`\\Desktop-t72isdi`, entry.path[0].toLowerCase(), entry.path.slice(3))
          : path.resolve(path.dirname(file), entry.path);
        file = await realpath(path.join(folder, 'manifest.json'));
      }
      const original = await readFile(file, 'utf8');
      let settings = JSON.parse(original);
      if (req.method === 'PUT') {
        if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) { res.statusCode = 403; return res.end(JSON.stringify({ error: 'Origin not allowed.' })); }
        if (!req.headers['content-type']?.startsWith('application/json')) { res.statusCode = 415; return res.end(JSON.stringify({ error: 'JSON required.' })); }
        let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 1048576) { res.statusCode = 413; return res.end(JSON.stringify({ error: 'Settings are too large.' })); } }
        let input; try { input = JSON.parse(body); } catch { res.statusCode = 400; return res.end(JSON.stringify({ error: 'Invalid JSON.' })); }
        const next = input.settings;
        if (!next || Array.isArray(next) || typeof next !== 'object' || next.id !== settings.id || typeof next.name !== 'string' || !next.name.trim()) { res.statusCode = 400; return res.end(JSON.stringify({ error: 'Keep the existing id and provide a nonempty name.' })); }
        if (JSON.stringify(input.original) !== JSON.stringify(settings) || await readFile(file, 'utf8') !== original) { res.statusCode = 409; return res.end(JSON.stringify({ error: 'Settings changed on disk. Reload before saving.' })); }
        await writeFile(file, JSON.stringify(next, null, 2) + '\n');
        settings = JSON.parse(await readFile(file, 'utf8'));
      }
      res.end(JSON.stringify(settings));
    } catch { res.statusCode = 404; res.end(JSON.stringify({ error: 'World settings could not be loaded.' })); }
  }); };
  return { name: 'world-settings', configureServer: install, configurePreviewServer: install };
};
