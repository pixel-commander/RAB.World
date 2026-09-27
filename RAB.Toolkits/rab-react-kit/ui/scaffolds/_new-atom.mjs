import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { validateSignalContract } from '../../../../RAB.Box/bridge/tool-contract.mjs';

const bad = message => Object.assign(new Error(message), { code: 'BAD_REQUEST' });
const atomKinds = new Set(['container-atom', 'action-atom', 'effect-atom', 'grid-atom']);

// One owner for project stylesheet registration across all atom kinds.
const inside = (root, file) => {
  const relative = path.relative(root, file);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
};
const stylesheetFor = async (location, context) => {
  const actualLocation = await realpath(location);
  let root = context.project?.root;
  if (root) {
    root = await realpath(root);
    if (!inside(root, actualLocation)) throw bad('Atom destination must belong to the selected project.');
  } else {
    root = actualLocation;
    while (true) {
      try { await readFile(path.join(root, 'package.json'), 'utf8'); break; }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      const parent = path.dirname(root);
      if (parent === root) throw bad('Choose an atom destination inside a project with package.json.');
      root = parent;
    }
  }
  const css = path.join(root, 'src', 'css');
  try { if (!inside(root, await realpath(css))) throw bad('Project CSS folder must remain inside the project.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const stylesheet = path.join(css, 'style.css');
  try { if (!inside(root, await realpath(stylesheet))) throw bad('Project stylesheet must remain inside the project.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  return stylesheet;
};
const registerImport = async (stylesheet, file) => {
  const relative = path.relative(path.dirname(stylesheet), file).split(path.sep).join('/');
  const specifier = relative.startsWith('.') ? relative : `./${relative}`;
  let text = '';
  try { text = await readFile(stylesheet, 'utf8'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const uncommented = text.replace(/\/\*[\s\S]*?\*\//g, '');
  const imports = [...uncommented.matchAll(/@import\s+(?:url\(\s*)?['"]([^'"]+)['"]/g)];
  if (imports.some(match => path.resolve(path.dirname(stylesheet), match[1]) === path.resolve(file))) return { file: stylesheet, import: specifier, added: false };
  // Imports precede style rules. Preserve a leading charset declaration.
  const at = text.match(/^\s*@charset\s+['"][^'"]+['"]\s*;/i)?.[0].length ?? 0;
  const declaration = `@import '${specifier}';\n`;
  await mkdir(path.dirname(stylesheet), { recursive: true });
  await writeFile(stylesheet, text.slice(0, at) + (at ? '\n' : '') + declaration + text.slice(at), 'utf8');
  return { file: stylesheet, import: specifier, added: true };
};

export const run = async ({ options, tool, helpers, context = {} }) => {
  const kind = tool.meta.atom_kind;
  if (!atomKinds.has(kind)) throw bad('Unknown house atom type.');
  const name = options.name;
  if (typeof name !== 'string' || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name)) throw bad('Atom name must be a lowercase kebab-case CSS identifier.');
  if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(name)) throw bad('Atom name is reserved by the filesystem.');
  if (typeof options.location !== 'string' || !options.location.trim()) throw bad('Choose the parent folder for the new atom.');
  if (options.description !== undefined && typeof options.description !== 'string') throw bad('Atom description must be text.');
  const location = path.resolve(options.location), folder = path.join(location, name), today = new Date().toISOString().slice(0, 10);
  const importStyles = options.import_styles === undefined ? true : options.import_styles;
  if (typeof importStyles !== 'boolean') throw bad('import_styles must be boolean.');
  const stylesheet = importStyles ? await stylesheetFor(location, context) : null;
  const presetField = tool.settings.find(field => field.name === 'preset');
  let files, settings, preset = null;
  if (presetField) {
    preset = options.preset ?? presetField.default;
    if (!presetField.enum.includes(preset)) throw bad('Choose one of the declared atom presets.');
    const templateRoot = path.join(tool.template, 'presets', preset);
    const source = JSON.parse(await readFile(path.join(templateRoot, 'settings.json'), 'utf8'));
    if (source.name !== preset || source.type !== kind) throw bad('Atom preset metadata does not match its folder and house type.');
    files = (await helpers.renderTemplateTree(templateRoot)).filter(file => file.path !== 'settings.json').map(file => ({ ...file, path: file.path.replaceAll(preset, name), ...(file.text === undefined ? {} : { text: file.text.replaceAll(preset, name) }) }));
    settings = { ...source, name, kind, description: options.description ?? source.description, created: today, modified: today };
  } else {
    const styles = options.styles ?? '';
    if (typeof styles !== 'string' || /[{}]/.test(styles)) throw bad('Styles must be CSS declarations without selectors or braces.');
    files = (await helpers.renderTemplateTree(tool.template, { ATOM_NAME: name, ATOM_STYLES: styles })).map(file => ({ ...file, path: file.path.replaceAll('__ATOM_NAME__', name) }));
    settings = { name, kind, description: options.description ?? '', created: today, modified: today };
  }
  settings = await helpers.createSignalSettings({ name, title: options.title ?? settings.title ?? name, description: options.description ?? settings.description, type: kind, transmitting: options.transmitting ?? settings.transmitting ?? true, signal: options.signal ?? settings.signal ?? true, settings: settings.settings ?? [] });
  files.push({ path: 'settings.json', text: JSON.stringify(settings, null, 2) + '\n' });
  const contract = files.find(file => file.path === 'contract.json');
  if (!contract) throw bad('Atom template must contain contract.json.');
  validateSignalContract(JSON.parse(contract.text));
  const verification = await helpers.writeArtifactPlan({ destination: folder, allowedRoot: location, files });
  const file = path.join(folder, name + '.css');
  let stylesheetImport;
  try { stylesheetImport = stylesheet ? await registerImport(stylesheet, file) : null; }
  catch (error) { error.details = { ...error.details, atom_created: true, folder, stylesheet, safe_to_resume: false }; throw error; }
  return { status: 'created', type: 'atom', id: settings.id, kind, name, title: settings.title, description: settings.description, preset, folder, file, path: file, settings, verification, stylesheetImport, provided: { seats: { atom_name: name, file, path: file, folder } } };
};
