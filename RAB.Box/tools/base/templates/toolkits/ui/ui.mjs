import { lstat, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createRabMemory } from '../../../../../bridge/rab-memory.mjs';
import { checkedAbsolutePath, renderTemplateTree, writeArtifactPlan } from '../../../../_artifact-plan.mjs';

const fail = (code, message) => { throw Object.assign(new Error(message), { code }); };
const isName = value => typeof value === 'string' && /^[a-z][a-z0-9-]*$/.test(value);
const reservedFolder = value => /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(value);
const collectDirectories = async (root, relative = '') => {
  const directories = [];
  for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
    if (entry.isSymbolicLink()) fail('INVALID_PATH', 'Toolkit templates cannot contain links.');
    if (!entry.isDirectory()) continue;
    const child = path.posix.join(relative, entry.name);
    directories.push(child, ...await collectDirectories(root, child));
  }
  return directories;
};

export const run = async ({ options, context = {}, tool, helpers }) => {
  if (typeof options.folder !== 'string' || !path.isAbsolute(options.folder)) {
    fail('INVALID_INPUT', 'Toolkit Folder must be an absolute path.');
  }
  const type = options.type;
  const destination = await checkedAbsolutePath(options.folder);
  const name = options.name ?? path.basename(destination);
  if (!isName(type) || reservedFolder(type)) fail('INVALID_INPUT', 'Project Type must be a valid lowercase folder name.');
  if (!isName(name) || reservedFolder(name)) fail('INVALID_INPUT', 'Toolkit Name must be a valid lowercase folder name.');
  if (destination === path.parse(destination).root) fail('INVALID_PATH', 'A drive or share root cannot be a toolkit destination.');
  const title = options.title ?? (type.charAt(0).toUpperCase() + type.slice(1) + ' UI Toolkit');
  const description = options.description ?? ('UI toolkit structure for ' + type + ' projects, ready for tool implementations.');
  for (const [label, value] of [['Title', title], ['Description', description]]) {
    if (typeof value !== 'string' || !value.trim()) fail('INVALID_INPUT', label + ' must contain text.');
  }
  try {
    const existing = await lstat(destination);
    if (!existing.isDirectory() || (await readdir(destination)).length) {
      fail('ALREADY_EXISTS', 'Toolkit Folder must be new or empty; existing contents are preserved.');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const source = await checkedAbsolutePath(tool.template);
  const directories = (await collectDirectories(source)).map(relative => relative.replaceAll('__PROJECT_TYPE__', type));
  const rendered = await renderTemplateTree(source, {
    PROJECT_TYPE: type, TOOLKIT_NAME: name, TOOLKIT_TITLE: title, TOOLKIT_DESCRIPTION: description
  });
  const settingsFile = rendered.find(file => file.path === 'settings.json');
  if (!settingsFile?.text) fail('INVALID_TEMPLATE', 'The toolkit template requires root settings.json.');
  const settings = JSON.parse(settingsFile.text);
  const catalog = await helpers.listTools({ fresh: true });
  const occupied = new Set([...catalog.items, ...(catalog.toolkits ?? [])].map(item => item.id).filter(Number.isSafeInteger));
  const memory = createRabMemory({ rabHome: context.rab_home });
  let id;
  do { id = await memory.allocateId(); } while (occupied.has(id));
  settings.id = id;
  settingsFile.text = JSON.stringify(settings, null, 2) + '\n';
  const files = rendered.map(file => ({ ...file, path: file.path.replaceAll('__PROJECT_TYPE__', type) }));
  const receipt = await writeArtifactPlan({
    destination, allowedRoot: path.dirname(destination), uniqueDirectory: false, files
  });
  const createdDirectories = [];
  try {
    for (const relative of directories) {
      const target = await checkedAbsolutePath(path.join(destination, relative));
      await mkdir(target, { recursive: true });
      createdDirectories.push(relative);
    }
  } catch (error) {
    error.details = { ...error.details, destination, partial: true, files: receipt.files, directories: createdDirectories };
    throw error;
  }
  return {
    status: 'created', id, name, type, folder: destination,
    files: receipt.files, directories: createdDirectories,
    provided: { seats: { folder: destination, name, type } }
  };
};
