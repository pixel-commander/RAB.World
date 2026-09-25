import path from 'node:path';
import { lstat, realpath, opendir } from 'node:fs/promises';

const EXCLUDED = new Set(['.rab', 'node_modules', '.git']);
const fail = (code, message) => { throw Object.assign(new Error(message), { code }); };
const inside = (root, file) => { const rel = path.relative(root, file); return rel === '' || (rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel)); };
const slash = value => value.split(path.sep).join('/');
const errorRecord = error => ({ code: String(error.code ?? 'ERROR').slice(0, 80), message: String(error.message).slice(0, 1024) });
const sourceRead = async operation => {
  try { return await operation(); }
  catch (error) { error.source_read = true; throw error; }
};

// Check every ancestor too: resolving a junction first would conceal that the
// caller selected a link. Repeat below the pinned root before each folder read.
export const checkedFolder = async (root, relative = '.') => {
  if (typeof root !== 'string' || !path.isAbsolute(root) || typeof relative !== 'string') fail('INVALID_PATH', 'Expected an absolute root and relative folder.');
  if (path.isAbsolute(relative) || relative.split(/[\\/]/).some(part => part === '..')) fail('INVALID_PATH', 'Folder path must stay relative to its index root.');
  const target = path.resolve(root, relative), parsed = path.parse(target);
  if (!inside(root, target)) fail('INVALID_PATH', 'Folder is outside its index root.');
  let current = parsed.root;
  for (const part of target.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    const info = await lstat(current);
    if (info.isSymbolicLink()) fail('SOURCE_LINK', 'Folder path contains a symbolic link or junction.');
    if (!info.isDirectory()) fail('SOURCE_NOT_DIRECTORY', 'Indexed folder is no longer a directory.');
  }
  const resolved = await realpath(target);
  if (!inside(root, resolved)) fail('SOURCE_LINK', 'Folder resolution escaped its pinned root.');
  return resolved;
};

export const buildFolderIndex = async ({ memory, projectId, folder, signal, maxDurationMs = 300000 }) => {
  if (!Number.isSafeInteger(maxDurationMs) || maxDurationMs < 1 || maxDurationMs > 86400000) fail('BAD_SCAN_LIMIT', 'Index duration must be between 1 ms and one day.');
  const sourceRoot = await checkedFolder(folder), home = path.resolve(memory.rabHome);
  if (inside(home, sourceRoot)) fail('INVALID_PATH', 'Audit source cannot be inside application memory.');
  const sink = await memory.createFolderIndex({ projectId, sourceRoot });
  const started = performance.now(), counts = { discovered: 0, scanned: 0, empty: 0, skipped: 0, errors: 0, files: 0 };
  let reserved = [], nextId = 0, currentPath = '.', terminal = 'completed', terminalError = null;
  const takeId = async () => {
    if (nextId >= reserved.length) { reserved = await memory.allocateIds(32); nextId = 0; }
    return reserved[nextId++];
  };
  const check = () => {
    if (signal?.aborted) fail('SCAN_CANCELLED', 'Folder indexing cancelled.');
    if (performance.now() - started > maxDurationMs) fail('SCAN_TIMEOUT', 'Folder indexing reached its time limit.');
  };
  try {
    check();
    await sink.enqueue({ id: await takeId(), parent_id: null, path: '.' }); counts.discovered++;
    for (;;) {
      check();
      const folderRow = await sink.nextFolder();
      if (!folderRow) break;
      currentPath = folderRow.path;
      let directory = null, files = 0, entries = 0, childFolders = 0;
      try {
        const absolute = await sourceRead(() => checkedFolder(sourceRoot, folderRow.path));
        check(); directory = await sourceRead(() => opendir(absolute, { bufferSize: 32 }));
        for (;;) {
          check();
          const entry = await sourceRead(() => directory.read());
          if (!entry) break;
          check(); entries++;
          const relative = slash(path.join(folderRow.path === '.' ? '' : folderRow.path, entry.name));
          if (entry.isSymbolicLink()) {
            counts.skipped++;
            await sink.append({ kind: 'entry', parent_id: folderRow.id, path: relative, status: 'skipped', reason: 'symbolic-link' });
          } else if (entry.isDirectory()) {
            const row = { id: await takeId(), parent_id: folderRow.id, path: relative };
            counts.discovered++; childFolders++;
            if (EXCLUDED.has(entry.name.toLowerCase()) || path.resolve(sourceRoot, relative) === home) {
              counts.skipped++;
              await sink.append({ kind: 'folder', ...row, status: 'skipped', reason: 'excluded-directory' });
            } else await sink.enqueue(row);
          } else if (entry.isFile()) { files++; counts.files++; }
          else {
            counts.skipped++;
            await sink.append({ kind: 'entry', parent_id: folderRow.id, path: relative, status: 'skipped', reason: 'unsupported-entry' });
          }
          // A giant single directory still has visible, committed progress.
          if (entries % 128 === 0) await sink.checkpoint({ counts: { ...counts }, progress: { path: currentPath, entries } });
        }
        await directory.close(); directory = null; counts.scanned++; if (entries === 0) counts.empty++;
        await sink.append({ kind: 'folder', ...folderRow, status: 'scanned', empty: entries === 0, files, directories: childFolders });
      } catch (error) {
        if (['SCAN_CANCELLED', 'SCAN_TIMEOUT'].includes(error.code)) throw error;
        // Only source errors become coverage records. A failed sink must not be
        // mistaken for an unreadable source followed by a successful index.
        if (!error.source_read || !['EACCES', 'EPERM', 'ENOENT', 'ENOTDIR', 'EIO', 'ESTALE', 'SOURCE_LINK', 'SOURCE_NOT_DIRECTORY'].includes(error.code)) throw error;
        counts.errors++; terminal = 'partial';
        await sink.append({ kind: 'folder', ...folderRow, status: 'unavailable', error: errorRecord(error) });
      } finally {
        if (directory) await directory.close().catch(error => { if (error.code !== 'ERR_DIR_CLOSED') throw error; });
      }
      await sink.checkpoint({ counts: { ...counts }, progress: { path: currentPath } });
    }
  } catch (error) {
    terminal = error.code === 'SCAN_CANCELLED' ? 'cancelled' : error.code === 'SCAN_TIMEOUT' ? 'timed_out' : 'failed';
    terminalError = errorRecord(error);
  }
  try { return await sink.finish(terminal, { counts, progress: { path: currentPath }, error: terminalError }); }
  finally { await sink.close(); }
};
