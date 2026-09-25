import path from 'node:path';
import { lstat, realpath, readFile } from 'node:fs/promises';
export const fail = (code, message) => { throw Object.assign(new Error(message), { code }); };
export const text = (value, label, empty = false) => {
  if (typeof value !== 'string' || (!empty && !value.trim())) fail('INVALID_INPUT', `${label} must be text${empty ? '' : ' and not empty'}.`);
  return value;
};
export const safeName = value => {
  if (!/^[a-z0-9][a-z0-9-]{0,95}$/.test(value) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(value)) fail('INVALID_INPUT', 'Use a lowercase session folder name with letters, digits and hyphens; no reserved device names.');
  return value;
};
// Toolkit-side input preflight; actual writes and byte checks belong to Box's artifact-plan helper.
export const absolute = async (value, label, directory = false) => {
  text(value, label);
  if (!path.isAbsolute(value)) fail('INVALID_PATH', `${label} must be an absolute path.`);
  const result = path.resolve(value);
  let cursor = path.parse(result).root;
  for (const part of result.slice(cursor.length).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, part);
    try { if ((await lstat(cursor)).isSymbolicLink()) fail('INVALID_PATH', `${label} cannot traverse links or junctions.`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  if (directory && !(await lstat(result)).isDirectory()) fail('INVALID_PATH', `${label} must be an existing directory.`);
  return directory ? await realpath(result) : result;
};
export const within = (root, target) => {
  const rel = path.relative(root, target);
  return rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel);
};
export const separate = (a, b) => {
  if (within(a,b) || within(b,a)) fail('INVALID_PATH', 'Original source, generated session and tool source must be separate, non-nested folders.');
};
export const missing = async target => {
  try { await lstat(target); fail('EEXIST', 'Destination already exists: ' + target); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
};
export const readJson = async file => {
  await absolute(file, 'Settings file');
  const info = await lstat(file);
  if (!info.isFile() || info.size > 1024 * 1024) fail('INVALID_INPUT', 'Expected a settings file smaller than 1 MiB.');
  return JSON.parse(await readFile(file, 'utf8'));
};
export const materialize = async ({ tool, helpers, destination, allowedRoot, values, enrich }) => {
  const files = await helpers.renderTemplateTree(path.join(tool.root, 'template'), values);
  const settingsFile = files.find(file => file.path === 'settings.json');
  if (!settingsFile?.text) fail('INVALID_TEMPLATE', 'Template requires settings.json.');
  const settings = await helpers.createItemSettings(enrich(JSON.parse(settingsFile.text)));
  settingsFile.text = JSON.stringify(settings, null, 2) + '\n';
  const receipt = await helpers.writeArtifactPlan({ destination, allowedRoot, files });
  return { status: 'created', id: settings.id, folder: destination, settings, verification: receipt.verification, files: receipt.files,
    provided: { seats: { folder: destination, settings_file: path.join(destination, 'settings.json') } } };
};

// A caller may bind a server-native source path to a share for this execution only.
export const originalSource = async (stored, access) => {
  text(stored, 'Original source');
  if (!path.isAbsolute(stored)) fail('INVALID_PATH', 'Original source must be an absolute path.');
  return { stored: path.resolve(stored), accessible: await absolute(access ?? stored, 'Original source access', true) };
};
