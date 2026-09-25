import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveDestination } from '../../paths/_destination.mjs';

export const run = async ({ options, context, helpers }) => {
  const fail = message => { throw Object.assign(new Error(message), { code: 'BAD_INPUT' }); };
  if (typeof options.name !== 'string' || !options.name.trim()) fail('name is required.');
  const destination = resolveDestination(options.path, context);
  const title = options.title === undefined ? options.name : options.title;
  const description = options.description === undefined ? '' : options.description;
  const type = options.type === undefined ? '' : options.type;
  const transmitting = options.transmitting === undefined ? true : options.transmitting;
  if (typeof title !== 'string' || !title.trim()) fail('title must be nonempty text when supplied.');
  if (typeof description !== 'string' || typeof type !== 'string') fail('description and type must be text.');
  if (typeof transmitting !== 'boolean') fail('transmitting must be boolean.');
  const files = await helpers.renderTemplateTree(fileURLToPath(new URL('./template', import.meta.url)));
  const definition = files.find(file => file.path === 'settings.json');
  if (!definition) fail('Signal template needs settings.json.');
  const { id: placeholder, ...defaults } = JSON.parse(definition.text);
  const signal = await helpers.createItemSettings({ ...defaults, name: options.name, title, description, path: destination.path, type, transmitting });
  const rendered = files.map(file => file.path === 'settings.json'
    ? { ...file, text: JSON.stringify(signal, null, 2) + '\n' }
    : file.path === 'README.txt' ? { ...file, text: file.text.replaceAll('__TITLE__', title) } : file);
  const verification = await helpers.writeArtifactPlan({ destination: destination.folder, allowedRoot: destination.allowedRoot, uniqueDirectory: false, files: rendered });
  return { status: 'created', signal, folder: destination.folder, file: path.join(destination.folder, 'settings.json'), verification };
};
