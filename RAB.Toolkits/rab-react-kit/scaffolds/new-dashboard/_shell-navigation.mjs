import { readFile, writeFile, realpath } from 'node:fs/promises';
import path from 'node:path';
const bad = message => Object.assign(new Error(message), { code: 'BAD_REQUEST' });
export const prepareShellNavigation = async ({ file, pageFile, name, root }) => {
  if (!/^[A-Z][A-Za-z0-9_$]*$/.test(name)) throw bad('Dashboard name must be a capitalized React identifier.');
  const boundary = await realpath(root);
  file = await realpath(file);
  if (!file.startsWith(boundary + path.sep)) throw bad('Shell entry must be inside the project.');
  pageFile = path.resolve(pageFile);
  const pageRelative = path.relative(boundary, pageFile);
  if (pageRelative === '..' || pageRelative.startsWith('..' + path.sep) || path.isAbsolute(pageRelative)) throw bad('Dashboard must be inside the project.');
  const source = await readFile(file, 'utf8');
  const arrays = [...source.matchAll(/\b(?:export\s+)?const\s+NAV_ITEMS\s*=\s*\[([\s\S]*?)\]\s*;/g)];
  if (arrays.length !== 1 || !/<SiteShell\b[^>]*\bitems=\{NAV_ITEMS\}/.test(source)) throw bad('Shell entry must declare one NAV_ITEMS array and pass it to SiteShell.');
  const match = arrays[0];
  // Only edit the canonical literal row shape. Refuse computed arrays instead of guessing.
  const rows = match[1].trim();
  const rowPattern = /\{\s*id:\s*(['"])[^'"\r\n]+\1\s*,\s*name:\s*(['"])[^'"\r\n]+\2\s*,\s*label:\s*(['"])[^'"\r\n]+\3\s*,\s*View:\s*[A-Za-z_$][\w$]*\s*,?\s*\}\s*,?\s*/g;
  if (rows.replace(rowPattern, '').trim()) throw bad('NAV_ITEMS must contain literal { id, name, label, View } rows.');
  const route = name.replace(/([A-Z]+)([A-Z][a-z])/g,'$1-$2').replace(/([a-z0-9])([A-Z])/g,'$1-$2').toLowerCase();
  const strings = [...rows.matchAll(/(?:id|name):\s*(['"])(.*?)\1/g)].map(m => m[2]);
  if (strings.includes(route) || new RegExp('\\b'+name+'\\b').test(source)) throw bad('Dashboard name or navigation route already exists.');
  let relative = path.relative(path.dirname(file), pageFile).replaceAll(path.sep, '/').replace(/\.tsx$/, '');
  if (!relative.startsWith('.')) relative = './' + relative;
  const entry = `  { id: ${JSON.stringify(route)}, name: ${JSON.stringify(route)}, label: ${JSON.stringify(name)}, View: ${name} },`;
  const replacement = match[0].replace(match[1], '\n' + (rows ? rows.replace(/,?$/, ',') + '\n' : '') + entry + '\n');
  const updated = `import { ${name} } from ${JSON.stringify(relative)};\n` + source.slice(0, match.index) + replacement + source.slice(match.index + match[0].length);
  return { file, route, commit: async () => {
    if (await readFile(file, 'utf8') !== source) throw bad('Shell entry changed during dashboard creation; navigation was not overwritten.');
    await writeFile(file, updated);
    if (await readFile(file, 'utf8') !== updated) throw new Error('Shell navigation verification failed.');
    return { file, route, added: true };
  } };
};
