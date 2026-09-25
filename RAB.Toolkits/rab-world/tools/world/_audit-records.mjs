import path from 'node:path';
import { lstat, readdir, readFile } from 'node:fs/promises';
import { assertSignalSettings } from '../../../../RAB.Box/bridge/rab-node.mjs';
import { loadSignalContract } from '../../../../RAB.Box/bridge/tool-contract.mjs';
import { checkedAbsolutePath } from '../../../../RAB.Box/tools/_artifact-plan.mjs';
import { assertBeacon } from '../../paths/beacons/validate.mjs';

const excluded = new Set(['.git', '.rab', 'node_modules', 'template']);
const readJson = async file => {
  const stat = await lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024 * 1024) throw new Error('Expected a regular JSON file under 1 MiB.');
  return JSON.parse(await readFile(file, 'utf8'));
};

export const auditRecords = async ({ options }, type) => {
  if (typeof options.path !== 'string' || !path.isAbsolute(options.path)) throw new Error('path must be an absolute beacon root.');
  if (options.recursive !== undefined && typeof options.recursive !== 'boolean') throw new Error('recursive must be boolean.');
  const root = await checkedAbsolutePath(options.path);
  if (!(await lstat(root)).isDirectory()) throw new Error('path must be a folder.');
  const records = [], errors = [], skipped = [], ids = new Map();
  const visit = async (folder, depth = 0) => {
    if (depth > 64) { errors.push({ path: folder, code: 'DEPTH_LIMIT', message: 'Maximum audit depth exceeded.' }); return; }
    let entries;
    try { entries = await readdir(folder, { withFileTypes: true }); }
    catch (error) { errors.push({ path: folder, code: error.code, message: error.message }); return; }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(folder, entry.name);
      if (entry.isSymbolicLink()) { skipped.push({ path: file, reason: 'symlink' }); continue; }
      if (entry.isDirectory()) {
        if (excluded.has(entry.name)) { skipped.push({ path: file, reason: 'excluded' }); continue; }
        if (options.recursive !== false) await visit(file, depth + 1);
        continue;
      }
      if (entry.name !== (type === 'signal' ? 'settings.json' : 'beacon.json')) continue;
      const record = { path: file, status: 'valid', issues: [] };
      records.push(record);
      try {
        const value = await readJson(file);
        if (type === 'signal') assertSignalSettings(value); else await assertBeacon(value);
        record.id = value.id;
        if (ids.has(value.id)) {
          record.issues.push({ code: 'DUPLICATE_ID', message: `Also used by ${ids.get(value.id).path}` });
          ids.get(value.id).issues.push({ code: 'DUPLICATE_ID', message: `Also used by ${file}` });
        } else ids.set(value.id, record);
        if (type === 'signal') {
          const contract = await loadSignalContract(folder);
          if (!contract.ready) record.issues.push({ code: 'INCOMPLETE_CONTRACT', message: 'Contract is unclassified; implementation is not declared ready.' });
        }
      } catch (error) { record.issues.push({ code: error.code ?? 'INVALID_RECORD', message: error.message }); }
    }
  };
  await visit(root);
  for (const record of records) if (record.issues.length) record.status = 'invalid';
  if (!records.length) errors.push({ path: root, code: 'NO_RECORDS', message: `No ${type} records found.` });
  return { status: errors.length || records.some(record => record.status === 'invalid') ? 'issues' : 'passed', path: root, checked: records.length, records, errors, skipped };
};
