import { readFile } from 'node:fs/promises';
import path from 'node:path';

const fail = (code, message, data = {}) => { throw Object.assign(new Error(message), { code, ...data }); };
const need = (condition, code, message, data = {}) => { if (!condition) fail(code, message, data); };
const text = value => String(value ?? '').trim();
const slug = value => text(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const list = value => Array.isArray(value)
  ? value.map(text).filter(Boolean)
  : text(value).split(/[,;\n]+/).map(text).filter(Boolean);
const unique = values => [...new Map(values.map(value => [text(value).toLowerCase(), text(value)])).values()];
const finite = (value, name) => {
  const n = Number(value);
  need(Number.isFinite(n), 'INVALID_INPUT', `${name} must be a finite number.`);
  return n;
};
const positive = (value, name) => {
  const n = finite(value, name);
  need(n > 0, 'INVALID_INPUT', `${name} must be greater than zero.`);
  return n;
};
const projectRequired = context => need(context?.project && context?.rab_home, 'PROJECT_CONTEXT_REQUIRED', 'Kitchen project memory requires project and rab_home context.');

const ALLERGEN_ALIASES = new Map(Object.entries({
  peanut:'peanuts', peanuts:'peanuts',
  soybean:'soybeans', soybeans:'soybeans', soy:'soybeans',
  egg:'egg', eggs:'egg', milk:'milk', wheat:'wheat', sesame:'sesame',
  'tree-nut':'tree nuts', 'tree-nuts':'tree nuts', 'tree nut':'tree nuts', 'tree nuts':'tree nuts',
  fish:'fish', shellfish:'crustacean shellfish', 'crustacean-shellfish':'crustacean shellfish', 'crustacean shellfish':'crustacean shellfish'
}));
const canonicalAllergen = value => ALLERGEN_ALIASES.get(text(value).toLowerCase()) ?? text(value).toLowerCase();

const factEntries = async helpers => Object.entries((await helpers.loadProjectFacts()).facts ?? {});
const activeByPrefix = async (helpers, prefix) => (await factEntries(helpers))
  .filter(([key, record]) => key.startsWith(prefix) && record?.value?.active !== false)
  .map(([key, record]) => ({ key, ...record.value, fact_source:record.source, updated_at:record.updated_at }));
const allergyKey = (person, allergen) => `kitchen.allergy.${slug(person)}.${slug(canonicalAllergen(allergen))}`;
const allergyStatusKey = person => `kitchen.allergy-status.${slug(person)}`;
const preferenceKey = (person, item) => `kitchen.preference.disliked.${slug(person)}.${slug(item)}`;
const exclusionKey = item => `kitchen.constraint.exclusion.${slug(item)}`;
const inventoryKey = item => `kitchen.inventory.ingredient.${slug(item)}`;

const loadData = async (root, name) => JSON.parse(await readFile(path.join(root, 'tools', 'kitchen', 'data', name), 'utf8'));
const recipes = async root => (await loadData(root, 'starter-recipe-index.json')).recipes ?? [];
const references = async root => loadData(root, 'safety-references.json');
const findRecipe = async (root, query) => {
  const q = text(query).toLowerCase();
  const all = await recipes(root);
  const exact = all.find(item => item.id.toLowerCase() === q || item.title.toLowerCase() === q);
  if (exact) return exact;
  const partial = all.filter(item => item.id.toLowerCase().includes(q) || item.title.toLowerCase().includes(q));
  return partial.length === 1 ? partial[0] : null;
};
const currentPeople = async helpers => {
  const fact = await helpers.getProjectFact('kitchen.people');
  return unique(fact?.value?.items ?? []);
};
const allergyState = async (helpers, people = null) => {
  const selected = unique(people?.length ? people : await currentPeople(helpers));
  const statuses = [];
  const allergies = [];
  for (const person of selected) {
    const status = await helpers.getProjectFact(allergyStatusKey(person));
    statuses.push({ person, ...(status?.value ?? { status:'unresolved' }), source:status?.source ?? null });
    const prefix = `kitchen.allergy.${slug(person)}.`;
    for (const item of await activeByPrefix(helpers, prefix)) allergies.push({ person, allergen:canonicalAllergen(item.allergen), provenance:item.provenance ?? 'human-declared', scope:item.scope ?? 'project-human' });
  }
  return { people:selected, statuses, allergies };
};
const unresolvedAllergyPeople = state => state.statuses.filter(item => !['none','declared'].includes(item.status)).map(item => item.person);

const lengthToM = (value, unit) => {
  const n = positive(value, 'length');
  const u = text(unit || 'ft').toLowerCase();
  const factor = { m:1, meter:1, meters:1, ft:0.3048, foot:0.3048, feet:0.3048, in:0.0254, inch:0.0254, inches:0.0254, cm:0.01 }[u];
  need(factor, 'INVALID_INPUT', `Unsupported length unit: ${unit}`);
  return n * factor;
};
const timeToS = (value, unit) => {
  const n = positive(value, 'time');
  const u = text(unit || 'min').toLowerCase();
  const factor = { s:1, sec:1, second:1, seconds:1, min:60, minute:60, minutes:60, hr:3600, hour:3600, hours:3600 }[u];
  need(factor, 'INVALID_INPUT', `Unsupported time unit: ${unit}`);
  return n * factor;
};
const mToLength = (meters, unit) => {
  const u = text(unit || 'ft').toLowerCase();
  const factor = { m:1, meter:1, meters:1, ft:0.3048, foot:0.3048, feet:0.3048, in:0.0254, inch:0.0254, inches:0.0254, cm:0.01 }[u];
  need(factor, 'INVALID_INPUT', `Unsupported length unit: ${unit}`);
  return meters / factor;
};
const sToTime = (seconds, unit) => {
  const u = text(unit || 'min').toLowerCase();
  const factor = { s:1, sec:1, second:1, seconds:1, min:60, minute:60, minutes:60, hr:3600, hour:3600, hours:3600 }[u];
  need(factor, 'INVALID_INPUT', `Unsupported time unit: ${unit}`);
  return seconds / factor;
};
const speedToMps = (value, unit) => {
  const n = positive(value, 'belt_speed');
  const u = text(unit || 'ft/min').toLowerCase();
  const m = /^([^/]+)\/([^/]+)$/.exec(u);
  need(m, 'INVALID_INPUT', `Unsupported speed unit: ${unit}`);
  return lengthToM(n, m[1]) / timeToS(1, m[2]);
};
const mpsToSpeed = (mps, unit) => {
  const u = text(unit || 'ft/min').toLowerCase();
  const m = /^([^/]+)\/([^/]+)$/.exec(u);
  need(m, 'INVALID_INPUT', `Unsupported speed unit: ${unit}`);
  const perSecond = mToLength(mps, m[1]);
  return perSecond * timeToS(1, m[2]);
};
const rounded = value => Number(Number(value).toPrecision(12));

const homeTarget = async (root, food) => {
  const refs = await references(root);
  const source = refs.consumer_home_cooking?.find(item => item.id === 'usda-fsis-meat-poultry-safe-temp');
  need(source, 'LOOKUP_FAILED', 'Home-cooking safety reference is unavailable.');
  const f = text(food).toLowerCase();
  if (['poultry','chicken','turkey','duck'].includes(f)) return { food, target_f:source.facts.poultry_f, rest_minutes:0, reference_id:source.id, scope:source.scope, authority_type:source.authority_type };
  if (['ground-beef','ground-pork','ground-lamb','ground-veal','ground meat'].includes(f)) return { food, target_f:source.facts.ground_beef_pork_lamb_veal_f, rest_minutes:0, reference_id:source.id, scope:source.scope, authority_type:source.authority_type };
  if (['whole-cut-beef','whole-cut-pork','whole-cut-lamb','whole-cut-veal','steak','pork-chop','pork chop'].includes(f)) return { food, target_f:source.facts.whole_cut_beef_pork_lamb_veal_f, rest_minutes:source.facts.whole_cut_rest_minutes, reference_id:source.id, scope:source.scope, authority_type:source.authority_type };
  return null;
};

const handlers = {
  'kitchen/project/start': async ({ options, context, helpers }) => {
    projectRequired(context);
    const suppliedPeople = unique(list(options.people));
    if (suppliedPeople.length) await helpers.setProjectFact('kitchen.people', { items:suppliedPeople, provenance:'human-declared', scope:'project' }, 'kitchen/project/start');
    const people = suppliedPeople.length ? suppliedPeople : await currentPeople(helpers);
    if (!people.length) return { status:'input-required', missing:['people'], question:'Who are we cooking for?', safety_claim_authority:0 };
    const state = await allergyState(helpers, people);
    const unresolved = unresolvedAllergyPeople(state);
    if (unresolved.length) return { status:'input-required', people, missing:['allergy_status'], unresolved_people:unresolved, question:`Do any of these people have food allergies or intolerances: ${unresolved.join(', ')}?`, safety_claim_authority:0 };
    return { status:'ready', people, allergy_status:state.statuses, allergies:state.allergies, safety_claim_authority:0, note:'Resolved allergy status allows planning to continue; it does not prove any recipe is safe.' };
  },

  'kitchen/allergy/set-status': async ({ options, context, helpers }) => {
    projectRequired(context);
    const person = text(options.person), status = text(options.status).toLowerCase();
    need(person, 'INVALID_INPUT', 'person is required.');
    need(['none','declared'].includes(status), 'INVALID_INPUT', 'status must be none or declared.');
    const active = await activeByPrefix(helpers, `kitchen.allergy.${slug(person)}.`);
    if (status === 'none' && active.length) return { status:'conflict', authority:0, person, active_allergies:active.map(item => item.allergen), reason:'Explicitly remove existing allergy facts before declaring none.' };
    const declared = unique(list(options.allergies).map(canonicalAllergen));
    if (status === 'declared' && !declared.length && !active.length) return { status:'input-required', missing:['allergies'], question:`Which allergies should be declared for ${person}?`, authority:0 };
    for (const allergen of declared) await helpers.setProjectFact(allergyKey(person, allergen), { active:true, person, allergen, provenance:'human-declared', scope:'project-human' }, 'kitchen/allergy/set-status');
    const record = { status, person, provenance:'human-declared', scope:'project-human' };
    await helpers.setProjectFact(allergyStatusKey(person), record, 'kitchen/allergy/set-status');
    return { status:'completed', person, allergy_status:status, allergies:unique([...active.map(item => canonicalAllergen(item.allergen)), ...declared]), provenance:'human-declared' };
  },

  'kitchen/allergy/teach': async ({ options, context, helpers }) => {
    projectRequired(context);
    const person = text(options.person), allergen = canonicalAllergen(options.allergen);
    need(person && allergen, 'INVALID_INPUT', 'person and allergen are required.');
    const value = { active:true, person, allergen, provenance:'human-declared', scope:'project-human' };
    await helpers.setProjectFact(allergyKey(person, allergen), value, 'kitchen/allergy/teach');
    await helpers.setProjectFact(allergyStatusKey(person), { status:'declared', person, provenance:'human-declared', scope:'project-human' }, 'kitchen/allergy/teach');
    return { status:'completed', ...value };
  },

  'kitchen/allergy/remove': async ({ options, context, helpers }) => {
    projectRequired(context);
    const person = text(options.person), allergen = canonicalAllergen(options.allergen);
    need(person && allergen, 'INVALID_INPUT', 'person and allergen are required.');
    const prior = await helpers.getProjectFact(allergyKey(person, allergen));
    if (!prior?.value?.active) return { status:'not-found', person, allergen };
    await helpers.setProjectFact(allergyKey(person, allergen), { ...prior.value, active:false, removed:true, removed_by:'human-explicit', removed_at:new Date().toISOString() }, 'kitchen/allergy/remove');
    await helpers.setProjectFact(allergyStatusKey(person), { status:'review-required', person, provenance:'human-removal', scope:'project-human' }, 'kitchen/allergy/remove');
    return { status:'completed', person, allergen, removed:true, next:'Confirm remaining allergy status explicitly.' };
  },

  'kitchen/allergy/list': async ({ options, context, helpers }) => {
    projectRequired(context);
    const people = options.person ? [text(options.person)] : await currentPeople(helpers);
    const state = await allergyState(helpers, people);
    return { status:state.people.length ? 'completed' : 'input-required', ...state, missing:state.people.length ? [] : ['people'] };
  },

  'kitchen/allergy/check-recipe': async ({ options, context, helpers, root }) => {
    projectRequired(context);
    const recipe = await findRecipe(root, options.recipe);
    if (!recipe) return { status:'lookup-failed', authority:0, query:options.recipe };
    const people = options.people ? list(options.people) : await currentPeople(helpers);
    const state = await allergyState(helpers, people);
    const unresolved = unresolvedAllergyPeople(state);
    if (!state.people.length || unresolved.length) return { status:'input-required', authority:0, recipe, missing:['allergy_status'], unresolved_people:unresolved.length ? unresolved : state.people };
    const tags = new Set((recipe.known_major_allergen_tags ?? []).map(canonicalAllergen));
    const conflicts = state.allergies.filter(item => tags.has(canonicalAllergen(item.allergen)));
    if (conflicts.length) return { status:'conflict', authority:0, recipe, conflicts, reason:'Starter index declares an allergen matching a human-scoped hard constraint.' };
    return { status:'unresolved', authority:0, recipe, conflicts:[], reason:'Starter recipe index is not authored ingredient-level safety evidence. No safe claim is permitted.', required:['authored ingredients','ingredient allergen derivation','cross-contact evidence where applicable'] };
  },

  'kitchen/preference/teach': async ({ options, context, helpers }) => {
    projectRequired(context);
    const person = text(options.person), item = text(options.item).toLowerCase();
    need(person && item, 'INVALID_INPUT', 'person and item are required.');
    const value = { active:true, person, item, kind:'disliked', provenance:'human-declared', scope:'project-human' };
    await helpers.setProjectFact(preferenceKey(person, item), value, 'kitchen/preference/teach');
    return { status:'completed', ...value, severity:'preference-not-safety' };
  },

  'kitchen/constraint/add-exclusion': async ({ options, context, helpers }) => {
    projectRequired(context);
    const item = text(options.item).toLowerCase();
    need(item, 'INVALID_INPUT', 'item is required.');
    const value = { active:true, item, kind:'human-hard-constraint', provenance:'human-declared', scope:'project' };
    await helpers.setProjectFact(exclusionKey(item), value, 'kitchen/constraint/add-exclusion');
    return { status:'completed', ...value };
  },

  'kitchen/constraint/list': async ({ context, helpers }) => {
    projectRequired(context);
    const exclusions = await activeByPrefix(helpers, 'kitchen.constraint.exclusion.');
    const preferences = await activeByPrefix(helpers, 'kitchen.preference.disliked.');
    return { status:'completed', exclusions, preferences };
  },

  'kitchen/inventory/add': async ({ options, context, helpers }) => {
    projectRequired(context);
    const items = unique(list(options.items).map(v => v.toLowerCase()));
    need(items.length, 'INVALID_INPUT', 'At least one inventory item is required.');
    for (const item of items) await helpers.setProjectFact(inventoryKey(item), { active:true, item, provenance:'human-declared', scope:'project-inventory' }, 'kitchen/inventory/add');
    return { status:'completed', added:items };
  },

  'kitchen/inventory/list': async ({ context, helpers }) => {
    projectRequired(context);
    return { status:'completed', ingredients:(await activeByPrefix(helpers, 'kitchen.inventory.ingredient.')).map(item => item.item) };
  },

  'kitchen/recipe/list': async ({ options, root }) => {
    let items = await recipes(root);
    const filters = ['category','cuisine','protein'];
    for (const key of filters) if (text(options[key])) items = items.filter(item => text(item[key]).toLowerCase() === text(options[key]).toLowerCase());
    if (text(options.query)) {
      const q = text(options.query).toLowerCase();
      items = items.filter(item => `${item.id} ${item.title} ${item.category} ${item.cuisine} ${item.protein ?? ''}`.toLowerCase().includes(q));
    }
    return { status:'completed', count:items.length, items, corpus_status:'starter-corpus-index', safety_authority:0 };
  },

  'kitchen/recipe/find': async ({ options, root }) => {
    const q = text(options.query).toLowerCase();
    const all = await recipes(root);
    const exact = all.filter(item => item.id.toLowerCase() === q || item.title.toLowerCase() === q);
    const partial = exact.length ? exact : all.filter(item => `${item.id} ${item.title}`.toLowerCase().includes(q));
    return { status:partial.length ? 'found' : 'not-found', query:options.query, matches:partial, corpus_status:'starter-corpus-index', safety_authority:0 };
  },

  'kitchen/recipe/filter': async ({ options, context, helpers, root }) => {
    projectRequired(context);
    let items = await recipes(root);
    if (text(options.category)) items = items.filter(item => text(item.category).toLowerCase() === text(options.category).toLowerCase());
    if (text(options.cuisine)) items = items.filter(item => text(item.cuisine).toLowerCase() === text(options.cuisine).toLowerCase());
    if (text(options.protein)) items = items.filter(item => text(item.protein).toLowerCase() === text(options.protein).toLowerCase());
    const state = await allergyState(helpers, await currentPeople(helpers));
    const unresolvedPeople = unresolvedAllergyPeople(state);
    if (!state.people.length || unresolvedPeople.length) return { status:'input-required', missing:['allergy_status'], unresolved_people:unresolvedPeople, authority:0, candidates:items };
    const allergies = new Set(state.allergies.map(item => canonicalAllergen(item.allergen)));
    const excluded = [], surviving = [];
    for (const recipe of items) {
      const conflicts = (recipe.known_major_allergen_tags ?? []).map(canonicalAllergen).filter(tag => allergies.has(tag));
      if (conflicts.length) excluded.push({ recipe_id:recipe.id, reason:'declared-allergen-conflict', conflicts });
      else surviving.push(recipe);
    }
    const exclusions = await activeByPrefix(helpers, 'kitchen.constraint.exclusion.');
    const unresolvedChecks = ['authored ingredient composition','cross-contact where applicable','equipment','time budget'];
    if (exclusions.length) unresolvedChecks.unshift('human ingredient exclusions cannot be checked against an unauthored recipe index');
    return { status:'unresolved', authority:0, candidates:surviving, excluded, unresolved_checks:unresolvedChecks, note:'Conservative allergen conflicts may eliminate candidates; surviving starter-index recipes are not verified safe or executable.' };
  },

  'kitchen/recipe/check-inventory': async ({ options, context, helpers, root }) => {
    projectRequired(context);
    const recipe = await findRecipe(root, options.recipe);
    if (!recipe) return { status:'lookup-failed', recipe:options.recipe };
    const inventory = (await activeByPrefix(helpers, 'kitchen.inventory.ingredient.')).map(item => item.item);
    return { status:'unresolved', recipe, inventory, missing:['authored recipe ingredients'], reason:'The starter recipe index does not contain ingredient quantities, so inventory completeness cannot be computed.' };
  },

  'kitchen/recipe/check-constraints': async ({ options, context, helpers, root }) => {
    projectRequired(context);
    const recipe = await findRecipe(root, options.recipe);
    if (!recipe) return { status:'lookup-failed', authority:0, recipe:options.recipe };
    const state = await allergyState(helpers, await currentPeople(helpers));
    const unresolved = unresolvedAllergyPeople(state);
    if (!state.people.length || unresolved.length) return { status:'input-required', authority:0, missing:['allergy_status'], unresolved_people:unresolved };
    const tags = new Set((recipe.known_major_allergen_tags ?? []).map(canonicalAllergen));
    const allergyConflicts = state.allergies.filter(item => tags.has(canonicalAllergen(item.allergen)));
    if (allergyConflicts.length) return { status:'conflict', authority:0, recipe, allergy_conflicts:allergyConflicts };
    const exclusions = await activeByPrefix(helpers, 'kitchen.constraint.exclusion.');
    return { status:'unresolved', authority:0, recipe, allergy_conflicts:[], exclusions:exclusions.map(item => item.item), reason:'Ingredient-level recipe content is not authored, so exclusions and full allergen composition remain unresolved.' };
  },

  'kitchen/math/residence-time': async ({ options }) => {
    const seconds = lengthToM(options.length, options.length_unit) / speedToMps(options.belt_speed, options.speed_unit);
    const unit = text(options.output_time_unit || 'min');
    return { status:'completed', relationship:'t=L/v', residence_time:rounded(sToTime(seconds, unit)), unit, calculated:true, verified:false };
  },

  'kitchen/math/belt-speed': async ({ options }) => {
    const mps = lengthToM(options.length, options.length_unit) / timeToS(options.residence_time, options.time_unit);
    const unit = text(options.output_speed_unit || 'ft/min');
    return { status:'completed', relationship:'v=L/t', belt_speed:rounded(mpsToSpeed(mps, unit)), unit, calculated:true, verified:false };
  },

  'kitchen/math/process-length': async ({ options }) => {
    const meters = speedToMps(options.belt_speed, options.speed_unit) * timeToS(options.residence_time, options.time_unit);
    const unit = text(options.output_length_unit || 'ft');
    return { status:'completed', relationship:'L=v*t', process_length:rounded(mToLength(meters, unit)), unit, calculated:true, verified:false };
  },

  'kitchen/math/solve-one-seat': async ({ options }) => {
    const values = { length:options.length, belt_speed:options.belt_speed, residence_time:options.residence_time };
    const missing = Object.entries(values).filter(([, value]) => value === undefined || value === null || value === '').map(([key]) => key);
    if (missing.length > 1) return { status:'unresolved', reason:'underdetermined', missing, authority:0 };
    if (missing.length === 0) {
      const seconds = lengthToM(values.length, options.length_unit) / speedToMps(values.belt_speed, options.speed_unit);
      const expected = timeToS(values.residence_time, options.time_unit);
      const relative_error = Math.abs(seconds - expected) / Math.max(seconds, expected, 1e-12);
      return { status:'completed', solved:null, consistent:relative_error < 1e-9, relative_error:rounded(relative_error), calculated:true, verified:false };
    }
    if (missing[0] === 'residence_time') {
      const seconds = lengthToM(values.length, options.length_unit) / speedToMps(values.belt_speed, options.speed_unit);
      return { status:'completed', solved:'residence_time', value:rounded(sToTime(seconds, options.time_unit || 'min')), unit:options.time_unit || 'min', calculated:true, verified:false };
    }
    if (missing[0] === 'belt_speed') {
      const mps = lengthToM(values.length, options.length_unit) / timeToS(values.residence_time, options.time_unit);
      return { status:'completed', solved:'belt_speed', value:rounded(mpsToSpeed(mps, options.speed_unit || 'ft/min')), unit:options.speed_unit || 'ft/min', calculated:true, verified:false };
    }
    const meters = speedToMps(values.belt_speed, options.speed_unit) * timeToS(values.residence_time, options.time_unit);
    return { status:'completed', solved:'length', value:rounded(mToLength(meters, options.length_unit || 'ft')), unit:options.length_unit || 'ft', calculated:true, verified:false };
  },

  'kitchen/safety/get-reference': async ({ options, root }) => {
    const refs = await references(root);
    const all = Object.entries(refs).flatMap(([group, items]) => Array.isArray(items) ? items.map(item => ({ group, ...item })) : []);
    if (!text(options.id)) return { status:'completed', items:all, note:refs.notes ?? [] };
    const found = all.find(item => item.id === options.id);
    return found ? { status:'found', reference:found } : { status:'lookup-failed', id:options.id };
  },

  'kitchen/safety/get-target': async ({ options, root }) => {
    const scope = text(options.scope || 'consumer-home-cooking-us');
    if (scope !== 'consumer-home-cooking-us') return { status:'lookup-failed', authority:0, scope, reason:'No generic consumer target is promoted to industrial/process authority.' };
    const target = await homeTarget(root, options.food);
    return target ? { status:'found', target, authority:0 } : { status:'lookup-failed', authority:0, food:options.food, scope };
  },

  'kitchen/safety/check-measured-temperature': async ({ options, root }) => {
    const scope = text(options.scope || 'consumer-home-cooking-us');
    if (scope !== 'consumer-home-cooking-us') return { status:'lookup-failed', verified:false, authority:0, scope, reason:'Industrial process verification requires process-specific validated support.' };
    const target = await homeTarget(root, options.food);
    if (!target) return { status:'lookup-failed', verified:false, authority:0, food:options.food };
    const measured = finite(options.temperature_f, 'temperature_f');
    if (measured < target.target_f) return { status:'not-verified', verified:false, food:options.food, measured_f:measured, target, reason:'Measured temperature is below the applicable referenced target.' };
    if (target.rest_minutes > 0) {
      const rest = options.rest_minutes === undefined ? null : finite(options.rest_minutes, 'rest_minutes');
      if (rest === null || rest < target.rest_minutes) return { status:'input-required', verified:false, food:options.food, measured_f:measured, target, missing:['rest_minutes'], reason:'Referenced target includes a rest time requirement.' };
    }
    return { status:'verified', verified:true, verification_scope:'referenced temperature/rest target only', food:options.food, measured_f:measured, target, measurement_source:text(options.measurement_source || 'provided-measurement'), note:'This receipt verifies only the supplied measurement against the cited target; it does not convert generic consumer guidance into industrial process validation.' };
  },

  'kitchen/verify/recipe-ready': async ({ options, context, helpers, root }) => {
    projectRequired(context);
    const recipe = await findRecipe(root, options.recipe);
    if (!recipe) return { status:'lookup-failed', verified:false, recipe:options.recipe };
    const state = await allergyState(helpers, await currentPeople(helpers));
    const unresolved = unresolvedAllergyPeople(state);
    if (!state.people.length || unresolved.length) return { status:'input-required', verified:false, missing:['allergy_status'], unresolved_people:unresolved };
    const tags = new Set((recipe.known_major_allergen_tags ?? []).map(canonicalAllergen));
    const conflicts = state.allergies.filter(item => tags.has(canonicalAllergen(item.allergen)));
    if (conflicts.length) return { status:'conflict', verified:false, authority:0, conflicts };
    return { status:'unresolved', verified:false, authority:0, recipe, reason:'Starter index is not a complete executable recipe. Ingredient quantities, equipment, timing, derived allergens, and safety evidence remain unresolved.' };
  },

  'kitchen/receipt/build': async ({ options }) => {
    const before = options.before ?? null, operation = text(options.operation), returned = options.returned ?? null, after = options.after ?? null, verdict = text(options.verdict);
    need(operation && verdict, 'INVALID_INPUT', 'operation and verdict are required.');
    return { status:'completed', receipt:{ before, operation, returned, after, verdict, created_at:new Date().toISOString() } };
  }
};

export const run = async args => {
  const handler = handlers[args.tool.path];
  need(handler, 'BAD_TOOL', `No Kitchen executor registered for ${args.tool.path}.`);
  return handler(args);
};
