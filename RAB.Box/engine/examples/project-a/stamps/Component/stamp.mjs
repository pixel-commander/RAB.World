export const plan = ({ options }) => ({
  destination: `components/${options.name}`,
  files: [
    { path: `${options.name}.tsx`, text: `export const ${options.name} = () => <div className="${options.class}" />;\n` },
    { path: 'README.txt', text: `Generated component ${options.name}. The host project loads its registered atom CSS.\n` }
  ]
});
