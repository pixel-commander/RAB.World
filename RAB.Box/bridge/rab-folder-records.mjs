import path from 'node:path';
import { mkdir, open, lstat, readFile, rename, unlink, realpath } from 'node:fs/promises';
import { assertNumericId } from './rab-id.mjs';
import { makeNode } from './rab-node.mjs';

export const FOLDER_LIMITS = Object.freeze({ recordBytes: 64 * 1024, pageBytes: 256 * 1024, pageRows: 100, readBytes: 16 * 1024, depth: 24, nodes: 12000 });
const fail = (code, message) => { throw Object.assign(new Error(message), { code }); };
const inside = (root, file) => { const rel = path.relative(root, file); return rel === '' || (rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel)); };
const plain = value => value && typeof value === 'object' && [Object.prototype, null].includes(Object.getPrototypeOf(value));

// Walk values before encoding, so a large string/array cannot first become a
// giant JSON string. The final byte check accounts for JSON escaping exactly.
export const boundedFolderJson = (value, limit = FOLDER_LIMITS.recordBytes) => {
  let bytes = 0, nodes = 0;
  const ancestors = new Set();
  const charge = count => { bytes += count; if (bytes > limit) fail('RECORD_TOO_LARGE', `Record exceeds ${limit} bytes.`); };
  const visit = (item, depth) => {
    if (++nodes > FOLDER_LIMITS.nodes || depth > FOLDER_LIMITS.depth) fail('RECORD_TOO_LARGE', 'Record exceeds structural bounds.');
    if (item === null || typeof item === 'boolean') { charge(5); return; }
    if (typeof item === 'number') { if (!Number.isFinite(item)) fail('BAD_RECORD', 'Records require finite numbers.'); charge(String(item).length); return; }
    if (typeof item === 'string') { if (item.length > limit) fail('RECORD_TOO_LARGE', 'String exceeds record bounds.'); charge(Buffer.byteLength(item) + 2); return; }
    if (!Array.isArray(item) && !plain(item)) fail('BAD_RECORD', 'Records require plain JSON values.');
    if (ancestors.has(item)) fail('BAD_RECORD', 'Cyclic record.');
    ancestors.add(item); charge(2);
    if (Array.isArray(item)) {
      if (item.length > FOLDER_LIMITS.nodes) fail('RECORD_TOO_LARGE', 'Array exceeds record bounds.');
      if (Object.hasOwn(item, 'toJSON')) fail('BAD_RECORD', 'Custom JSON encoding is unsupported.');
      for (let index = 0; index < item.length; index++) {
        const descriptor = Object.getOwnPropertyDescriptor(item, String(index));
        if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail('BAD_RECORD', 'Arrays must contain plain dense values.');
        charge(1); visit(descriptor.value, depth + 1);
      }
    } else {
      // for..in avoids allocating an array of all keys before enforcing limits.
      for (const key in item) {
        if (!Object.hasOwn(item, key)) continue;
        if (key.length > limit) fail('RECORD_TOO_LARGE', 'Key exceeds record bounds.');
        const descriptor = Object.getOwnPropertyDescriptor(item, key);
        if (!Object.hasOwn(descriptor, 'value') || key === 'toJSON' || key === '__proto__') fail('BAD_RECORD', 'Record accessors and special keys are unsupported.');
        charge(Buffer.byteLength(key) + 4); visit(descriptor.value, depth + 1);
      }
    }
    ancestors.delete(item);
  };
  visit(value, 0);
  const json = JSON.stringify(value);
  if (Buffer.byteLength(json) + 1 > limit) fail('RECORD_TOO_LARGE', `Record exceeds ${limit} encoded bytes.`);
  return json;
};

