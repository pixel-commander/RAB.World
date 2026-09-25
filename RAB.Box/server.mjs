import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createWorkbench } from './bridge/service.mjs';
import { userRabHome, defaultRabHome } from './bridge/rab-memory.mjs';
import { createAuditInvestigations } from './bridge/audit-investigations.mjs';
import { createLanguageLibrary } from './bridge/language.mjs';
import { insist, containedPath } from './engine/src/core.mjs';

const defaultRoot = path.dirname(fileURLToPath(import.meta.url));
const readBody = async req => {
  insist(req.headers['content-type']?.split(';')[0] === 'application/json', 'BAD_REQUEST', 'Use application/json.');
  let bytes = 0;
  const chunks = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    insist(bytes <= 4 * 1024 * 1024, 'BODY_LIMIT', 'Request exceeds 4 MiB.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('Malformed JSON request.'), { code: 'BAD_REQUEST' }); }
};
const httpStatus = code => ({ DENIED: 403, BAD_ORIGIN: 403, BAD_HOST: 403, BAD_REQUEST: 400, BAD_ID:400, INVALID_RESOURCE: 400, BODY_LIMIT: 413, FILE_LIMIT: 413, STALE_REVISION: 409, SESSION_CONFLICT:409, SUBMISSION_CONFLICT:409, BUSY: 409, RUN_FINISHED: 409, EEXIST: 409, ENOENT: 404 })[code] ?? 422;
export const startServer = async ({ root = defaultRoot, port = 4318, rabHome } = {}) => {
  const host = JSON.parse(await readFile(await containedPath(root, 'HOST.json'), 'utf8'));
  const interfaceFile = await containedPath(root, host.interface);
  const workbench = createWorkbench({ root, rabHome });
  await workbench.initialize();
  const investigations = createAuditInvestigations({ root, rabHome });
  const language = createLanguageLibrary(await containedPath(root, host.language));
  const token = randomBytes(32).toString('hex');
  let origin;
  const respond = (res, status, data) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
  };
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    try {
      const host = req.headers.host;
      insist(host === new URL(origin).host, 'BAD_HOST', 'Use the exact local address printed by the server.');
      if (req.headers.origin) insist(req.headers.origin === origin, 'BAD_ORIGIN', 'Cross-origin access is not allowed.');
      if (req.headers['sec-fetch-site']) insist(['same-origin','none'].includes(req.headers['sec-fetch-site']), 'BAD_ORIGIN', 'Open the workbench directly.');
      const url = new URL(req.url, origin);
      if (req.method === 'GET' && ['/', '/magic-box/', '/magic-box/index.html'].includes(url.pathname)) {
        const html = await readFile(interfaceFile, 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html); return;
      }
      const uiAssets=new Map([
        ['/magic-box/run-preparation.mjs','text/javascript; charset=utf-8']
      ]);
      if(req.method==='GET'&&uiAssets.has(url.pathname)){
        const file=await containedPath(root,url.pathname.slice(1));
        const content=await readFile(file,'utf8');
        res.writeHead(200,{'Content-Type':uiAssets.get(url.pathname)});res.end(content);return;
      }
      if (req.method === 'GET' && url.pathname === '/favicon.ico') { res.writeHead(204); res.end(); return; }
      if (req.method === 'GET' && url.pathname === '/api/session') { respond(res, 200, { token, version: '0.9.0', storage_home: path.resolve(rabHome ?? defaultRabHome()) }); return; }
      insist(req.headers['x-magic-token'] === token, 'DENIED', 'Session expired or token missing. Reload the page; saved runs remain on disk.');
      let data;
      const selectedSession=url.searchParams.get('session_id')??undefined;
      if (req.method === 'GET' && url.pathname === '/api/project') data = await workbench.inspect(url.searchParams.get('session_id') ?? undefined);
      else if (req.method === 'GET' && url.pathname === '/api/projects') data = await workbench.projectsList();
      else if (req.method === 'GET' && /^\/api\/projects\/\d+$/.test(url.pathname)) data = await workbench.projectInspect(url.pathname.split('/')[3]);
      else if (req.method === 'GET' && /^\/api\/projects\/\d+\/(indexes|batches)\/\d+(\/records)?$/.test(url.pathname)) {
        const parts=url.pathname.split('/');
        data=await workbench.folderRecords({projectId:parts[3],kind:parts[4]==='indexes'?'index':'batch',id:parts[5],page:parts[6]==='records',cursor:url.searchParams.get('cursor'),limit:url.searchParams.get('limit')??undefined});
      }
      else if (req.method === 'POST' && url.pathname === '/api/projects/activate') data = await workbench.projectActivate(await readBody(req));
      else if (req.method === 'GET' && url.pathname === '/api/requests') data = await workbench.requestsList(Object.fromEntries(url.searchParams));
      else if (req.method === 'GET' && /^\/api\/requests\/\d+$/.test(url.pathname)) data = await workbench.requestRead(url.pathname.split('/')[3],Object.fromEntries(url.searchParams));
      else if (req.method === 'POST' && url.pathname === '/api/requests') data = await workbench.requestCreate(await readBody(req));
      else if (req.method === 'GET' && url.pathname === '/api/diagnostics') data = await workbench.diagnostics();
      else if (req.method === 'GET' && url.pathname === '/api/health') data = await workbench.health({session_id:url.searchParams.get('session_id')??undefined});
      else if (req.method === 'POST' && url.pathname === '/api/plan') data = await workbench.plan(await readBody(req));
      else if (req.method === 'POST' && url.pathname === '/api/session/new') data = await workbench.sessionNew(await readBody(req));
      else if (req.method === 'GET' && url.pathname === '/api/sessions') data = await workbench.sessionList();
      else if (req.method === 'GET' && /^\/api\/sessions\/[^/]+$/.test(url.pathname)) data = await workbench.sessionRead(decodeURIComponent(url.pathname.split('/')[3]));
      else if (req.method === 'POST' && url.pathname === '/api/turn') data = await workbench.sessionTurn(await readBody(req));
      else if (req.method === 'POST' && url.pathname === '/api/session/answer') data = await workbench.sessionAnswer(await readBody(req));
      else if (req.method === 'POST' && url.pathname === '/api/session/yolo') data = await workbench.sessionYolo(await readBody(req));
      else if (req.method === 'POST' && url.pathname === '/api/session/execute') data = await workbench.sessionExecute(await readBody(req));
      else if (req.method === 'POST' && url.pathname === '/api/project/path') data = await workbench.projectPath(await readBody(req));
      else if (req.method === 'GET' && url.pathname === '/api/language/types') data = await workbench.languageTypes();
      else if (req.method === 'POST' && url.pathname === '/api/language/types') data = await workbench.languageTypeUpdate(await readBody(req));
      else if (req.method === 'GET' && url.pathname === '/api/tools') data = await workbench.toolsList({ domain: url.searchParams.get('domain') ?? undefined, include_stamps: url.searchParams.get('include_stamps') !== 'false', session_id:url.searchParams.get('session_id') ?? undefined });
      else if (req.method === 'POST' && url.pathname === '/api/tools/find') data = await workbench.toolsFind(await readBody(req));
      else if (req.method === 'POST' && url.pathname === '/api/tools/run') data = await workbench.toolsRun(await readBody(req));
      else if (req.method === 'POST' && url.pathname === '/api/investigations') data = await investigations.handle(await readBody(req));
      else if (req.method === 'POST' && url.pathname === '/api/turn-check') data = await workbench.turnCheck(await readBody(req));
      else if (req.method === 'POST' && url.pathname === '/api/language/teach') data = await workbench.teachLanguage(await readBody(req));
      else if (req.method === 'GET' && url.pathname === '/api/runs') data = await workbench.list(selectedSession);
      else if (req.method === 'POST' && url.pathname === '/api/runs') data = await workbench.prepare(await readBody(req),selectedSession);
      else if (req.method === 'GET' && url.pathname === '/api/stamp') data = await workbench.contract(url.searchParams.get('name'),selectedSession);
      else if (req.method === 'GET' && /^\/api\/runs\/\d+$/.test(url.pathname)) data = await workbench.read(url.pathname.split('/')[3],selectedSession);
      else if (req.method === 'GET' && /^\/api\/runs\/\d+\/file$/.test(url.pathname)) data = await workbench.file(url.pathname.split('/')[3], url.searchParams.get('path'),selectedSession);
      else if (req.method === 'POST' && /^\/api\/runs\/\d+\/(answer|answer-text|resume|execute)$/.test(url.pathname)) data = await workbench.act(url.pathname.split('/')[3], url.pathname.split('/')[4], await readBody(req),selectedSession);
      else if (req.method === 'GET' && url.pathname === '/api/language') data = await language.overview();
      else if (req.method === 'GET' && url.pathname === '/api/language/grammar') data = await language.grammar();
      else if (req.method === 'GET' && url.pathname === '/api/language/search') data = await language.search(url.searchParams.get('q'));
      else if (req.method === 'POST' && url.pathname === '/api/language/import') data = await language.importData(await readBody(req));
      else { respond(res, 404, { code: 'NOT_FOUND', message: 'Route is not exposed by this workbench.' }); return; }
      respond(res, 200, data);
    } catch (error) {
      if (!res.headersSent) respond(res, httpStatus(error.code), { code: error.code ?? 'ERROR', message: error.message, details: error.details ?? {} });
      else res.end();
    }
  });
  server.requestTimeout = 120000;
  server.headersTimeout = 15000;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => { origin = `http://127.0.0.1:${server.address().port}`; server.off('error', reject); resolve(); });
  });
  server.once('close', () => { void workbench.close().catch(error => console.error('Listener shutdown:', error.message)); });
  return { server, origin, workbench, close: async () => { await workbench.close(); await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); } };
};
const main = async () => {
  const args = process.argv.slice(2), at = args.indexOf('--port');
  const port = at >= 0 ? Number(args[at + 1]) : 52814;
  insist(Number.isInteger(port) && port >= 0 && port <= 65535, 'BAD_REQUEST', 'Port must be 0–65535. Use 0 for an available port.');
  // Normal launches always use the user's single Box storage home. Tests
  // supply an isolated rabHome to startServer; a preview override must not
  // redirect an ordinary launch away from the user's saved work.
  const rabHome = userRabHome();
  const app = await startServer({ port, rabHome });
  console.log(`Saved work: ${rabHome}`);
  console.log(`\nRRAABBIITT / Magic Box v0.9.0\n${app.origin}\n\nSelect an existing project or start a new project.\nLocal trusted operator only. Ctrl+C stops the server.\n`);
  if (args.includes('--open')) {
    const cmd = process.platform === 'win32' ? ['cmd', ['/c','start','',app.origin]] : process.platform === 'darwin' ? ['open',[app.origin]] : ['xdg-open',[app.origin]];
    const child = spawn(cmd[0], cmd[1], { stdio: 'ignore', windowsHide: true });
    child.on('error', () => console.log('Open the local address above in your browser.')); child.unref();
  }
};
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => {
  console.error(error.code === 'EADDRINUSE' ? 'Requested port is busy. Check the existing Box instance; no alternate server was started.' : error.message);
  process.exitCode = 1;
});
