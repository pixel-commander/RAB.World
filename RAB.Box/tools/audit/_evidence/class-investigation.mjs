import { EVIDENCE_VERSION, digest, identity, insistEvidence, object, relativeSource, validateRecords } from './records.mjs';

const integer = value => Number.isSafeInteger(value) && value >= 0;
export const validateClassIndex = result => {
  insistEvidence(object(result) && result.status === 'ok' && typeof result.folder === 'string', 'Expected a completed class index.');
  insistEvidence(Array.isArray(result.counts) && Array.isArray(result.unresolved), 'Class index lacks counts or unresolved expressions.');
  const names = new Set();
  for (const row of result.counts) {
    insistEvidence(object(row) && typeof row.name === 'string' && row.name && !/\s/.test(row.name) && !names.has(row.name), 'Invalid or duplicate class name.');
    names.add(row.name);
    insistEvidence([row.count, row.definitions, row.usages].every(integer) && row.count === row.definitions + row.usages, 'Class totals disagree.');
    insistEvidence(Array.isArray(row.locations) && row.locations.length === row.count && Array.isArray(row.files), 'Class locations disagree with totals.');
    let definitions = 0;
    for (const location of row.locations) {
      relativeSource(location.file);
      insistEvidence(Number.isSafeInteger(location.line) && location.line > 0 && Number.isSafeInteger(location.column) && location.column > 0, 'Class location needs positive line and column.');
      insistEvidence(['class-definition', 'class-usage'].includes(location.kind), 'Unsupported class location kind.');
      if (location.kind === 'class-definition') definitions++;
    }
    insistEvidence(definitions === row.definitions, 'Definition count disagrees with locations.');
    insistEvidence(digest([...new Set(row.locations.map(x => relativeSource(x.file)))].sort()) === digest([...row.files].map(relativeSource).sort()), 'Class file inventory disagrees with locations.');
  }
  for (const row of result.unresolved) { relativeSource(row.file); insistEvidence(row.kind === 'dynamic-class-expression', 'Unsupported unresolved class evidence.'); }
  insistEvidence(result.unique === names.size && result.count === result.counts.reduce((n, row) => n + row.count, 0), 'Aggregate class counts disagree.');
  insistEvidence(result.totals?.dynamic_assignments === result.unresolved.length, 'Dynamic expression count disagrees.');
  return result;
};

