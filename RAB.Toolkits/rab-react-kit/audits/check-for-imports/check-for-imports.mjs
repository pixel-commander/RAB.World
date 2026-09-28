import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const run = async ({ options }) => {
  if (typeof options?.path !== 'string' || !options.path.trim() || typeof options?.name !== 'string' || !options.name.trim()) throw new Error('path and name are required.');
  if (path.basename(options.name) !== options.name || !/\.(?:[cm]?[jt]sx?)$/i.test(options.name)) throw new Error('name must be a JavaScript or TypeScript filename, without folders.');
  const sourcePath = path.resolve(options.path, options.name);
  const settingsPath = path.join(path.dirname(sourcePath), 'settings.json');
  const source = await readFile(sourcePath, 'utf8');
  // Tokenize strings and comments separately so commented imports are ignored.
  const tokens = [...source.matchAll(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|[A-Za-z_$][\w$]*|[^\s]/g)]
    .map(match => match[0]).filter(token => !token.startsWith('//') && !token.startsWith('/*'));
  const imports = [];
  const componentFolder = path.dirname(sourcePath);
  const isInternal = specifier => {
    if (!specifier.startsWith('.') && !path.isAbsolute(specifier)) return false;
    const relative = path.relative(componentFolder, path.resolve(componentFolder, specifier));
    return relative === '' || (relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative));
  };
  const isString = token => token?.startsWith('"') || token?.startsWith("'");
  const add = (name, specifier) => {
    if (isInternal(specifier)) return;
    if (!imports.some(item => item.name === name && item.path === specifier)) imports.push({ id: "", name, path: specifier });
  };
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] !== 'import' || ['(', '.'].includes(tokens[i + 1]) || tokens[i - 1] === '.') continue;
    let j = i + 1;
    const bindings = [];
    if (!isString(tokens[j])) {
      while (j < tokens.length && tokens[j] !== 'from' && tokens[j] !== ';') bindings.push(tokens[j++]);
      if (tokens[j++] !== 'from') continue;
    }
    if (!isString(tokens[j])) continue;
    const specifier = tokens[j].slice(1, -1);
    if (/^(?:react|react-dom)(?:\/|$)/.test(specifier)) continue;
    if (!bindings.length) { add(specifier.split('/').pop() || specifier, specifier); continue; }
    if (bindings[0] === 'type' && bindings[1] !== ',') bindings.shift();
    if (bindings[0] && !['{', '*'].includes(bindings[0])) add(bindings[0], specifier);
    const star = bindings.indexOf('*');
    if (star >= 0 && bindings[star + 1] === 'as') add(bindings[star + 2], specifier);
    const open = bindings.indexOf('{');
    if (open >= 0) {
      const close = bindings.indexOf('}', open);
      const groups = bindings.slice(open + 1, close).join(' ').split(',');
      for (const group of groups) {
        const words = group.trim().split(/\s+/).filter(Boolean);
        if (!words.length) continue;
        const alias = words.indexOf('as');
        add(alias >= 0 ? words[alias + 1] : words[0] === 'type' && words.length > 1 ? words[1] : words[0], specifier);
      }
    }
    i = j;
  }
  let original;
  try { original = await readFile(settingsPath, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const settings = original === undefined ? {} : JSON.parse(original);
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw new Error('settings.json must contain an object.');
  if (settings.required !== undefined && !Array.isArray(settings.required)) throw new Error('settings.required must be an array.');
  const required = settings.required ?? [];
  const added = imports.filter(item => !required.some(existing => existing?.name === item.name && existing?.path === item.path));
  if (added.length || settings.required === undefined) {
    let current;
    try { current = await readFile(settingsPath, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (current !== original) throw new Error('settings.json changed during the scan; retry.');
    settings.required = [...required, ...added];
    await writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n', original === undefined ? { flag: 'wx' } : undefined);
  }
  return { message: imports.length === 0 ? 'no imports' : imports.length + ' imports recorded', path: sourcePath, settings: settingsPath, imports, added, required: settings.required };
};




