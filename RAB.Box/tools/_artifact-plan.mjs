import { lstat, mkdir, readFile, readdir, writeFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { relativePath, insist } from '../engine/src/core.mjs';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');

// Check every existing ancestor, including the selected root. Never follow a
// junction merely because its textual address looks inside the intended tree.
export const checkedAbsolutePath = async target => {
  const absolute = path.resolve(target);
  let cursor = path.parse(absolute).root;
  for (const part of absolute.slice(cursor.length).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, part);
    try { insist(!(await lstat(cursor)).isSymbolicLink(), 'INVALID_PATH', 'Artifact paths cannot traverse symlinks or junctions.', { path: cursor }); cursor=await realpath(cursor); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return cursor;
};

export const renderTemplateTree = async (root, values = {}) => {
  const files = [];
  const visit = async (folder, prefix = '') => {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const relative = prefix + entry.name, file = path.join(folder, entry.name);
      insist(!entry.isSymbolicLink(), 'INVALID_PATH', 'Template links are not allowed.');
      if (entry.isDirectory()) await visit(file, relative + '/');
      else if (entry.isFile()) {
        const bytes = await readFile(file);
        if (bytes.includes(0)) files.push({ path: relative, base64: bytes.toString('base64') });
        else files.push({ path: relative, text: bytes.toString('utf8').replace(/__([A-Z_]+)__/g, (token, key) => Object.hasOwn(values, key) ? (path.extname(file) === '.json' ? JSON.stringify(String(values[key])).slice(1, -1) : String(values[key])) : token) });
      }
    }
  };
  await visit(root);
  return files;
};

// One owner for preflight, no-overwrite creation, and byte verification.
// uniqueDirectory=false supports flat atoms/hooks without reserving their parent.
export const writeArtifactPlan = async ({ destination, files, allowedRoot = path.dirname(destination), uniqueDirectory = true }) => {
  const target = await checkedAbsolutePath(destination);
  const boundary = await checkedAbsolutePath(allowedRoot);
  const relative = path.relative(boundary, target);
  insist(relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative), 'DENIED', 'Artifact destination leaves its allowed root.');
  insist(Array.isArray(files) && files.length > 0 && files.length <= 4096, 'INVALID_PLAN', 'Supply 1–4096 planned files.');
  const names = new Set(); let bytes = 0;
  const prepared = files.map(item => {
    const name = relativePath(item.path), folded = name.toLowerCase();
    insist(name !== '.' && !names.has(folded), 'INVALID_PLAN', 'Planned paths must be unique, including on Windows.');
    names.add(folded);
    insist((typeof item.text === 'string') !== (typeof item.base64 === 'string'), 'INVALID_PLAN', 'Supply text or base64, not both.');
    if (item.base64 !== undefined) insist(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(item.base64), 'INVALID_PLAN', 'Malformed base64.');
    const buffer = item.base64 === undefined ? Buffer.from(item.text) : Buffer.from(item.base64, 'base64');
    bytes += buffer.length;
    return { path: name, buffer, sha256: digest(buffer) };
  });
  insist(bytes <= 32 * 1024 * 1024, 'INVALID_PLAN', 'Artifact exceeds 32 MiB.');
  for (const a of names) for (const b of names) insist(a === b || !b.startsWith(a + '/'), 'INVALID_PLAN', 'A file cannot also be a parent directory.');
  const assertMissing = async file => {
    try { await lstat(file); throw Object.assign(new Error(`Target already exists: ${file}`), { code: 'EEXIST' }); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  };
  if (uniqueDirectory) await assertMissing(target);
  for (const file of prepared) await assertMissing(await checkedAbsolutePath(path.join(target, file.path)));
  const written = []; let created = false;
  try {
    const parent=path.dirname(target);
    try { insist((await lstat(parent)).isDirectory(),'INVALID_PATH','Artifact parent must be a directory.'); }
    catch(error) { if(error.code!=='ENOENT')throw error;await mkdir(parent,{recursive:true}); }
    await checkedAbsolutePath(target);
    await mkdir(target, { recursive: !uniqueDirectory }); created = true;
    for (const file of prepared) {
      const full = await checkedAbsolutePath(path.join(target, file.path));
      await mkdir(path.dirname(full), { recursive: true });
      await checkedAbsolutePath(full);
      await writeFile(full, file.buffer, { flag: 'wx' });
      written.push({ path: full, bytes: file.buffer.length, sha256: file.sha256 });
    }
    for (const file of written) insist(digest(await readFile(await checkedAbsolutePath(file.path))) === file.sha256, 'VERIFICATION_FAILED', 'Written bytes differ from the artifact plan.', { file: file.path });
    return { status: 'verified', verification: 'created-files-match-approved-plan-sha256', destination: target, files: written };
  } catch (error) {
    error.details = { ...error.details, destination: target, partial: created, written, rollback: 'none; inspect recorded artifacts before retrying' };
    throw error;
  }
};
