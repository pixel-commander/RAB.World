export const plan = ({ options }) => ({
  destination: `output/${options.name}`,
  files: [
    { path: 'index.html', text: `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><title>${options.name}</title><link rel="stylesheet" href="../../atoms/${options.class}/atom.css"></head><body><div class="${options.class}"></div></body></html>\n` },
    { path: 'README.txt', text: 'Generated div demonstration. Token definitions remain owned by the host project.\n' }
  ]
});
