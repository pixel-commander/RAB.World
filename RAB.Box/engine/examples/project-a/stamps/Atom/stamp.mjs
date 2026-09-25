export const plan = ({ options, catalogs }) => {
  const css = `@layer ${options.layer} {\n  .${options.name} {\n    background: var(--${options.name}-background, var(${options.token}));\n  }\n}\n`;
  return { destination: `${catalogs.classes.path}/${options.name}`, files: [
    { path: 'atom.css', text: css },
    { path: 'settings.json', text: JSON.stringify(options, null, 2) + '\n' },
    { path: 'README.txt', text: `Background atom ${options.name}.\nToken: ${options.token}\n${options.theme ? `Theme: ${options.theme}\n` : ''}${options.exportTarget ? `Export target: ${options.exportTarget}\n` : ''}` }
  ] };
};
