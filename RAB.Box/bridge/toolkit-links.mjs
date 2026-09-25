import { readFile, lstat, realpath, writeFile, rename, unlink } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { insist, record } from '../engine/src/core.mjs';
import { withMemoryLock } from './rab-memory-lock.mjs';

const VERSION = 'toolkit-links/v1';
export const pathIdentity = value => process.platform === 'win32' ? path.resolve(value).toLowerCase() : path.resolve(value);
export const withinRoot = (root, target) => {
  const relative = path.relative(root, target);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
};
const readJson = async file => {
  const info = await lstat(file);
  insist(info.isFile() && !info.isSymbolicLink() && info.size <= 1024 * 1024, 'BAD_TOOLKIT', `${file}: expected a regular JSON file under 1 MiB.`);
  return JSON.parse(await readFile(file, 'utf8'));
};

export const readToolkitLinks = async root => {
  const file = path.join(root, 'TOOLKITS.json');
  let data;
  try { data = await readJson(file); }
  catch (error) { if (error.code === 'ENOENT') return { file, version:VERSION, toolkits:[] }; throw error; }
  insist(record(data) && data.version === VERSION && Array.isArray(data.toolkits) && data.toolkits.length <= 64, 'BAD_TOOLKITS', 'TOOLKITS.json needs version toolkit-links/v1 and at most 64 toolkits.');
  for (const link of data.toolkits) {
    insist(record(link) && typeof link.path === 'string' && path.isAbsolute(link.path), 'BAD_TOOLKITS', 'Each toolkit link needs an absolute path on this computer.');
    insist(link.enabled === undefined || typeof link.enabled === 'boolean', 'BAD_TOOLKITS', 'Toolkit enabled must be boolean.');
    insist(Object.keys(link).every(key => ['path','enabled'].includes(key)), 'BAD_TOOLKITS', 'Toolkit links accept only path and enabled.');
  }
  return { ...data, file };
};

export const loadToolkit = async directory => {
  const root = await realpath(directory);
  insist((await lstat(root)).isDirectory(), 'BAD_TOOLKIT', 'Toolkit root must be a directory.');
  const settingsFile = path.join(root, 'settings.json');
  const settings = await readJson(settingsFile);
  insist(record(settings), 'BAD_TOOLKIT', 'Toolkit settings must be an object.');
  for (const key of ['id','name','title','description','settings','meta']) insist(Object.hasOwn(settings,key), 'BAD_TOOLKIT', `Toolkit settings are missing ${key}.`);
  insist(Number.isSafeInteger(settings.id) && settings.id > 0, 'BAD_TOOLKIT', 'Toolkit id must be a permanent positive integer.');
  insist(typeof settings.name === 'string' && /^[a-z][a-z0-9-]*$/.test(settings.name), 'BAD_TOOLKIT', 'Toolkit name must be lowercase kebab-case.');
  insist(typeof settings.title === 'string' && settings.title.trim() && typeof settings.description === 'string' && settings.description.trim(), 'BAD_TOOLKIT', 'Toolkit title and description are required.');
  insist(Array.isArray(settings.settings) && record(settings.meta) && settings.meta.kind === 'toolkit', 'BAD_TOOLKIT', 'Toolkit settings must be an input array and meta.kind must be toolkit.');
  const declaredRoot = settings.scaffolds_root ?? 'tools';
  insist(typeof declaredRoot === 'string' && declaredRoot.trim(), 'BAD_TOOLKIT', 'Toolkit scaffolds_root must be a non-empty relative path.');
  insist(!path.isAbsolute(declaredRoot) && !declaredRoot.split(/[\\/]+/).includes('..'), 'BAD_TOOLKIT', 'Toolkit scaffolds_root must stay within the toolkit root.');
  const toolsRoot = path.join(root, declaredRoot);
  insist((await lstat(toolsRoot)).isDirectory() && !(await lstat(toolsRoot)).isSymbolicLink() && withinRoot(root, await realpath(toolsRoot)), 'BAD_TOOLKIT', 'Toolkit tools/ must be a real contained directory.');
  return { id:settings.id, name:settings.name, title:settings.title, description:settings.description, root, toolsRoot, settingsFile };
};

export const readProjectToolkit = async projectRoot => {
  if (!projectRoot) return null;
  let settings;
  try { settings = await readJson(path.join(projectRoot,'settings.json')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  const value=settings.custom_toolkit_path;
  if(value===undefined || value===null || value==='')return null;
  insist(typeof value==='string' && path.isAbsolute(value),'BAD_TOOLKIT','Project custom_toolkit_path must be an absolute toolkit root, null, or empty.');
  return value;
};

export const updateToolkitLink = async ({ root, directory, remove = false, enabled = true }) => {
  root = await realpath(root);
  insist(typeof directory === 'string' && path.isAbsolute(directory), 'BAD_TOOLKITS', 'Use an absolute toolkit folder path.');
  const toolkit = remove || !enabled ? null : await loadToolkit(directory);
  const linkedRoot = toolkit?.root ?? await realpath(directory).catch(error=>{if(error.code==='ENOENT')return path.resolve(directory);throw error;});
  if (toolkit) {
    const houseTools = path.join(root, 'tools');
    insist(!withinRoot(houseTools, toolkit.toolsRoot) && !withinRoot(toolkit.toolsRoot, houseTools), 'BAD_TOOLKIT', 'External tools cannot overlap the house tools tree.');
  }
  return withMemoryLock(path.join(root, '.toolkit-links-lock'), async () => {
    const current = await readToolkitLinks(root);
    const links = [];
    for (const link of current.toolkits) {
      const actual = await realpath(link.path).catch(error => { if (error.code === 'ENOENT') return path.resolve(link.path); throw error; });
      if (pathIdentity(actual) !== pathIdentity(linkedRoot)) links.push(link);
    }
    if (!remove) links.push({path:linkedRoot,enabled});
    insist(links.length<=64,'BAD_TOOLKITS','At most 64 toolkit links are supported; no configuration was changed.');
    const next = { version:VERSION, toolkits:links };
    const temp = `${current.file}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
    try { await writeFile(temp, JSON.stringify(next,null,2)+'\n', {flag:'wx'}); await rename(temp,current.file); }
    finally { await unlink(temp).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
    return { file:current.file, ...next };
  });
};
