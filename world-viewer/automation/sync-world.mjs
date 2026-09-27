import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const snapshotRoot = process.env.WORLD_VIEWER_SNAPSHOT
  ? path.resolve(process.env.WORLD_VIEWER_SNAPSHOT)
  : path.join(process.env.RAB_HOME ?? path.join(os.homedir(), '.rab'), 'exports', 'world-viewer');
const source = path.join(snapshotRoot, 'world.generated.json');
const text = await readFile(source, 'utf8');
const data = JSON.parse(text);
if (!Array.isArray(data.worlds) || !Array.isArray(data.manifests)) throw new Error('Invalid world snapshot.');
await mkdir(path.join(projectRoot, 'src', 'data'), { recursive: true });
await writeFile(path.join(projectRoot, 'src', 'data', 'world.generated.json'), text);
for (const folder of ['world-settings', 'manifests']) {
  try { await cp(path.join(snapshotRoot, folder), path.join(projectRoot, 'public', folder), { recursive: true }); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
console.log(`Loaded saved snapshot: ${source}`);
