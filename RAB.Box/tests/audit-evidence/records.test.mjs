import test from 'node:test';
import assert from 'node:assert/strict';
import { findAssignedClasses, findDefinedClasses, buildClassIndex } from '../../tools/audit/_engines/class-search.mjs';
import { investigateClass } from '../../tools/audit/_evidence/class-investigation.mjs';
import { classIndexFromReport, resolveEvidenceReference, validateRecords } from '../../tools/audit/_evidence/records.mjs';
import { packToolReport } from '../../bridge/tool-tracking.mjs';

const projectId = 1789940000001, classExecutionId = 1789940000002, investigationExecutionId = 1789940000003;

const fixture = () => {
  const definitions = { rows: findDefinedClasses('.ui-action:active, .ui-action.is-active { color:var(--ink); }\n.other {}', 'atoms.css') };
  const assignments = { rows: findAssignedClasses('const Button = () => <button className={`ui-action ${state}`} />;\n<div class="ui-action" />', 'Button.tsx', { javascript: true }) };
  return { status: 'ok', folder: 'C:/fixture', ...buildClassIndex(definitions, assignments),
    scope: { definitions: { files: ['.css'], excluded_directories: ['.rab'] }, assignments: { files: 'UTF-8 text files', excluded_directories: ['.rab'] } }, skipped: [] };
};
const input = result => ({ result, source: { execution_id: classExecutionId, project_id: projectId, tool: { key: 'audit/count/classes' } }, project: { id: projectId, root: `C:/memory/${projectId}` }, className: 'ui-action' });

test('class evidence is deterministic, nonmutating, and preserves every occurrence and unresolved gap', () => {
  const result = fixture(), original = structuredClone(result), args = input(result);
  const first = investigateClass(args), second = investigateClass(args);
  assert.deepEqual(first, second); assert.deepEqual(result, original);
  assert.equal(first.version, 'audit-evidence/v1');
  assert.ok(first.entities.every(entity => typeof entity.id === 'string'), 'Evidence entity IDs retain their v1 identity format.');
  assert.ok(first.entities.every(entity => entity.evidence.every(ref => ref.execution_id === classExecutionId)));
  assert.equal(first.entities.filter(x => x.kind === 'class-definition').length, 2);
  assert.equal(first.entities.filter(x => x.kind === 'class-usage').length, 2);
  assert.deepEqual(first.conclusions[0].consumers, ['Button.tsx']);
  assert.equal(first.findings.find(x => x.kind === 'dynamic-assignments').count, 1);
  assert.ok(first.findings.some(x => x.kind === 'unversioned-source'));
  assert.equal(first.conclusions[0].automatic_change_eligible, false);
  assert.equal(first.coverage.completeness, 'partial');
});

test('all references resolve after the actual report packer assigns child pointers', () => {
  const result = fixture(), records = investigateClass(input(result));
  const tasks = [
    { parentTaskId: null, execution: { execution_id: investigationExecutionId, parent_execution_id: null, result_bytes: 100, tool: { key: 'audit/inspect/class-impact' }, status: 'completed' }, result: records },
    { parentTaskId: investigationExecutionId, execution: { execution_id: classExecutionId, parent_execution_id: investigationExecutionId, result_bytes: 100, tool: { key: 'audit/count/classes' }, status: 'completed' }, result }
  ];
  const { report } = packToolReport({ tool: { key: 'audit/inspect/class-impact' }, result: records, tasks });
  const saved = { version: 'audit-result/v1', project_id: projectId, execution_id: investigationExecutionId, ...report };
  const source = classIndexFromReport(saved, { file: 'C:/memory/report.json' });
  assert.deepEqual(source.result, result);
  for (const rows of [records.entities, records.relations, records.findings, records.investigations, records.conclusions]) {
    for (const row of rows) for (const ref of row.evidence) assert.notEqual(resolveEvidenceReference(saved, ref), undefined);
  }
});

test('evidence keeps v1 entity IDs but rejects invalid execution references', () => {
  const records = investigateClass(input(fixture()));
  for (const invalid of ['class-execution', String(classExecutionId), 0, -1, Number.MAX_SAFE_INTEGER + 1]) {
    const changed = structuredClone(records);
    changed.entities[0].evidence[0].execution_id = invalid;
    assert.throws(() => validateRecords(changed), { code: 'BAD_EVIDENCE' });
  }
  assert.ok(records.entities.every(entity => typeof entity.id === 'string'));
  assert.equal(validateRecords(records), records);
});

test('missing or ambiguous executions and unsupported report versions fail explicitly', () => {
  assert.throws(() => classIndexFromReport({ version: 'audit-result/v2' }), { code: 'BAD_EVIDENCE' });
  const task = { execution_id: classExecutionId, status: 'completed', tool: { key: 'audit/count/classes' }, result_ref: { $ref: '#/result' } };
  assert.throws(() => classIndexFromReport({ version: 'audit-result/v1', tasks: [task, { ...task, execution_id: investigationExecutionId }] }), { code: 'BAD_EVIDENCE' });
  assert.throws(() => classIndexFromReport({ version: 'audit-result/v1', tasks: [task] }), { code: 'BAD_EVIDENCE' });
});

test('case and absent matches remain exact; no-match never means unused', () => {
  const records = investigateClass({ ...input(fixture()), className: 'UI-ACTION' });
  assert.equal(records.conclusions[0].consumers.length, 0);
  assert.ok(records.findings.find(x => x.kind === 'no-observed-usage').summary.includes('does not establish'));
  assert.equal(records.entities[0].state.origin, 'requested');
});

test('malformed locations, aggregate counts, foreign projects, and dangling relations are rejected', () => {
  for (const file of ['../escape.tsx', 'C:\\escape.tsx', '/escape.tsx', 'nested/../escape']) {
    const result = fixture(); result.counts[0].locations[0].file = file;
    assert.throws(() => investigateClass(input(result)), { code: 'BAD_EVIDENCE' });
  }
  const result = fixture(); result.count++;
  assert.throws(() => investigateClass(input(result)), { code: 'BAD_EVIDENCE' });
  assert.throws(() => investigateClass({ ...input(fixture()), project: { id: projectId + 10 } }), { code: 'BAD_EVIDENCE' });
  const records = investigateClass(input(fixture())); records.relations[0].to = 'missing';
  assert.throws(() => validateRecords(records), { code: 'BAD_EVIDENCE' });
});

test('prototype-looking names are plain data and identity is scoped to project and revision', () => {
  const rows = findAssignedClasses('<b class="__proto__ constructor"/>', 'a.html');
  const result = { ...fixture(), ...buildClassIndex({ rows: [] }, { rows }) };
  const first = investigateClass({ ...input(result), className: '__proto__' });
  assert.equal(first.conclusions[0].consumers[0], 'a.html');
  const second = investigateClass({ ...input(result), source: { execution_id: classExecutionId + 10 }, className: '__proto__', project: { id: projectId + 10 } });
  assert.notEqual(first.entities[0].id, second.entities[0].id);
});

test('inconsistent source snapshots and skipped inputs remain visible', () => {
  const result = fixture(); result.source_snapshot = { consistent: false }; result.skipped = [{ file: 'secret.css', reason: 'read-error', code: 'EACCES' }];
  const records = investigateClass(input(result));
  assert.ok(records.findings.some(x => x.kind === 'inconsistent-source'));
  assert.deepEqual(records.coverage.skipped, result.skipped);
  assert.ok(records.findings.some(x => x.kind === 'skipped-input'));
});
