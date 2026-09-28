import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveDestination } from '../../paths/_destination.mjs';

export const run = async ({ options, context = {}, helpers }) => {
  const requireValue = (condition, message) => {
    if (!condition) throw Object.assign(new Error(message), { code: 'BAD_INPUT' });
  };
  requireValue(typeof options.name === 'string' && /^[a-z][a-z0-9_-]{0,63}$/i.test(options.name)
    && !['constructor', 'prototype', '__proto__'].includes(options.name), 'name must be a collection path key.');
  const destination = resolveDestination(options.path, context);
  const source = options.source_path;
  requireValue(typeof source === 'string' && source.trim().length > 0 && !source.includes('\0')
    && !path.win32.isAbsolute(source) && !path.posix.isAbsolute(source)
    && !source.includes(':') && !source.replaceAll('\\', '/').split('/').includes('..'),
  'source_path must be relative to the project root.');
  const projectId = options.project_id === undefined ? context.project?.id : options.project_id;
  requireValue(Number.isSafeInteger(projectId) && projectId > 0, 'Supply project_id or select a project with a numeric ID.');
  const title = options.title === undefined ? options.name : options.title;
  const description = options.description === undefined ? '' : options.description;
  requireValue(typeof title === 'string' && title.trim().length > 0, 'title must be nonempty text.');
  requireValue(typeof description === 'string', 'description must be text.');
  const files = await helpers.renderTemplateTree(fileURLToPath(new URL('./template', import.meta.url)));
  const definition = files.find(file => file.path === 'manifest.json');
  requireValue(Boolean(definition), 'Template must contain manifest.json.');
  const { id, ...defaults } = JSON.parse(definition.text);
  const manifest = await helpers.createItemSettings({ ...defaults, name: options.name, title, description,
    meta: { ...defaults.meta, collection: options.name, project_id: projectId, path: source } });
  const rendered = files.map(file => file.path === 'manifest.json'
    ? { ...file, text: JSON.stringify(manifest, null, 2) + '\n' } : file);
  const verification = await helpers.writeArtifactPlan({ destination: destination.folder,
    allowedRoot: destination.allowedRoot, uniqueDirectory: false, files: rendered });
  return { status: 'created', manifest, file: path.join(destination.folder, 'manifest.json'), verification };
};
