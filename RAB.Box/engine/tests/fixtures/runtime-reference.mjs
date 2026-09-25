import { lstat, readFile } from 'node:fs/promises';
import { record, own, safeKey, equal, clone, insist, fail, fault, hash, bind, containedPath, relativePath } from '../../src/core.mjs';
import { validateSeats } from '../../src/schema.mjs';
import { loadProject, loadStamp, loadFamily, lookup, runWorker } from '../../src/project.mjs';
import { tokenize, findHeads, fieldBindings, parseModifiers, expandBindings } from '../../src/language.mjs';
import { validatePlan, applyPlan } from '../../src/mutation-plan.mjs';

const parseCanonical = (input, family) => {
  insist(record(input), 'INVALID_INPUT', 'Canonical request must be an object.');
  for (const key of Object.keys(input)) insist(['mode', 'capability', 'options', 'dependency_options'].includes(key), 'INVALID_INPUT', 'Undeclared canonical request field.', { key });
  insist(['command', 'query'].includes(input.mode), 'INVALID_INPUT', 'Canonical mode must be command or query.');
  insist(record(input.options), 'INVALID_INPUT', 'Canonical options must be an object.');
  insist(input.dependency_options === undefined || record(input.dependency_options), 'INVALID_INPUT', 'dependency_options must be an object.');
  const supplied = { [input.capability]: { ...input.options } }, evidence = {};
  for (const [name, options] of Object.entries(input.dependency_options ?? {})) {
    insist(name !== input.capability && family.has(name) && record(options), 'INVALID_INPUT', 'Unexpected dependency or malformed dependency options.', { name });
    supplied[name] = { ...options };
  }
  for (const [name, values] of Object.entries(supplied)) for (const key of Object.keys(values)) {
    insist(safeKey(key) && own(family.get(name).settings.options, key), 'INVALID_INPUT', 'Undeclared option.', { name, key });
    evidence[`${name}.${key}`] = [{ source: 'canonical-input', value: values[key] }];
  }
  return { mode: input.mode, capability: input.capability, supplied, evidence, trace: [] };
};

const interpret = async (input, project, config) => {
  if (typeof input !== 'string') {
    insist(record(input) && safeKey(input.capability), 'INVALID_INPUT', 'Supply text or a canonical request with a reserved capability.');
    const family = await loadFamily(project, input.capability, config);
    return { ...parseCanonical(input, family), family };
  }
  const heads = findHeads(input, project), meanings = new Map(), errors = [];
  for (const head of heads) {
    try {
      const family = await loadFamily(project, head.capability, config);
      const parsed = parseModifiers(head.tokens, fieldBindings(family));
      const supplied = expandBindings(parsed.values);
      const value = { mode: head.mode, capability: head.capability, supplied, evidence: parsed.evidence, trace: parsed.trace, family };
      meanings.set(JSON.stringify([value.mode, value.capability, Object.entries(parsed.values).sort()]), value);
    } catch (error) { errors.push(error); }
  }
  if (!meanings.size) throw errors[0];
  insist(meanings.size === 1, 'AMBIGUOUS', 'More than one complete interpretation survived.');
  return [...meanings.values()][0];
};

const inspectInputs = async (project, stamp, supplied, evidence) => {
  const checked = validateSeats(stamp.settings, supplied);
  insist(checked.errors.length === 0, 'INVALID_INPUT', 'Supplied values do not satisfy the current stamp settings.', { capability: stamp.name, errors: checked.errors });
  for (const key of checked.defaults) evidence[`${stamp.name}.${key}`] = [{ source: 'declared-default', value: checked.values[key] }];
  const worldEvidence = [];
  for (const [key, field] of Object.entries(stamp.settings.options)) {
    if (!own(checked.values, key)) continue;
    if (field.validate === 'relative-directory') {
      checked.values[key] = relativePath(checked.values[key]);
      let file;
      try { file = await containedPath(project.root, checked.values[key]); } catch (error) { if (error.code === 'INVALID_PATH') throw error; fail('LOOKUP_FAILED', 'Requested destination directory cannot be inspected.', { key, value: checked.values[key] }); }
      insist((await lstat(file)).isDirectory(), 'INVALID_INPUT', 'The destination must be an existing directory.', { key });
      worldEvidence.push({ field: key, source: 'project-relative-directory', value: checked.values[key] });
    }
    if (field.catalog) {
      const result = await lookup(project, field.catalog, checked.values[key]);
      insist(result.exists, 'INVALID_INPUT', 'The supplied value is not registered in this project.', { capability: stamp.name, field: key, value: checked.values[key], evidence: result.evidence });
      worldEvidence.push({ field: key, ...result.evidence });
    }
  }
  return { ...checked, worldEvidence };
};

