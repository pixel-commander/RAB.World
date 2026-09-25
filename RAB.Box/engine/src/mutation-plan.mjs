import {pathValue} from '../../bridge/project-paths.mjs';
import { readFile, writeFile, mkdir, lstat } from 'node:fs/promises';
import path from 'node:path';
import { hash, insist, fail, record, relativePath, containedPath } from './core.mjs';

const resolvedWriteRoots = async (project, stamp) => {
  let paths = {};
  try {
    const file = await containedPath(project.root, 'settings.json');
    const settings = JSON.parse(await readFile(file, 'utf8'));
    if (record(settings?.paths)) paths = Object.fromEntries(Object.entries(settings.paths).map(([key,value])=>[key,pathValue(value)]));
  } catch {}
  return stamp.entry.write_roots.map(root => {
    const mapped = typeof paths[root] === 'string' ? paths[root] : root;
    return { declared: relativePath(root), allowed: relativePath(mapped), source: typeof paths[root] === 'string' ? `settings.paths.${root}` : 'PATHS.write_roots' };
  });
};

export const validatePlan = async (project, stamp, plan) => {
  insist(record(plan) && typeof plan.destination === 'string' && Array.isArray(plan.files) && plan.files.length > 0 && plan.files.length <= 128, 'INVALID_PLAN', 'A plan must create one new directory with 1–128 files.');
  const destination = relativePath(plan.destination);
  insist(destination !== '.', 'INVALID_PLAN', 'A stamp cannot replace the project root.');
  const writeRoots = await resolvedWriteRoots(project, stamp);
  insist(writeRoots.some(({allowed}) => allowed === '.' || destination.startsWith(`${allowed}/`)), 'DENIED', 'Plan destination is outside the stamp write roots.', { destination, write_roots: writeRoots });
  const target = await containedPath(project.root, destination, { allowMissing: true });
  const parent = await containedPath(project.root, path.posix.dirname(destination));
  insist((await lstat(parent)).isDirectory(), 'INVALID_PLAN', 'Destination parent must already exist.');
  try { await lstat(target); fail('DESTINATION_EXISTS', 'Destination already exists. Nothing will be overwritten.', { destination }); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const names = new Set(), files = [];
  let bytes = 0;
  for (const item of plan.files) {
    insist(record(item) && typeof item.path === 'string' && ((typeof item.text === 'string') !== (typeof item.base64 === 'string')), 'INVALID_PLAN', 'File needs path and exactly one of text/base64.');
    const file = relativePath(item.path);
    insist(file !== '.' && !names.has(file.toLowerCase()), 'INVALID_PLAN', 'File names must be unique, including on Windows.', { file });
    names.add(file.toLowerCase());
    if (item.base64 !== undefined) insist(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(item.base64), 'INVALID_PLAN', 'Malformed Base64 data.');
    const buffer = item.text !== undefined ? Buffer.from(item.text, 'utf8') : Buffer.from(item.base64, 'base64');
    bytes += buffer.length;
    insist(bytes <= 2 * 1024 * 1024, 'INVALID_PLAN', 'Plan exceeds the 2 MiB demo limit.');
    files.push({ path: file, buffer, sha256: hash(buffer) });
  }
  for (const a of names) for (const b of names) insist(a === b || !b.startsWith(`${a}/`), 'INVALID_PLAN', 'A planned file cannot also be another file’s parent directory.');
  return { destination, files, bytes };
};

export const applyPlan = async (project, validated) => {
  const written = [];
  let created = false;
  try {
    const target = await containedPath(project.root, validated.destination, { allowMissing: true });
    await mkdir(target);
    created = true;
    for (const file of validated.files) {
      const relative = `${validated.destination}/${file.path}`;
      const filePath = await containedPath(project.root, relative, { allowMissing: true });
      await mkdir(path.dirname(filePath), { recursive: true });
      await containedPath(project.root, relative, { allowMissing: true });
      await writeFile(filePath, file.buffer, { flag: 'wx' });
      written.push({ path: relative, bytes: file.buffer.length, sha256: file.sha256 });
    }
    for (const file of written) {
      const exactPath = await containedPath(project.root, file.path);
      insist(hash(await readFile(exactPath)) === file.sha256, 'VERIFICATION_FAILED', 'Written bytes do not match the approved plan.', { file: file.path });
    }
    return { status: 'verified', verification: 'created-files-match-approved-plan-sha256', destination: validated.destination, files: written };
  } catch (error) {
    error.details = { ...error.details, createdDirectory: created ? validated.destination : null, written, partial: created, rollback: 'none; inspect recorded artifacts before retrying' };
    throw error;
  }
};
