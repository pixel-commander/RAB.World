import path from 'node:path';
import { lstat, rename, writeFile } from 'node:fs/promises';

const fail = message => { throw Object.assign(new Error(message), { code: 'BAD_INPUT' }); };

export const run = async ({ options }) => {
  if (typeof options.path !== 'string' || !path.isAbsolute(options.path)) fail('Path must be an absolute folder.');
  if (typeof options.worlds_path !== 'string' || !path.isAbsolute(options.worlds_path)) fail('Worlds Path must be an absolute folder.');
  const folder = path.resolve(options.path);
  const worldsPath = path.resolve(options.worlds_path);
  if (!(await lstat(folder)).isDirectory() || !(await lstat(worldsPath)).isDirectory()) fail('Path and Worlds Path must both be existing folders.');
  const file = path.join(folder, 'world-watcher.json');
  try { await lstat(file); fail('world-watcher.json already exists and will not be replaced.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const watcher = { version: 'world-watcher/v1', name: 'world-watcher', path: folder, worlds_path: worldsPath, watch: ['registered-beacon.json'], trigger: ['add', 'change', 'remove'], scanner: 'world-scanner', status: 'ready' };
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, JSON.stringify(watcher, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
  await rename(temporary, file);
  return { status: 'created', file, watcher, next: 'A host may now watch registered beacon.json records and trigger world-scanner.' };
};
