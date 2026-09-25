import { readFile, realpath, lstat, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { record, own, safeKey, hash, insist, fail, requireRecord, containedPath, relativePath } from './core.mjs';
import { normalizeSettings } from './schema.mjs';

const worker = fileURLToPath(new URL('./worker.mjs', import.meta.url));

export const runWorker = (mode, file, payload = null, timeout = 5000) => new Promise((resolve, reject) => {
  const child = execFile(process.execPath, [worker, mode, file], { timeout, maxBuffer: 4 * 1024 * 1024, windowsHide: true, shell: false }, (error, stdout, stderr) => {
    if (error) { reject(Object.assign(new Error(`Trusted stamp process failed: ${stderr.trim() || error.message}`), { code: error.killed ? 'STAMP_TIMEOUT' : 'STAMP_FAILED' })); return; }
    try { resolve(JSON.parse(stdout)); } catch { reject(Object.assign(new Error('Stamp output must be one JSON value with no stdout logging.'), { code: 'INVALID_STAMP_OUTPUT' })); }
  });
  child.stdin.on('error', () => {});
  child.stdin.end(payload === null ? '' : JSON.stringify(payload));
});

export const readJson = async file => {
  try {
    const info = await lstat(file);
    insist(info.isFile() && info.size <= 1024 * 1024, 'LOOKUP_FAILED', 'Expected a regular JSON file smaller than 1 MiB.', { file });
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'LOOKUP_FAILED') throw error;
    fail('LOOKUP_FAILED', `Cannot read JSON: ${path.basename(file)}.`, { cause: error.message });
  }
};

export const loadProject = async root => {
  let canonicalRoot;
  try { canonicalRoot = await realpath(root); } catch { fail('LOOKUP_FAILED', 'Selected project root does not exist.'); }
  const manifest = await readJson(await containedPath(canonicalRoot, 'PATHS.json'));
  requireRecord(manifest.project, 'PATHS.project');
  insist((Number.isSafeInteger(manifest.project.id)&&manifest.project.id>0)||safeKey(manifest.project.id), 'INVALID_SCHEMA', 'PATHS.project.id is required and must be a stable identifier.');
  requireRecord(manifest.stamps, 'PATHS.stamps');
  requireRecord(manifest.tools ?? {}, 'PATHS.tools');
  requireRecord(manifest.catalogs ?? {}, 'PATHS.catalogs');
  for (const [name, entry] of Object.entries(manifest.stamps)) {
    insist(safeKey(name), 'INVALID_SCHEMA', 'Invalid reserved stamp name.');
    requireRecord(entry, `PATHS.stamps.${name}`);
    if (Object.hasOwn(entry,'id') || Object.hasOwn(entry,'path')) {
      insist(Number.isSafeInteger(Number(entry.id)) && Number(entry.id) > 0, 'INVALID_SCHEMA', `${name} direct PATHS entry needs a stable positive id.`);
      relativePath(entry.path);
      continue;
    }
    relativePath(entry.settings);
    relativePath(entry.script);
    insist(Array.isArray(entry.write_roots) && entry.write_roots.length > 0, 'INVALID_SCHEMA', `${name} must declare write_roots.`);
    entry.write_roots.forEach(relativePath);
    requireRecord(entry.language, `${name}.language`);
    for (const field of ['verbs', 'names']) insist(Array.isArray(entry.language[field]) && entry.language[field].length && entry.language[field].every(x => typeof x === 'string' && x.trim()), 'INVALID_SCHEMA', `${name}.language.${field} needs explicit phrases.`);
    if (entry.supporting_files !== undefined) {
      requireRecord(entry.supporting_files, 'supporting_files');
      for (const [key, value] of Object.entries(entry.supporting_files)) { insist(safeKey(key), 'INVALID_SCHEMA', 'Invalid asset key.'); relativePath(value); }
    }
    if (entry.dependencies !== undefined) insist(Array.isArray(entry.dependencies), 'INVALID_SCHEMA', 'dependencies must be an array.');
    for (const dep of entry.dependencies ?? []) {
      insist(record(dep) && safeKey(dep.capability) && safeKey(dep.field) && safeKey(dep.catalog), 'INVALID_SCHEMA', 'Dependency must name capability, field and catalog.');
      requireRecord(dep.bindings, 'dependency.bindings');
      for (const [child, parent] of Object.entries(dep.bindings)) insist(safeKey(child) && safeKey(parent), 'INVALID_SCHEMA', 'Dependency bindings map child field keys to parent field keys.');
    }
  }
  for (const [name, entry] of Object.entries(manifest.tools ?? {})) {
    insist(safeKey(name), 'INVALID_SCHEMA', 'Invalid Tool address key.');
    requireRecord(entry, `PATHS.tools.${name}`);
    insist(Number.isSafeInteger(Number(entry.id)) && Number(entry.id) > 0, 'INVALID_SCHEMA', `${name} Tool PATHS entry needs a stable positive id.`);
    relativePath(entry.path);
  }
  return { root: canonicalRoot, id: manifest.project.id, manifest, fingerprint: hash(manifest) };
};

