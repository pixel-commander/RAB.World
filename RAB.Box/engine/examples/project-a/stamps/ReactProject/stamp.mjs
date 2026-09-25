import path from 'node:path';

export const plan = ({ options, assets }) => {
  if (options.type !== 'app') throw new Error('This demo stamp only implements type=app.');
  const template = JSON.parse(assets.template);
  const files = template.files.map(file => ({ path: file.path, text: file.text.replaceAll('__PROJECT_NAME__', options.name) }));
  if (options.add_database === true) files.push(...template.database);
  return { destination: path.posix.join(options.location.replaceAll('\\', '/'), options.name), files };
};
