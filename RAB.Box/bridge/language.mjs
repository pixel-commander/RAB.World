import { readFile, readdir, lstat, writeFile } from 'node:fs/promises';
import { containedPath, record, insist, hash } from '../engine/src/core.mjs';

const text = (value, max = 2000) => typeof value === 'string' && value.length <= max;
export const validateResource = data => {
  insist(record(data) && data.format === 'rraabbiitt-language-resource/v1', 'INVALID_RESOURCE', 'Expected a language-resource/v1 JSON export.');
  insist(record(data.source) && text(data.source.name, 200) && text(data.source.url, 1000) && /^https:\/\//.test(data.source.url) && text(data.source.license, 4000), 'INVALID_RESOURCE', 'Source name, HTTPS URL, and license are required.');
  insist(Array.isArray(data.entries) && data.entries.length <= 10000, 'INVALID_RESOURCE', 'A resource may contain up to 10,000 entries.');
  const ids = new Set();
  for (const e of data.entries) {
    insist(record(e) && text(e.id, 300) && e.id && !ids.has(e.id), 'INVALID_RESOURCE', 'Each entry needs a unique ID.');
    ids.add(e.id);
    insist(text(e.word, 120) && text(e.part_of_speech, 50) && text(e.sense, 300) && text(e.definition), 'INVALID_RESOURCE', 'Entry text or part of speech is invalid.');
    insist(Array.isArray(e.forms) && e.forms.length <= 100 && e.forms.every(x => text(x, 120) && x.trim()), 'INVALID_RESOURCE', 'Each entry needs a list of forms.');
    insist(Array.isArray(e.examples) && e.examples.length <= 20 && e.examples.every(x => text(x)), 'INVALID_RESOURCE', 'Examples must be text.');
  }
  return data;
};
const readJson = async file => {
  insist((await lstat(file)).size <= 4 * 1024 * 1024, 'FILE_LIMIT', 'Language resources are limited to 4 MiB per file.');
  return JSON.parse(await readFile(file, 'utf8'));
};
export const createLanguageLibrary = root => {
  const locate = async () => {
    const paths = await readJson(await containedPath(root, 'PATHS.json'));
    insist(record(paths) && Array.isArray(paths.resources) && typeof paths.imports === 'string', 'INVALID_RESOURCE', 'Language PATHS.json is incomplete.');
    return { paths, imports: await containedPath(root, paths.imports) };
  };
  const collect = async () => {
    const { paths, imports } = await locate();
    const result = [], unavailable = [];
    const files = await readdir(imports, { withFileTypes: true });
    insist(files.filter(x => x.name.endsWith('.json')).length <= 100, 'RESOURCE_LIMIT', 'At most 100 imported JSON resources may be loaded.');
    for (const item of files.filter(x => x.isFile() && x.name.endsWith('.json')).sort((a,b) => a.name.localeCompare(b.name))) {
      try {
        const data = validateResource(await readJson(await containedPath(root, `${paths.imports}/${item.name}`)));
        result.push({ file: item.name, data });
      } catch (error) { unavailable.push({ file: item.name, code: error.code ?? 'INVALID_RESOURCE', message: error.message }); }
    }
    return { paths, result, unavailable };
  };
  const overview = async () => {
    const { paths, result, unavailable } = await collect();
    return { resources: paths.resources, installed: result.map(r => ({ file: r.file, source: r.data.source, entries: r.data.entries.length })), unavailable, policy: 'Reference and review only. Importing data does not change active grammar, capabilities, or execution permissions.' };
  };
  const search = async query => {
    insist(typeof query === 'string' && query.length <= 120 && query.trim(), 'BAD_REQUEST', 'Enter a word or exact phrase, up to 120 characters.');
    const { result, unavailable } = await collect();
    const q = query.trim().toLowerCase();
    const matches = result.flatMap(r => r.data.entries.filter(e => [e.word, ...e.forms].some(f => f.toLowerCase() === q)).map(e => ({ ...e, source: r.data.source, file: r.file })));
    return { query, matches: matches.slice(0, 100), total: matches.length, unavailable, method: 'exact-form lookup; no semantic similarity or CCL model' };
  };
  const importData = async data => {
    validateResource(data);
    const { paths } = await locate();
    const bytes = JSON.stringify(data, null, 2) + '\n';
    insist(Buffer.byteLength(bytes) <= 4 * 1024 * 1024, 'FILE_LIMIT', 'Resource exceeds 4 MiB.');
    const name = `resource-${hash(bytes).slice(0, 24)}.json`;
    const file = await containedPath(root, `${paths.imports}/${name}`, { allowMissing: true });
    try { await writeFile(file, bytes, { flag: 'wx' }); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      insist((await readFile(file, 'utf8')) === bytes, 'HASH_COLLISION', 'Resource ID collision; no file was replaced.');
      return { status: 'already-present', file: name, entries: data.entries.length, authority: 0 };
    }
    return { status: 'imported-for-review', file: name, entries: data.entries.length, authority: 0 };
  };
  const grammar = async () => {
    const { paths } = await locate();
    const file = await containedPath(root, paths.grammar);
    return { path: paths.grammar, text: await readFile(file, 'utf8'), note: 'Original miniature NLTK feature grammar. A separate experiment, not the production parser.' };
  };
  return Object.freeze({ overview, search, importData, grammar });
};