export const loadStamp = async (project, name, { allowExecutableSettings = false } = {}) => {
  insist(own(project.manifest.stamps, name), 'CAPABILITY_UNAVAILABLE', 'Reserved capability is not registered in this project.', { capability: name });
  const entry = project.manifest.stamps[name];
  insist(!(Object.hasOwn(entry,'id') && Object.hasOwn(entry,'path')), 'CAPABILITY_UNAVAILABLE', 'This project Stamp is a flat PATHS override and is executed through the Tool House, not the legacy runner.', { capability:name, id:entry.id, path:entry.path });
  let settingsPath, scriptPath;
  try {
    settingsPath = await containedPath(project.root, entry.settings);
    scriptPath = await containedPath(project.root, entry.script);
    insist((await lstat(settingsPath)).isFile() && (await lstat(scriptPath)).isFile(), 'CAPABILITY_UNAVAILABLE', 'Stamp settings and script must both exist.');
  } catch (error) {
    if (error.code === 'INVALID_PATH') throw error;
    fail('CAPABILITY_UNAVAILABLE', 'A registered stamp file is missing. No stale fallback is used.', { name, cause: error.code });
  }
  let raw;
  if (path.extname(settingsPath) === '.json') raw = await readJson(settingsPath);
  else {
    insist(['.js', '.mjs', '.cjs'].includes(path.extname(settingsPath)), 'INVALID_SCHEMA', 'Use JSON or a supported JavaScript settings module.');
    insist(allowExecutableSettings, 'DENIED', 'JavaScript settings execute code. Explicitly trust them or use settings.json.', { name });
    raw = await runWorker('settings', settingsPath);
  }
  const settings = normalizeSettings(raw, name);
  const assets = {};
  for (const [key, relative] of Object.entries(entry.supporting_files ?? {})) {
    const file = await containedPath(project.root, relative);
    insist((await lstat(file)).size <= 1024 * 1024, 'INVALID_SCHEMA', 'Supporting asset exceeds 1 MiB.');
    assets[key] = await readFile(file, 'utf8');
  }
  const fingerprint = hash([entry, settings, hash(await readFile(scriptPath)), assets]);
  return { name, entry, settings, scriptPath, settingsPath, fingerprint, assets };
};

export const loadFamily = async (project, name, config = {}, chain = []) => {
  insist(chain.length < 8, 'DEPENDENCY_LIMIT', 'Dependency depth exceeded.');
  insist(!chain.includes(name), 'DEPENDENCY_CYCLE', 'Dependency cycle detected.', { chain: [...chain, name] });
  const stamp = await loadStamp(project, name, config);
  const result = new Map([[name, stamp]]);
  for (const dependency of stamp.entry.dependencies ?? []) {
    for (const [childKey, parentKey] of Object.entries(dependency.bindings)) insist(own(stamp.settings.options, parentKey), 'INVALID_SCHEMA', 'Dependency references an undeclared parent field.', { parentKey });
    let family;
    try { family = await loadFamily(project, dependency.capability, config, [...chain, name]); }
    catch (error) { if (error.code === 'CAPABILITY_UNAVAILABLE') continue; throw error; }
    const child = family.get(dependency.capability);
    for (const childKey of Object.keys(dependency.bindings)) insist(own(child.settings.options, childKey), 'INVALID_SCHEMA', 'Dependency references an undeclared child field.', { childKey });
    for (const [key, value] of family) {
      insist(!result.has(key), 'AMBIGUOUS', 'This small runner supports one frame per capability in a request; repeated dependencies need explicit frame IDs.', { capability: key });
      result.set(key, value);
    }
  }
  return result;
};

export const lookup = async (project, catalogName, value) => {
  insist(typeof value === 'string' && value.length > 0, 'INVALID_INPUT', 'Catalog lookup value must be text.');
  const catalog = project.manifest.catalogs?.[catalogName];
  insist(record(catalog), 'LOOKUP_FAILED', 'Project has no declared catalog.', { catalog: catalogName });
  try {
    const target = await containedPath(project.root, catalog.path);
    if (catalog.kind === 'json') {
      const data = await readJson(target);
      insist(Array.isArray(data.values) && data.complete === true && data.values.every(x => typeof x === 'string'), 'LOOKUP_FAILED', 'Catalog must declare complete:true and string values.');
      return { exists: data.values.includes(value), evidence: { catalog: catalogName, source: catalog.path, snapshot: hash(data), value } };
    }
    insist(catalog.kind === 'folders' && typeof catalog.marker === 'string', 'INVALID_SCHEMA', 'Unsupported catalog kind.');
    insist(/^[A-Za-z0-9_.-]+$/.test(value) && !['.', '..'].includes(value), 'INVALID_INPUT', 'Folder-backed catalog expects a single safe name.');
    relativePath(catalog.marker);
    const entries = await readdir(target, { withFileTypes: true });
    const found = entries.find(x => x.name === value);
    if (!found) return { exists: false, evidence: { catalog: catalogName, source: catalog.path, value, observed: 'complete directory enumeration' } };
    insist(found.isDirectory() && !found.isSymbolicLink(), 'LOOKUP_FAILED', 'Catalog entry is not a regular directory.');
    const marker = await containedPath(project.root, `${catalog.path}/${value}/${catalog.marker}`);
    insist((await lstat(marker)).isFile(), 'LOOKUP_FAILED', 'Catalog entry is incomplete; absence has not been established.');
    return { exists: true, evidence: { catalog: catalogName, source: path.relative(project.root, marker), value, sha256: hash(await readFile(marker)) } };
  } catch (error) {
    if (['INVALID_INPUT', 'INVALID_SCHEMA', 'LOOKUP_FAILED'].includes(error.code)) throw error;
    fail('LOOKUP_FAILED', 'Catalog inspection failed. This is not evidence of absence.', { catalog: catalogName, cause: error.message });
  }
};