const evaluate = async (project, interpreted, requestId) => {
  const frames = [], questions = [], active = new Set(), evidence = clone(interpreted.evidence);
  const visit = async (capability, inherited = {}, returnTo = null, chain = []) => {
    insist(chain.length < 8 && !chain.includes(capability), 'DEPENDENCY_CYCLE', 'A cyclic or excessive dependency was requested.');
    insist(!active.has(capability), 'AMBIGUOUS', 'Repeated capability frame requires an explicit frame ID in a larger host.');
    active.add(capability);
    const stamp = interpreted.family.get(capability);
    insist(stamp, 'CAPABILITY_UNAVAILABLE', 'The required dependency stamp is not available in the current project.', { capability });
    const supplied = { ...(interpreted.supplied[capability] ?? {}) }, localEvidence = {};
    for (const [key, value] of Object.entries(inherited)) {
      bind(supplied, localEvidence, key, value, { source: 'parent-binding', returnTo });
      evidence[`${capability}.${key}`] = [...(evidence[`${capability}.${key}`] ?? []), ...localEvidence[key]];
    }
    const checked = await inspectInputs(project, stamp, supplied, evidence);
    for (const key of checked.missing) {
      const field = stamp.settings.options[key];
      questions.push({ request_id: requestId, stamp: capability, key, title: field.title ?? key, type: field.type, role: field.role ?? null, required: true, question: field.question ?? `What should ${key} be for ${stamp.settings.title}?`, ...(field.enum ? { choices: field.enum } : {}), returnTo });
    }
    const dependencies = [];
    for (const dep of stamp.entry.dependencies ?? []) {
      if (!own(checked.values, dep.field)) continue;
      const result = await lookup(project, dep.catalog, checked.values[dep.field]);
      checked.worldEvidence.push({ field: dep.field, ...result.evidence });
      if (!result.exists) {
        const inherited = {};
        for (const [childKey, parentKey] of Object.entries(dep.bindings)) if (own(checked.values, parentKey)) inherited[childKey] = checked.values[parentKey];
        const returnAddress = { request_id: requestId, stamp: capability, key: dep.field };
        await visit(dep.capability, inherited, returnAddress, [...chain, capability]);
        dependencies.push({ capability: dep.capability, catalog: dep.catalog, value: checked.values[dep.field], returnTo: returnAddress });
      }
    }
    frames.push({ capability, stamp, values: checked.values, seats: checked.seats, dependencies, returnTo, worldEvidence: checked.worldEvidence });
  };
  await visit(interpreted.capability);
  for (const [capability, values] of Object.entries(interpreted.supplied)) if (Object.keys(values).length && !active.has(capability))
    fail('CONFLICT', 'Inputs were supplied for a dependency that is not needed. They were not silently ignored.', { capability, values });
  return { frames, questions, evidence, signature: hash(frames.map(x => [x.capability, x.values, x.dependencies])) };
};

const summary = frame => ({ capability: frame.capability, title: frame.stamp.settings.title, settings: frame.stamp.entry.settings, script: frame.stamp.entry.script, options: frame.values, seats: frame.seats, returnTo: frame.returnTo, dependencies: frame.dependencies, worldEvidence: frame.worldEvidence });

