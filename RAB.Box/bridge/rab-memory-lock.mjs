import { mkdir, writeFile, readFile, unlink, rmdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

// Cooperating processes serialize the whole operation, not just its final rename.
// Never steal a lock based on age/PID alone: interrupted owners require inspection.
export const withMemoryLock = async (directory, operation, { timeoutMs = 15000 } = {}) => {
  const lock = path.resolve(directory);
  await mkdir(path.dirname(lock), { recursive: true });
  const started = performance.now();
  while (true) {
    try { await mkdir(lock); break; }
    catch (error) {
      // Windows can briefly deny mkdir while the prior owner's directory is
      // being removed. Retry only within the same acquisition deadline; never
      // delete or steal the existing owner directory.
      if (error.code !== 'EEXIST' && !(process.platform === 'win32' && ['EPERM','EACCES','EBUSY'].includes(error.code))) throw error;
      if (performance.now() - started >= timeoutMs) {
        let owner = null;
        try { owner = JSON.parse(await readFile(path.join(lock, 'owner.json'), 'utf8')); } catch {}
        throw Object.assign(new Error(`Project memory is locked; inspect the owner before retrying: ${lock}`), {
          code: 'MEMORY_LOCK_TIMEOUT', details: { lock, owner, timeout_ms: timeoutMs, last_error: error.code }
        });
      }
      await delay(10 + Math.floor(Math.random() * 20));
    }
  }
  let failure = null;
  try {
    await writeFile(path.join(lock, 'owner.json'), JSON.stringify({
      token: randomUUID(), pid: process.pid, host: os.hostname(), acquired_at: new Date().toISOString()
    }), { flag: 'wx' });
    return await operation();
  } catch (error) { failure = error; throw error; }
  finally {
    try {
      await unlink(path.join(lock, 'owner.json')).catch(error => { if (error.code !== 'ENOENT') throw error; });
      await rmdir(lock);
    } catch (error) {
      if (failure) failure.lock_release_error = { code: error.code, message: error.message, lock };
      else throw Object.assign(new Error(`Memory operation returned but its lock could not be released: ${lock}`, { cause: error }), {
        code: 'MEMORY_LOCK_RELEASE_FAILED', details: { lock, operation_may_have_completed: true }
      });
    }
  }
};
