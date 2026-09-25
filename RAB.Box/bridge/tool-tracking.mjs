import { createHash } from 'node:crypto';
import { insist } from '../engine/src/core.mjs';
import { canonicalizeShape } from './shape-codec.mjs';
// Internal callers reserve before recording dispatch. This consumes that ID once;
// nested executions still allocate through the same local memory owner.
export const reservedExecutionMemory = (memory,id) => {
  if(!Number.isSafeInteger(id)||id<=0)throw Object.assign(new Error('Invalid reserved execution ID.'),{code:'BAD_ID'});
  let pending=true;
  return Object.freeze({...memory,allocateId:async()=>{if(pending){pending=false;return id;}return memory.allocateId();}});
};

const jsonText = value => {
  try { return JSON.stringify(value) ?? 'null'; }
  catch { return JSON.stringify(canonicalizeShape(value)) ?? 'null'; }
};
export const jsonBytes = value => Buffer.byteLength(jsonText(value), 'utf8');
export const pointerKey = key => String(key).replaceAll('~', '~0').replaceAll('/', '~1');

// Tracking describes a value; the report owns its contents. Bound even unusual inputs.
export const compactValue = (value, limit = 2048) => {
  const json = jsonText(value);
  const bytes = Buffer.byteLength(json, 'utf8');
  return bytes <= limit ? JSON.parse(json) : { omitted: true, bytes, sha256: createHash('sha256').update(json).digest('hex') };
};

export const newExecution = ({ id, key, parentExecutionId = null }) => {
  insist(Number.isSafeInteger(id) && id > 0, 'BAD_EXECUTION_ID', 'Execution ID must be allocated by the shared memory owner.');
  insist(parentExecutionId === null || (Number.isSafeInteger(parentExecutionId) && parentExecutionId > 0), 'BAD_EXECUTION_ID', 'Parent execution ID must be a positive safe integer or null.');
  return {
    version: 'tool-execution/v2',
    execution_id: id,
    parent_execution_id: parentExecutionId,
    session_id: null,
    project_key: null,
    tool: { id: null, address: key },
    options: {},
    start_date: new Date().toISOString(),
    end_date: null,
    duration_ms: null,
    status: 'running',
    result_ref: null,
    result_bytes: null,
    error: null
  };
};

export const resultReference = (file, pointer) => ({ version: 'tool-result-ref/v1', file, pointer });

export const compactReceipt = receipt => ({
  ...receipt,
  steps: (receipt.steps ?? []).map(step => {
    if (!step.result_file) return step;
    const { result, seats, tasks, ...tracking } = step;
    return tracking;
  })
});

// Preserve the public root result verbatim. Trace entries and returned seats point
// into that result, or into child_results when a composite did not return a child.
export const packToolReport = output => {
  const locations = new WeakMap();
  const index = (value, pointer) => {
    if (!value || typeof value !== 'object' || locations.has(value)) return;
    locations.set(value, pointer);
    for (const [key, child] of Object.entries(value)) index(child, `${pointer}/${pointerKey(key)}`);
  };
  index(output.result, '#/result');
  const childResults = {}, pointers = new Map();
  for (const task of output.tasks ?? []) {
    const id = task.execution.execution_id;
    let pointer = task.parentTaskId === null && task.execution.result_bytes !== null ? '#/result' : locations.get(task.result);
    if (!pointer && task.execution.result_bytes !== null) {
      pointer = `#/child_results/${pointerKey(id)}`;
      childResults[id] = task.result;
      index(task.result, pointer);
    }
    pointers.set(id, pointer ?? null);
  }
  const pack = (value, pointer) => {
    if (!value || typeof value !== 'object') return value;
    const known = locations.get(value);
    if (known) return { $ref: known };
    locations.set(value, pointer);
    return Array.isArray(value)
      ? value.map((child, i) => pack(child, `${pointer}/${i}`))
      : Object.fromEntries(Object.entries(value).map(([key, child]) => [key, pack(child, `${pointer}/${pointerKey(key)}`)]));
  };
  const report = {
    tool: output.tool,
    options: output.options,
    result: output.result,
    ...(output.error ? { error: output.error } : {}),
    child_results: childResults,
    seats: pack(output.seats ?? {}, '#/seats'),
    authority: output.authority,
    transition: output.transition ? {
      task_id: output.transition.task_id,
      capability: output.transition.capability,
      authority: output.authority
    } : null,
    tasks: (output.tasks ?? []).map(task => ({
      execution_id: task.execution.execution_id,
      parent_execution_id: task.execution.parent_execution_id,
      tool: task.execution.tool,
      status: task.execution.status,
      result_ref: pointers.get(task.execution.execution_id) ? { $ref: pointers.get(task.execution.execution_id) } : null,
      error: task.execution.error
    }))
  };
  return { report, pointers };
};
