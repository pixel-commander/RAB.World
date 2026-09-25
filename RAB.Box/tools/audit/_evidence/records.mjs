import { createHash } from 'node:crypto';
import path from 'node:path';

export const EVIDENCE_VERSION = 'audit-evidence/v1';
export const collections = ['entities', 'relations', 'findings', 'investigations', 'conclusions', 'plans'];
export const insistEvidence = (condition, message) => {
  if (!condition) throw Object.assign(new Error(message), { code: 'BAD_EVIDENCE' });
};
export const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const canonical = value => Array.isArray(value) ? value.map(canonical) : object(value)
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
export const digest = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(canonical(value))).digest('hex');
export const identity = (kind, ...values) => `${kind}:${digest(values).slice(0, 32)}`;
export const relativeSource = value => {
  insistEvidence(typeof value === 'string' && value.length > 0 && !value.includes('\0'), 'Evidence needs a relative source file.');
  const normalized = value.replaceAll('\\', '/');
  insistEvidence(!path.posix.isAbsolute(normalized) && !path.win32.isAbsolute(value) && !normalized.split('/').some(x => x === '..' || x === '' || x === '.'), 'Evidence source file leaves the scan root.');
  return normalized;
};

// Only follow references inside this report. Reading external files is the storage owner's job.
export const atPointer = (report, pointer) => {
  insistEvidence(typeof pointer === 'string' && /^#(?:\/|$)/.test(pointer), 'Invalid evidence pointer.');
  let current = report;
  if (pointer === '#') return current;
  for (const token of pointer.slice(2).split('/')) {
    insistEvidence(!/~(?![01])/u.test(token), 'Invalid JSON pointer escape.');
    const key = token.replaceAll('~1', '/').replaceAll('~0', '~');
    insistEvidence(current !== null && typeof current === 'object' && Object.hasOwn(current, key), `Missing evidence pointer: ${pointer}`);
    current = current[key];
  }
  return current;
};

export const validateRecords = records => {
  insistEvidence(records?.version === EVIDENCE_VERSION, 'Unsupported evidence version.');
  insistEvidence(typeof records.revision === 'string' && /^[a-f0-9]{64}$/.test(records.revision), 'Evidence revision is required.');
  insistEvidence(object(records.project) && ((Number.isSafeInteger(records.project.id)&&records.project.id>0)||(typeof records.project.id === 'string' && records.project.id.length > 0)), 'Evidence project identity is required.');
  const ids = new Set();
  for (const collection of collections) {
    insistEvidence(Array.isArray(records[collection]), `Missing evidence collection: ${collection}`);
    for (const row of records[collection]) {
      insistEvidence(object(row) && typeof row.id === 'string' && !ids.has(row.id), 'Evidence IDs must be unique.');
      ids.add(row.id);
      insistEvidence(Array.isArray(row.evidence), `${row.id}: missing evidence references.`);
      for (const ref of row.evidence) {
        insistEvidence(object(ref) && Number.isSafeInteger(ref.execution_id) && ref.execution_id > 0 && typeof ref.pointer === 'string' && ref.pointer.startsWith('#/'), 'Evidence must identify an execution and result-relative pointer.');
      }
    }
  }
  const entities = new Set(records.entities.map(row => row.id));
  for (const relation of records.relations) insistEvidence(entities.has(relation.from) && entities.has(relation.to), 'Relation refers to an unknown entity.');
  for (const conclusion of records.conclusions) {
    insistEvidence(ids.has(conclusion.investigation), 'Conclusion needs its investigation.');
    for (const id of [...(conclusion.supports ?? []), ...(conclusion.gaps ?? [])]) insistEvidence(ids.has(id), 'Conclusion refers to unknown evidence records.');
  }
  return records;
};

export const classIndexFromReport = (report, { file = null, executionId = null } = {}) => {
  insistEvidence(report?.version === 'audit-result/v1', 'Unsupported saved audit report version.');
  insistEvidence(!report.error, 'A failed or partial report cannot establish completed evidence.');
  const candidates = (report.tasks ?? []).filter(task => task.tool?.key === 'audit/count/classes' || task.tool?.address === 'count-classes');
  let task = executionId ? candidates.find(item => item.execution_id === executionId) : candidates.length === 1 ? candidates[0] : null;
  if (!task && !executionId && report.tool?.key === 'audit/count/classes') task = { execution_id: report.execution_id, status: 'completed', result_ref: { $ref: '#/result' }, tool: report.tool };
  insistEvidence(task && task.status === 'completed' && typeof task.result_ref?.$ref === 'string', 'Choose one completed class-index execution in the report.');
  const result = atPointer(report, task.result_ref.$ref);
  insistEvidence(typeof result?.folder === 'string' && (path.isAbsolute(result.folder) || path.win32.isAbsolute(result.folder)), 'Class evidence needs an absolute scan root.');
  if (report.options?.folder) insistEvidence(path.resolve(report.options.folder) === path.resolve(result.folder), 'Bound audit root conflicts with the class evidence root.');
  return { result, source: {
    execution_id: task.execution_id, tool: task.tool, report: file,
    report_pointer: task.result_ref.$ref, report_sha256: digest(report), observed_at: report.saved_at ?? null,
    session_id: report.session_id ?? null, project_id: report.project_id ?? null
  } };
};

export const resolveEvidenceReference = (report, reference) => {
  const task = report.tasks?.find(item => item.execution_id === reference.execution_id);
  const root = task?.result_ref?.$ref ?? (report.execution_id === reference.execution_id ? '#/result' : null);
  insistEvidence(root && typeof reference.pointer === 'string' && reference.pointer.startsWith('#/'), 'Referenced execution is absent from this report.');
  return atPointer(report, root + reference.pointer.slice(1));
};
