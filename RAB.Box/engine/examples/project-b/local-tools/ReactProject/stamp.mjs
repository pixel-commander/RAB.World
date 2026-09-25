import path from 'node:path';

export const plan = ({ options, assets }) => {
  if (options.type !== 'app') throw new Error('This demo stamp only implements type=app.');
  const template = JSON.parse(assets.template);
  const theme = options.theme === 'dark' ? ':root { --surface-main: #172126; --surface-inset: #222e35; --content-main: #e6eef0; }' : ':root { --surface-main: #fff; --content-main: #18222b; }';
  const files = template.files.map(file => ({ path: file.path, text: file.text.replaceAll('__PROJECT_NAME__', options.name).replaceAll('__THEME__', options.theme).replaceAll('__THEME_OVERRIDE__', theme) }));
  if (options.add_database === true) files.push(...template.database);
  return { destination: path.posix.join(options.location.replaceAll('\\', '/'), options.name), files };
};