const writeAll = async (handle, data, position) => {
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  let written = 0;
  while (written < buffer.length) {
    const result = await handle.write(buffer, written, buffer.length - written, position + written);
    if (!result.bytesWritten) fail('SHORT_WRITE', 'Folder record write made no progress.');
    written += result.bytesWritten;
  }
  return written;
};
const atomic = async (file, value) => {
  const text = boundedFolderJson(value) + '\n', temporary = file + '.tmp';
  const handle = await open(temporary, 'wx');
  try { await handle.writeFile(text); await handle.sync(); }
  catch (error) { await handle.close(); await unlink(temporary).catch(() => {}); throw error; }
  await handle.close();
  try { await rename(temporary, file); }
  catch (error) { await unlink(temporary).catch(() => {}); throw error; }
};
const regular = async file => {
  const info = await lstat(file);
  if (!info.isFile() || info.isSymbolicLink()) fail('INVALID_PATH', 'Expected an owned regular record file.');
  return info;
};
const smallJson = async file => {
  if ((await regular(file)).size > FOLDER_LIMITS.recordBytes) fail('RECORD_TOO_LARGE', 'Metadata exceeds its bound.');
  return JSON.parse(await readFile(file, 'utf8'));
};
const safeChild = async (parent, name, create = false) => {
  const directory = path.join(parent, name);
  if (create) await mkdir(directory).catch(error => { if (error.code !== 'EEXIST') throw error; });
  const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink()) fail('INVALID_PATH', 'Owned record directories cannot be links.');
  return directory;
};

// A single bounded line is read at a time, including when reopening at a byte
// cursor. Never use readFile/readline on the potentially unbounded record file.
const lineAt = async (handle, position, ceiling, cache = {}) => {
  if (position >= ceiling) return null;
  const chunks = []; let size = 0, offset = position;
  while (offset < ceiling) {
    if (!cache.buffer || offset < cache.offset || offset >= cache.offset + cache.buffer.length) {
      const buffer = Buffer.alloc(Math.min(FOLDER_LIMITS.readBytes, ceiling - offset));
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, offset);
      if (!bytesRead) fail('CORRUPT_RECORDS', 'Committed record bytes are missing.');
      cache.buffer = buffer.subarray(0, bytesRead); cache.offset = offset;
    }
    const available = cache.buffer.subarray(offset - cache.offset, Math.min(cache.buffer.length, ceiling - cache.offset));
    const newline = available.indexOf(10);
    const length = newline < 0 ? available.length : newline;
    size += length;
    if (size + 1 > FOLDER_LIMITS.recordBytes) fail('RECORD_TOO_LARGE', 'Stored record exceeds its bound.');
    chunks.push(available.subarray(0, length)); offset += length;
    if (newline >= 0) {
      let value;
      try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, size))); }
      catch { fail('CORRUPT_RECORDS', 'Invalid committed JSONL record.'); }
      return { value, next: offset + 1, bytes: size + 1 };
    }
  }
  fail('CORRUPT_RECORDS', 'Committed record has an incomplete final line.');
};