export const investigateClass = ({ result, source, project, className }) => {
  validateClassIndex(result);
  insistEvidence(typeof className === 'string' && className.length > 0 && className.length <= 512 && !/[\s\0]/.test(className), 'Choose one exact class token, without a selector prefix.');
  insistEvidence(Number.isSafeInteger(source?.execution_id) && source.execution_id > 0, 'The actual class-index execution identity is required.');
  insistEvidence((Number.isSafeInteger(project?.id) && project.id > 0) || (typeof project?.id === 'string' && project.id.length > 0), 'The selected project identity is required.');
  if (source.project_id) insistEvidence(source.project_id === project.id, 'Evidence belongs to another project.');
  const ref = pointer => ({ execution_id: source.execution_id, pointer });
  const revision = digest({ result, execution_id: source.execution_id, project_id: project.id });
  const scoped = [project.id, result.folder, revision];
  const state = { origin: 'observed', resolution: 'static', freshness: 'unknown', disposition: 'open' };
  const records = {
    version: EVIDENCE_VERSION, revision, project: { id: project.id, root: project.root ?? null },
    subject: className, scan_root: result.folder, source: structuredClone(source),
    coverage: { scope: structuredClone(result.scope ?? null), skipped: structuredClone(result.skipped ?? []),
      source_snapshot: structuredClone(result.source_snapshot ?? null), completeness: 'partial',
      limits: ['Static matches do not establish runtime selector applicability.', 'Component ownership and runtime reachability are unresolved.', 'No-match does not mean unused.'] },
    entities: [], relations: [], findings: [], investigations: [], conclusions: [], plans: []
  };
  const classId = identity('class', project.id, result.folder, className);
  const index = result.counts.findIndex(row => row.name === className), row = result.counts[index];
  records.entities.push({ id: classId, kind: 'class', name: className, identity_status: 'scoped-name', state: { ...state, origin: row ? 'observed' : 'requested' }, evidence: [ref(row ? `#/counts/${index}` : '#/counts')] });
  const files = new Map();
  for (const [i, location] of (row?.locations ?? []).entries()) {
    const file = relativeSource(location.file), fileId = identity('file', project.id, result.folder, file);
    if (!files.has(file)) {
      files.set(file, fileId);
      records.entities.push({ id: fileId, kind: 'file', name: file, identity_status: 'scoped-path', state: { ...state }, evidence: [ref(`#/counts/${index}/locations/${i}/file`)] });
    }
    const occurrenceId = identity(location.kind, ...scoped, className, i);
    const evidence = [ref(`#/counts/${index}/locations/${i}`)];
    records.entities.push({ id: occurrenceId, kind: location.kind, name: className, location: structuredClone(location), state: { ...state }, evidence });
    records.relations.push({ id: identity('contains', fileId, occurrenceId), kind: 'contains', from: fileId, to: occurrenceId, state: { ...state }, evidence });
    records.relations.push({ id: identity('mentions', occurrenceId, classId), kind: location.kind === 'class-definition' ? 'defines-selector-token' : 'assigns-class-token', from: occurrenceId, to: classId, state: { ...state }, evidence });
  }
  const finding = (kind, summary, pointer, extra = {}) => {
    const item = { id: identity('finding', ...scoped, className, kind), kind, summary, state: { ...state, origin: 'inferred', resolution: 'unresolved' }, evidence: [ref(pointer)], ...extra };
    records.findings.push(item); return item.id;
  };
  const gaps = [];
  if (!row?.definitions) gaps.push(finding('no-observed-definition', 'No definition was found in the scanned scope. External, generated, or unsupported definitions remain possible.', '#/counts'));
  if (!row?.usages) gaps.push(finding('no-observed-usage', 'No assignment was found in the scanned scope. This does not establish that the class is unused.', '#/counts'));
  if (result.unresolved.length) gaps.push(finding('dynamic-assignments', `${result.unresolved.length} dynamic assignment(s) cannot be resolved; their relationship to this class is unknown.`, '#/unresolved', { count: result.unresolved.length }));
  if (result.skipped?.length) gaps.push(finding('skipped-input', `${result.skipped.length} input(s) were skipped.`, '#/skipped', { count: result.skipped.length }));
  if (!result.source_snapshot) gaps.push(finding('unversioned-source', 'The saved result does not establish the source revision. Freshness is unknown.', '#/counts'));
  else if (result.source_snapshot.consistent !== true) gaps.push(finding('inconsistent-source', 'Source revisions differ or could not be checked across child scans.', '#/source_snapshot'));
  gaps.push(finding('static-resolution-limit', 'Matched tokens are potential connections. CSS cascade, dynamic consumers, and component ownership are not proven.', '#/counts'));
  const investigationId = identity('investigation', ...scoped, className);
  records.investigations.push({ id: investigationId, kind: 'class-impact', subject: classId,
    question: 'Where is this class defined and used, and what could a change affect?', status: 'answered-with-gaps',
    evidence: [ref(row ? `#/counts/${index}` : '#/counts')] });
  const definitionFiles = [...new Set((row?.locations ?? []).filter(x => x.kind === 'class-definition').map(x => x.file))].sort();
  const consumerFiles = [...new Set((row?.locations ?? []).filter(x => x.kind === 'class-usage').map(x => x.file))].sort();
  records.conclusions.push({ id: identity('conclusion', ...scoped, className), investigation: investigationId,
    summary: `${className}: ${row?.definitions ?? 0} observed selector occurrence(s), ${row?.usages ?? 0} assignment occurrence(s), ${consumerFiles.length} potential consumer file(s).`,
    definitions: definitionFiles, consumers: consumerFiles, possible_impact: [...new Set([...definitionFiles, ...consumerFiles])].sort(),
    confidence: { level: 'limited', reasons: ['Counts describe the supplied static evidence; runtime effects and intent need further verification.'] },
    supports: records.entities.filter(x => x.kind === 'class-definition' || x.kind === 'class-usage').map(x => x.id), gaps,
    automatic_change_eligible: false, evidence: [ref(row ? `#/counts/${index}` : '#/counts')]
  });
  return validateRecords(records);
};
