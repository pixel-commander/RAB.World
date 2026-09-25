import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fork } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, open } from 'node:fs/promises';
import { createToolHouse } from '../../bridge/tool-house.mjs';
import { boundedFolderJson } from '../../bridge/rab-folder-records.mjs';

const WORKER = fileURLToPath(new URL('./_folder-batch-worker.mjs', import.meta.url));
const fail = (code, message) => { throw Object.assign(new Error(message), { code }); };
const errorRecord = error => ({ code: String(error.code ?? 'ERROR').slice(0, 80), message: String(error.message).slice(0, 1024) });

export const fingerprintDirectFolderTool = async tool => {
  if (tool.meta.input_scope !== 'direct-folder' || !['read', 'pure'].includes(tool.authorityClass) || !tool.settings.some(field => field.name === 'folder' && field.type === 'folder')) fail('UNSUPPORTED_FOLDER_SCOPE', 'Batch tools must declare direct-folder input and read/pure authority.');
  const hash = createHash('sha256').update(String(tool.id));
  for (const [file, limit] of [[tool.settingsFile, 64 * 1024], [tool.scriptFile, 1024 * 1024]]) {
    const info = await lstat(file);
    if (!info.isFile() || info.isSymbolicLink() || info.size > limit) fail('BAD_WORKER_TOOL', 'Tool settings/executor must be bounded regular files.');
    const handle = await open(file, 'r'), buffer = Buffer.alloc(16384); let size = 0;
    try {
      for (;;) {
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
        if (!bytesRead) break;
        size += bytesRead;
        if (size > limit) fail('BAD_WORKER_TOOL', 'Tool source grew beyond its bound.');
        hash.update(buffer.subarray(0, bytesRead));
      }
      hash.update('\0');
    } finally { await handle.close(); }
  }
  return hash.digest('hex');
};

const executeFolder = ({ config, timeoutMs, signal }) => {
  const request = boundedFolderJson(config, 16 * 1024);
  return new Promise(resolve => {
  const start = performance.now();
  const startDate = new Date().toISOString();
  const child = fork(WORKER, [], {
    execArgv: ['--max-old-space-size=96'], windowsHide: true,
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'], serialization: 'json',
    env: { ...process.env, RAB_HOME: config.rabHome, NODE_OPTIONS: '' }
  });
  let outcome = null, settled = false, timer;
  const stop = (code, message, status) => {
    if (settled || outcome) return;
    outcome = { status, error: { code, message }, execution: null };
    child.kill('SIGKILL');
  };
  const cancel = () => stop('SCAN_CANCELLED', 'Folder execution cancelled.', 'cancelled');
  timer = setTimeout(() => stop('FOLDER_TIMEOUT', 'Folder execution exceeded its time limit.', 'timed_out'), timeoutMs);
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) cancel();
  child.on('message', message => {
    if (outcome) return;
    if (typeof message !== 'string' || Buffer.byteLength(message) > 48 * 1024) {
      stop('RESULT_TOO_LARGE', 'Worker response exceeds the IPC bound.', 'failed'); return;
    }
    try {
      const parsed = JSON.parse(message);
      boundedFolderJson(parsed, 48 * 1024);
      if (!['completed', 'failed'].includes(parsed.status)) fail('BAD_WORKER_RESULT', 'Invalid worker status.');
      outcome = parsed;
      // A tool may have left a timer open. Receipt is complete; end the owned
      // process instead of letting an unrelated timer hang the batch.
      child.kill('SIGKILL');
    } catch (error) { stop('BAD_WORKER_RESULT', String(error.message).slice(0, 1024), 'failed'); }
  });
  const finish = (code = null, signalName = null) => {
    if (settled) return;
    settled = true; clearTimeout(timer); signal?.removeEventListener('abort', cancel);
    const result = outcome ?? { status: 'failed', execution: null, error: { code: 'WORKER_EXIT', message: `Worker exited without a result (${code ?? signalName ?? 'unknown'}).` } };
    result.execution ??= { version: 'tool-execution/v2', execution_id: config.executionId, parent_execution_id: null, status: 'interrupted', start_date: null, end_date: null, duration_ms: null };
    resolve({ ...result, process_start_date: startDate, process_end_date: new Date().toISOString(), duration_ms: Math.max(0, performance.now() - start) });
  };
  child.once('error', error => { outcome ??= { status: 'failed', execution: null, error: errorRecord(error) }; finish(); });
  child.once('close', finish);
  child.send(request, error => { if (error) stop('WORKER_SEND_FAILED', String(error.message).slice(0, 1024), 'failed'); });
  });
};