export const createMagicBox = ({ projectRoot, allowExecutableSettings = false, allowWrites = false, authorize = async () => true, clock = Date.now } = {}) => {
  const config = { allowExecutableSettings }, issued = new Set(), running = new Set(), completed = new Set();
  const makeId = () => {
    const id = clock();
    insist(Number.isSafeInteger(id) && id >= 0 && !issued.has(id), 'ID_COLLISION', 'Request ID collided. This adapter will not salt or retry the timestamp.');
    issued.add(id);
    return id;
  };
  const resolve = async (input, previous = null, addedAnswer = null) => {
    const project = await loadProject(projectRoot);
    if (previous) insist(previous.version === '0.2' && previous.project_id === project.id && Number.isSafeInteger(previous.id), 'INVALID_INPUT', 'Ticket belongs to a different project or version.');
    const requestId = previous ? previous.id : makeId();
    const interpreted = await interpret(input, project, config);
    const contract = hash([project.fingerprint, [...interpreted.family.values()].map(x => [x.name, x.fingerprint])]);
    if (previous) insist(previous.contract === contract, 'STALE_CONTRACT', 'Project discovery or stamp contract changed. Prepare the original request again before accepting answers or writing.');
    const answers = clone(previous?.answers ?? []);
    if (addedAnswer) {
      insist(record(addedAnswer) && addedAnswer.request_id === requestId && safeKey(addedAnswer.stamp) && record(addedAnswer.values), 'INVALID_INPUT', 'Answer must name the pending request_id, stamp and values.');
      for (const key of Object.keys(addedAnswer)) insist(['request_id', 'stamp', 'values'].includes(key), 'INVALID_INPUT', 'Undeclared answer envelope field.', { key });
      insist(Array.isArray(previous.questions), 'INVALID_INPUT', 'Ticket has no questions.');
      for (const key of Object.keys(addedAnswer.values)) insist(previous.questions.some(q => q.stamp === addedAnswer.stamp && q.key === key), 'INVALID_INPUT', 'This answer does not target a currently pending seat.', { key });
      insist(Object.keys(addedAnswer.values).length > 0, 'INVALID_INPUT', 'Answer values cannot be empty.');
      answers.push(addedAnswer);
    }
    insist(answers.length <= 64, 'INVALID_INPUT', 'Clarification limit reached. Start a new request.');
    for (const answer of answers) {
      insist(record(answer) && answer.request_id === requestId && interpreted.family.has(answer.stamp) && record(answer.values), 'INVALID_INPUT', 'Malformed saved answer.');
      interpreted.supplied[answer.stamp] ??= {};
      for (const [key, value] of Object.entries(answer.values)) {
        const field = interpreted.family.get(answer.stamp).settings.options[key];
        insist(safeKey(key) && field, 'INVALID_INPUT', 'Saved answer targets an undeclared seat.');
        const localEvidence = {};
        bind(interpreted.supplied[answer.stamp], localEvidence, key, value, { source: 'clarification', request_id: requestId, stamp: answer.stamp });
        interpreted.evidence[`${answer.stamp}.${key}`] = [...(interpreted.evidence[`${answer.stamp}.${key}`] ?? []), ...localEvidence[key]];
      }
    }
    const state = await evaluate(project, interpreted, requestId);
    const ticket = { version: '0.2', id: requestId, project_id: project.id, original: clone(input), contract, answers, questions: state.questions };
    const publicResult = { status: state.questions.length ? 'input-required' : interpreted.mode === 'query' ? 'query-result' : 'ready', authority: 0, mode: interpreted.mode, capability: interpreted.capability, ticket, frames: state.frames.map(summary), questions: state.questions, evidence: state.evidence, trace: interpreted.trace, ...(interpreted.mode === 'query' ? { note: 'Contract inspection only. No write authorization and no promise that execution will succeed.' } : {}) };
    return { project, interpreted, state, publicResult };
  };
  const guard = fn => async (...args) => { try { return await fn(...args); } catch (error) { return fault(error); } };
  const prepare = guard(async input => (await resolve(input)).publicResult);
  const resume = guard(async ticket => {
    insist(record(ticket), 'INVALID_INPUT', 'A saved ticket is required.');
    return (await resolve(ticket.original, ticket)).publicResult;
  });
  const answer = guard(async (ticket, response) => {
    insist(record(ticket), 'INVALID_INPUT', 'A saved pending ticket is required.');
    return (await resolve(ticket.original, ticket, response)).publicResult;
  });
  const answerText = guard(async (ticket, text, target = null) => {
    insist(record(ticket), 'INVALID_INPUT', 'A saved pending ticket is required.');
    const current = await resolve(ticket.original, ticket);
    let questions = current.publicResult.questions;
    if (target) {
      insist(record(target) && safeKey(target.stamp) && safeKey(target.key), 'INVALID_INPUT', 'A clarification target needs stamp and key.');
      questions = questions.filter(q => q.stamp === target.stamp && q.key === target.key);
    }
    insist(questions.length > 0, 'INVALID_INPUT', 'No pending field matches this reply.');
    const fields = fieldBindings(current.interpreted.family).filter(f => questions.some(q => q.stamp === f.capability && q.key === f.key));
    let parsed;
    try { parsed = parseModifiers(tokenize(text), fields); }
    catch (error) {
      if (error.code !== 'UNSUPPORTED_LANGUAGE') throw error;
      const tokens = tokenize(text);
      if (fields.length !== 1) fail('AMBIGUOUS', 'Several fields are waiting. Name the field or let the UI supply its return address.', { questions });
      insist(tokens.length === 1 && ['word', 'literal'].includes(tokens[0].kind), 'UNSUPPORTED_LANGUAGE', 'Use one value, a quoted value, or an explicit field phrase.');
      const f = fields[0];
      let value = tokens[0].kind === 'literal' ? tokens[0].value : tokens[0].raw;
      if (f.field.type === 'boolean') {
        const values = { yes: true, true: true, no: false, false: false };
        insist(own(values, value.toLowerCase()), 'INVALID_INPUT', 'Answer yes/no or true/false.');
        value = values[value.toLowerCase()];
      }
      if (f.field.type === 'number') { value = Number(value); insist(Number.isFinite(value), 'INVALID_INPUT', 'A finite number is required.'); }
      parsed = { values: { [f.id]: value } };
    }
    let result = current;
    for (const [stamp, values] of Object.entries(expandBindings(parsed.values))) {
      result = await resolve(ticket.original, result.publicResult.ticket, { request_id: ticket.id, stamp, values });
    }
    result.publicResult.reply_text = text;
    return result.publicResult;
  });
  const inspect = guard(async () => {
    const project = await loadProject(projectRoot), capabilities = [], unavailable = [];
    for (const name of Object.keys(project.manifest.stamps)) {
      try {
        const stamp = await loadStamp(project, name, config);
        capabilities.push({ ...stamp.settings, settings_path: stamp.entry.settings, script_path: stamp.entry.script });
      } catch (error) { unavailable.push({ name, ...fault(error) }); }
    }
    return { status: 'inspected', project: project.manifest.project, capabilities, unavailable, authority: 0 };
  });
  const execute = async ticket => {
    const steps = [];
    let claimed = false;
    try {
      insist(record(ticket) && Number.isSafeInteger(ticket.id), 'INVALID_INPUT', 'Supply a prepared ticket.');
      insist(allowWrites === true, 'DENIED', 'The host has not granted write authority. Text cannot grant it.');
      insist(!completed.has(ticket.id) && !running.has(ticket.id), 'ALREADY_EXECUTED', 'This request is already running or completed.');
      running.add(ticket.id);
      claimed = true;
      const resolved = await resolve(ticket.original, ticket);
      if (resolved.publicResult.status !== 'ready') return resolved.publicResult;
      const { project, state, interpreted } = resolved;
      insist(interpreted.mode === 'command', 'DENIED', 'Queries never authorize execution.');
      const plans = [];
      for (const frame of state.frames) {
        insist(await authorize({ project_id: project.id, capability: frame.capability, options: clone(frame.values) }) === true, 'DENIED', 'Host authorization rejected this operation.', { capability: frame.capability });
        const plan = await runWorker('plan', frame.stamp.scriptPath, { project: { id: project.id, root: project.root }, settings: frame.stamp.settings, options: frame.values, catalogs: project.manifest.catalogs ?? {}, assets: frame.stamp.assets });
        const validated = await validatePlan(project, frame.stamp, plan);
        for (const prior of plans) {
          const a = prior.validated.destination.toLowerCase(), b = validated.destination.toLowerCase();
          insist(a !== b && !a.startsWith(`${b}/`) && !b.startsWith(`${a}/`), 'INVALID_PLAN', 'Two plans have overlapping output directories.');
        }
        plans.push({ frame, validated });
      }
      const current = await resolve(ticket.original, ticket);
      insist(current.publicResult.status === 'ready' && current.state.signature === state.signature, 'STALE_WORLD', 'World changed during preflight. Nothing has been applied by the mutation plan.');
      for (const { frame, validated } of plans) {
        for (const dep of frame.dependencies) {
          const observed = await lookup(project, dep.catalog, dep.value);
          insist(observed.exists, 'VERIFICATION_FAILED', 'A completed dependency did not supply the resource the parent requires.', { dep });
        }
        const effect = await applyPlan(project, validated);
        steps.push({ capability: frame.capability, options: frame.values, returnTo: frame.returnTo, ...effect });
      }
      completed.add(ticket.id);
      return { status: 'completed', authority: 1, receipt: { id: ticket.id, project_id: project.id, capability: interpreted.capability, original: ticket.original, contract: ticket.contract, finished_at: new Date().toISOString(), evidence: state.evidence, steps, verification: 'file materialization verified; see each stamp’s scope in README', cloud_calls: 0 } };
    } catch (error) { return { ...fault(error), ...(steps.length ? { completed_steps: steps, partial: true } : {}) }; }
    finally { if (claimed) running.delete(ticket.id); }
  };
  return Object.freeze({ prepare, resume, answer, answerText, execute, inspect });
};
