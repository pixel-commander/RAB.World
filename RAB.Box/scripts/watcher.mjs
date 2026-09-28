import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const controlWatcher = async (action, address = 'http://127.0.0.1:52814') => {
  if (!['start', 'stop', 'restart'].includes(action)) throw new Error('Usage: node scripts/watcher.mjs start|stop|restart [http://127.0.0.1:52814]');
  const base = new URL(address);
  if (base.protocol !== 'http:' || base.hostname !== '127.0.0.1' || base.username || base.password || base.pathname !== '/' || base.search || base.hash) throw new Error('Use the running Box HTTP address on 127.0.0.1.');
  const session = await fetch(new URL('/api/session', base), { signal: AbortSignal.timeout(10000) });
  if (!session.ok) throw new Error(`Box session returned HTTP ${session.status}.`);
  const { token } = await session.json();
  if (typeof token !== 'string' || !token) throw new Error('Box did not return a session token.');
  const response = await fetch(new URL('/api/tools/run', base), {
    method: 'POST', signal: AbortSignal.timeout(30000),
    headers: { 'Content-Type': 'application/json', 'x-magic-token': token },
    body: JSON.stringify({ tool: `base/watch/${action}`, options: {} })
  });
  const output = await response.json();
  if (!response.ok) throw new Error(output.message ?? `Box returned HTTP ${response.status}.`);
  if (!output.result?.status) throw new Error('Box did not return a watcher status.');
  return output.result;
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [action, address, ...extra] = process.argv.slice(2);
    if (extra.length) throw new Error('Supply an action and optional Box address only.');
    const result = await controlWatcher(action, address);
    console.log(JSON.stringify(result, null, 2));
    if (result.status === 'partial') process.exitCode = 1;
  } catch (error) {
    console.error(error.cause?.code === 'ECONNREFUSED' ? 'Box is not running at that address. Start Box first.' : error.message);
    process.exitCode = 1;
  }
}
