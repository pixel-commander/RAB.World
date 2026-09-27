import { readFile, realpath, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const revision = text => createHash('sha256').update(text).digest('hex');
export const beaconFiles = () => {
  const middleware = async (req, res, next) => {
    const url = new URL(req.url, 'http://localhost');
    if (!['/api/beacon-manifest', '/api/beacon-file'].includes(url.pathname)) return next();
    res.setHeader('Content-Type', 'application/json');
    try {
      if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) throw new Error('Origin rejected.');
      const data = JSON.parse(await readFile(new URL('../src/data/world.generated.json', import.meta.url), 'utf8'));
      const beacon = data.beacons.find(item => String(item.id) === url.searchParams.get('id'));
      if (!beacon) throw new Error('Unknown beacon.');
      const root = await realpath(beacon.path);
      const requested = url.pathname === '/api/beacon-manifest' ? 'manifest.json' : url.searchParams.get('file');
      if (!requested) throw new Error('Choose a file.');
      const file = await realpath(path.resolve(root, requested));
      const relative = path.relative(root, file);
      if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) throw new Error('File is outside the beacon.');
      if (!(await stat(file)).isFile() || (await stat(file)).size > 2 * 1024 * 1024) throw new Error('Choose a text file under 2 MB.');
      const text = await readFile(file, 'utf8');
      if (text.includes('\0')) throw new Error('Binary files cannot be edited.');
      if (req.method === 'GET') {
        res.end(url.pathname === '/api/beacon-manifest' ? text : JSON.stringify({ text, revision: revision(text) }));
      } else if (req.method === 'PUT' && url.pathname === '/api/beacon-file') {
        let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 3 * 1024 * 1024) throw new Error('File too large.'); }
        const update = JSON.parse(body);
        if (typeof update.text !== 'string') throw new Error('Text is required.');
        if (update.revision !== revision(text)) { res.statusCode = 409; throw new Error('File changed on disk. Reload before saving.'); }
        await writeFile(file, update.text, 'utf8');
        res.end(JSON.stringify({ revision: revision(update.text) }));
      } else { res.statusCode = 405; res.end(JSON.stringify({ error: 'Method not allowed.' })); }
    } catch (error) { if (res.statusCode === 200) res.statusCode = 400; res.end(JSON.stringify({ error: error.message })); }
  };
  return { name: 'beacon-files', configureServer(server) { server.middlewares.use(middleware); }, configurePreviewServer(server) { server.middlewares.use(middleware); } };
};