// This adapter has no independent storage root or identity source. rab-memory
// supplies both; it is the only production owner that composes this adapter.
export const createFolderRecords = ({ rabHome, allocateId, allocateIds, projectDirectory }) => {
  const locate = async ({ projectId, kind, id }, create = false) => {
    assertNumericId(projectId); assertNumericId(id);
    if (!['index', 'batch'].includes(kind)) fail('BAD_RECORD_SCOPE', 'Expected index or batch scope.');
    const project = path.resolve(await projectDirectory(projectId));
    const home = await realpath(rabHome);
    if (!inside(home, project) || project === home) fail('INVALID_PATH', 'Record storage must stay in its owning home.');
    if ((await realpath(project)) !== project || (await lstat(project)).isSymbolicLink()) fail('INVALID_PATH', 'Project record storage cannot be redirected.');
    const collection = await safeChild(project, kind === 'index' ? 'indexes' : 'batches', create);
    const directory = create ? path.join(collection, String(id)) : await safeChild(collection, String(id));
    if (create) await mkdir(directory); // exclusive reservation; never reopen an existing writer
    return { project, directory };
  };
  const descriptor = async args => {
    const location = await locate(args);
    const settings = await smallJson(path.join(location.directory, 'settings.json'));
    if (settings.id !== args.id || settings.meta?.parent?.id !== args.projectId || settings.meta?.role !== `folder-${args.kind}`) fail('BAD_RECORD_SCOPE', 'Record descriptor does not match its scope.');
    return { ...location, settings };
  };
  const reference = (projectId, kind, id, directory) => ({ version: 'folder-records/v1', project_id: projectId, kind, id, file: path.join(directory, 'records.jsonl'), settings_file: path.join(directory, 'settings.json'), state_file: path.join(directory, 'state.json') });

  const create = async ({ projectId, kind, sourceRoot, indexId = null, tool = null, folderPaths }) => {
    assertNumericId(projectId);
    if (kind === 'batch') {
      const index = await descriptor({ projectId, kind: 'index', id: indexId });
      sourceRoot = index.settings.meta.source_root;
    }
    if (typeof sourceRoot !== 'string' || !path.isAbsolute(sourceRoot)) fail('INVALID_PATH', 'Source root must be absolute.');
    const id = await allocateId(), { directory } = await locate({ projectId, kind, id }, true);
    const settings = makeNode({ id, name: String(id), title: kind === 'index' ? 'Folder index' : 'Folder batch', description: 'Project-owned incremental folder records.', settings: [], meta: { kind: 'execution', role: `folder-${kind}`, parent: { kind: 'project', id: projectId }, source_root: sourceRoot, index_id: indexId, tool } });
    if (folderPaths !== undefined) settings.meta.folder_paths = folderPaths;
    await atomic(path.join(directory, 'settings.json'), settings);
    const records = await open(path.join(directory, 'records.jsonl'), 'wx+');
    let queue = null;
    try { if (kind === 'index') queue = await open(path.join(directory, 'pending.jsonl'), 'wx+'); }
    catch (error) { await records.close(); throw error; }
    let closed = false, finished = false, busy = false, recordBytes = 0, queueBytes = 0, queueRead = 0;
    const queueReadCache = {};
    let state = { version: 'folder-record-state/v1', id, project_id: projectId, kind, status: 'running', start_date: new Date().toISOString(), end_date: null, records: 0, committed_bytes: 0, queue_bytes: 0, queue_read: 0, counts: {}, progress: null, error: null };
    const exclusive = async operation => {
      if (closed || finished) fail('RECORDS_CLOSED', 'Record sink is closed.');
      if (busy) fail('CONCURRENT_APPEND', 'Await each record operation; do not enqueue unbounded writes.');
      busy = true;
      try { return await operation(); } finally { busy = false; }
    };
    const save = async patch => {
      const allowed = new Set(['counts', 'progress', 'error']);
      for (const key of Object.keys(patch)) if (!allowed.has(key)) fail('BAD_RECORD_STATE', `Unsupported state field: ${key}.`);
      await records.sync(); if (queue) await queue.sync();
      const next = { ...state, ...patch, committed_bytes: recordBytes, queue_bytes: queueBytes, queue_read: queueRead, updated_at: new Date().toISOString() };
      await atomic(path.join(directory, 'state.json'), next); state = next;
      return { ...state };
    };
    const close = async () => { if (closed) return; closed = true; await Promise.all([records.close(), queue?.close()]); };
    try { await save({}); } catch (error) { await close(); throw error; }
    return Object.freeze({ id, reference: reference(projectId, kind, id, directory),
      allocateIds: count => allocateIds(count),
      enqueue: row => exclusive(async () => {
        if (!queue) fail('BAD_RECORD_SCOPE', 'Only an index has a pending-folder queue.');
        queueBytes += await writeAll(queue, boundedFolderJson(row) + '\n', queueBytes);
      }),
      nextFolder: () => exclusive(async () => {
        if (!queue) fail('BAD_RECORD_SCOPE', 'Only an index has a pending-folder queue.');
        const row = await lineAt(queue, queueRead, queueBytes, queueReadCache);
        if (!row) return null;
        queueRead = row.next; return row.value;
      }),
      append: row => exclusive(async () => {
        if (!plain(row)) fail('BAD_RECORD', 'Expected a record object.');
        boundedFolderJson(row);
        const value = { ...row, sequence: state.records + 1 };
        recordBytes += await writeAll(records, boundedFolderJson(value) + '\n', recordBytes);
        state.records++; return state.records;
      }),
      checkpoint: (patch = {}) => exclusive(() => save(patch)),
      finish: (status = 'completed', patch = {}) => exclusive(async () => {
        if (!['completed', 'partial', 'cancelled', 'timed_out', 'failed'].includes(status)) fail('BAD_RECORD_STATE', 'Invalid terminal status.');
        state = { ...state, status, end_date: new Date().toISOString() };
        const saved = await save(patch); finished = true; return { reference: reference(projectId, kind, id, directory), state: saved };
      }),
      close
    });
  };

  const getFolderRecordStatus = async ({ projectId, kind, id }) => {
    const { directory, settings } = await descriptor({ projectId, kind, id });
    const state = await smallJson(path.join(directory, 'state.json'));
    if (state.id !== id || state.project_id !== projectId || state.kind !== kind || !Number.isSafeInteger(state.committed_bytes) || state.committed_bytes < 0) fail('CORRUPT_RECORDS', 'Invalid record state.');
    return { reference: reference(projectId, kind, id, directory), settings, state };
  };
  const readFolderRecordPage = async ({ projectId, kind, id, cursor = null, limit = FOLDER_LIMITS.pageRows }) => {
    if (!Number.isInteger(limit) || limit < 1 || limit > FOLDER_LIMITS.pageRows) fail('BAD_CURSOR', 'Invalid page limit.');
    const status = await getFolderRecordStatus({ projectId, kind, id });
    let offset = 0, ceiling = status.state.committed_bytes;
    if (cursor !== null) {
      if (!plain(cursor) || cursor.project_id !== projectId || cursor.kind !== kind || cursor.id !== id || !Number.isSafeInteger(cursor.offset) || cursor.offset < 0 || !Number.isSafeInteger(cursor.ceiling) || cursor.ceiling > ceiling || cursor.ceiling < cursor.offset) fail('BAD_CURSOR', 'Cursor does not belong to this committed record stream.');
      offset = cursor.offset; ceiling = cursor.ceiling;
    }
    await regular(status.reference.file);
    const handle = await open(status.reference.file, 'r');
    const items = [], readCache = {}; let bytes = 0;
    try {
      if (offset > 0) { const before = Buffer.alloc(1); await handle.read(before, 0, 1, offset - 1); if (before[0] !== 10) fail('BAD_CURSOR', 'Cursor is not at a record boundary.'); }
      while (offset < ceiling && items.length < limit) {
        const row = await lineAt(handle, offset, ceiling, readCache);
        if (bytes + row.bytes > FOLDER_LIMITS.pageBytes - 2048) break;
        items.push(row.value); bytes += row.bytes; offset = row.next;
      }
    } finally { await handle.close(); }
    const next = offset < ceiling ? { project_id: projectId, kind, id, offset, ceiling } : null;
    return { items, cursor: next, committed_bytes: ceiling, status: status.state.status };
  };
  const iterateFolderIndex = async function* ({ projectId, indexId, signal }) {
    let cursor = null;
    do {
      if (signal?.aborted) fail('SCAN_CANCELLED', 'Folder iteration cancelled.');
      const page = await readFolderRecordPage({ projectId, kind: 'index', id: indexId, cursor });
      for (const row of page.items) { if (signal?.aborted) fail('SCAN_CANCELLED', 'Folder iteration cancelled.'); yield row; }
      cursor = page.cursor;
    } while (cursor);
  };
  return Object.freeze({
    createFolderIndex: args => create({ ...args, kind: 'index' }),
    createFolderBatch: args => create({ ...args, kind: 'batch' }),
    readFolderRecordPage, getFolderRecordStatus, iterateFolderIndex
  });
};