export const runFolderBatch = async ({ memory, projectId, indexId, root, toolsRoot = path.join(root, 'tools'), toolKey, options = {}, folderPaths, signal, timeoutMs = 10000, maxDurationMs = 300000 }) => {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 25 || timeoutMs > 300000 || !Number.isSafeInteger(maxDurationMs) || maxDurationMs < 1 || maxDurationMs > 86400000) fail('BAD_SCAN_LIMIT', 'Invalid batch or per-folder time limit.');
  if (!options || typeof options !== 'object' || Array.isArray(options)) fail('BAD_REQUEST', 'Tool options must be an object.');
  boundedFolderJson(options, 8192);
  if (Object.hasOwn(options, 'folder')) fail('BAD_REQUEST', 'The index owns the folder input; options cannot override it.');
  let selected = null;
  if (folderPaths !== undefined) {
    if (!Array.isArray(folderPaths) || !folderPaths.length || folderPaths.length > 1000) fail('BAD_FOLDER_SELECTION', 'Select 1–1000 indexed folder paths, or omit folder_paths for the whole index.');
    boundedFolderJson(folderPaths, 16 * 1024);
    selected = new Set();
    for (const value of folderPaths) {
      if (typeof value !== 'string' || !value || /[\x00-\x1f:]/.test(value)) fail('BAD_FOLDER_SELECTION', 'Each selection must be a relative indexed folder path.');
      const normalized = value.replaceAll('\\', '/');
      if (normalized !== '.' && normalized.split('/').some(part => !part || part === '.' || part === '..')) fail('BAD_FOLDER_SELECTION', 'Use exact indexed paths without traversal, absolute paths, or empty segments.');
      selected.add(normalized);
    }
  }
  const index = await memory.getFolderRecordStatus({ projectId, kind: 'index', id: indexId });
  if (!['completed', 'partial'].includes(index.state.status)) fail('INDEX_NOT_SEALED', 'A batch requires a finished folder index.');
  const house = createToolHouse({ root, toolsRoot }), tool = await house.getTool(toolKey);
  const fingerprint = await fingerprintDirectFolderTool(tool);
  const bound = house.bindSettings(tool, { ...options, folder: index.settings.meta.source_root });
  if (bound.missing.length) fail('INPUT_REQUIRED', 'Direct-folder tool needs more input.');
  // Validate against saved index records before creating a batch or dispatching
  // any worker. This reads the index, never discovers the source tree again.
  if (selected) {
    const missing = new Set(selected), validationStart = performance.now();
    for await (const row of memory.iterateFolderIndex({ projectId, indexId, signal })) {
      if (signal?.aborted) fail('SCAN_CANCELLED', 'Folder selection cancelled.');
      if (performance.now() - validationStart >= maxDurationMs) fail('SCAN_TIMEOUT', 'Folder selection reached its time limit.');
      if (row.kind === 'folder') missing.delete(row.path);
    }
    if (missing.size) fail('UNKNOWN_INDEX_FOLDER', `Selection contains ${missing.size} folder path(s) absent from this index.`);
  }
  const configBase = { root, toolsRoot, rabHome: memory.rabHome, toolKey, toolId: tool.id, fingerprint, options, sourceRoot: index.settings.meta.source_root };
  boundedFolderJson(configBase, 12 * 1024);
  const sink = await memory.createFolderBatch({ projectId, indexId, tool: { id: tool.id, key: tool.key, fingerprint }, ...(selected ? { folderPaths: [...selected] } : {}) });
  const counts = { completed: 0, failed: 0, skipped: 0, timed_out: 0, cancelled: 0 };
  const started = performance.now(); let terminal = 'completed', terminalError = null, current = null;
  try {
    for await (const row of memory.iterateFolderIndex({ projectId, indexId, signal })) {
      if (performance.now() - started >= maxDurationMs) fail('SCAN_TIMEOUT', 'Batch reached its time limit.');
      if (signal?.aborted) fail('SCAN_CANCELLED', 'Batch cancelled.');
      if (row.kind !== 'folder') continue;
      if (selected && !selected.has(row.path)) continue;
      current = { folder_id: row.id, path: row.path };
      let outcome;
      if (row.status !== 'scanned') outcome = { status: 'skipped', reason: row.reason ?? row.status, execution: null };
      else {
        const executionId = await memory.allocateId();
        await sink.checkpoint({ counts: { ...counts }, progress: { ...current, execution_id: executionId, status: 'running' } });
        try { outcome = await executeFolder({ config: { ...configBase, relativePath: row.path, executionId }, signal, timeoutMs: Math.max(1, Math.min(timeoutMs, maxDurationMs - (performance.now() - started))) }); }
        catch (error) { outcome = { status: 'failed', error: errorRecord(error), execution: { version: 'tool-execution/v2', execution_id: executionId, parent_execution_id: null, status: 'interrupted', start_date: null, end_date: null, duration_ms: null } }; }
      }
      counts[outcome.status]++;
      await sink.append({ kind: 'folder-result', index_id: indexId, folder_id: row.id, path: row.path, ...outcome });
      await sink.checkpoint({ counts: { ...counts }, progress: current });
      if (outcome.status === 'cancelled') { terminal = 'cancelled'; break; }
      if (performance.now() - started >= maxDurationMs) { terminal = 'timed_out'; terminalError = { code: 'SCAN_TIMEOUT', message: 'Batch reached its time limit.' }; break; }
      if (outcome.status !== 'completed') terminal = 'partial';
    }
  } catch (error) {
    terminal = error.code === 'SCAN_CANCELLED' ? 'cancelled' : error.code === 'SCAN_TIMEOUT' ? 'timed_out' : 'failed'; terminalError = errorRecord(error);
  }
  try { return await sink.finish(terminal, { counts, progress: current, error: terminalError }); }
  finally { await sink.close(); }
};
