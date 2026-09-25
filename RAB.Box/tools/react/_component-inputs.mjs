import path from 'node:path';
import { readFile, lstat } from 'node:fs/promises';
import { createRabMemory } from '../../bridge/rab-memory.mjs';
import { pathValue } from '../../bridge/project-paths.mjs';
import { containedPath, insist, record } from '../../engine/src/core.mjs';
import { readInventory, inspectInventory } from '../base/_inventory.mjs';

const classKinds = new Set(['container-atom', 'action-atom']);
const question = (name, field, atom) => ({ ...field, name, required: true, atom });
const classNames = value => {
  insist(value === undefined || typeof value === 'string', 'BAD_REQUEST', 'Container classes must be text.');
  const names = [...new Set((value ?? '').split(/\s+/).filter(Boolean))];
  insist(names.every(name => /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name)), 'BAD_REQUEST', 'Atom classes must use lowercase kebab-case.');
  return names;
};

export const readComponentGrids = async () => JSON.parse(await readFile(new URL('../html/add/grid/grids.json', import.meta.url), 'utf8'));

const namedItems = items => {
  const result = [];
  const visit = item => {
    if (item.indexed === false) return;
    result.push(item);
    for (const child of Object.values(item.items ?? {})) visit(child);
  };
  for (const item of Array.isArray(items) ? items : Object.values(items ?? {})) visit(item);
  return result;
};

const readClasses = async (context, settings) => {
  const type = pathValue(settings.paths?.['container-atoms']) ? 'container-atoms' : pathValue(settings.paths?.atoms) ? 'atoms' : 'container-atoms';
  let inventory = await readInventory(context, type);
  if (inventory.status === 'not-indexed') inventory = await inspectInventory(context, type);
  if (inventory.status === 'path-required') return [];
  insist(['completed', 'not-indexed', 'current', 'stale'].includes(inventory.status), 'ATOM_INDEX_UNAVAILABLE', inventory.message ?? 'The configured atom collection could not be read.', { inventory });
  return namedItems(inventory.items);
};

// Read-only preflight shared by conversation planning and direct stamp execution.
// Decisions describe a whole dependency plan; no child runs while a question remains.
export const prepareComponentInputs = async ({ options = {}, context = {}, helpers = {} }) => {
  const resolvedOptions = { ...options };
  const catalog = await readComponentGrids();
  const gridName = options.grid === 'none' ? '' : options.grid ?? '';
  insist(typeof gridName === 'string' && (gridName === '' || Object.hasOwn(catalog.layouts, gridName)), 'BAD_REQUEST', `Choose a grid from: none, ${Object.keys(catalog.layouts).join(', ')}.`);
  const grid = gridName ? { name: gridName, areas: [...catalog.layouts[gridName].areas] } : null;
  if (Object.hasOwn(options, 'grid')) resolvedOptions.grid = gridName;
  const names = classNames(options.class_name), questions = [], dependencies = [];
  if (!names.length || options.ensure_atoms === false) return { questions, resolvedOptions, options: resolvedOptions, dependencies, grid };
  insist(context?.project?.root, 'PROJECT_CONTEXT_REQUIRED', 'Select a project before resolving component atoms.');
  const memory = createRabMemory({ rabHome: context.rab_home });
  const settings = await memory.readProjectSettings(context.project);
  const items = await readClasses(context, settings);
  const decisions = options.atom_decisions ?? {};
  insist(record(decisions), 'BAD_REQUEST', 'atom_decisions must be an object keyed by class name.');
  const kept = [];
  let creators;
  for (const name of names) {
    if (items.some(item => item.name === name || [item.class, item.class_name].some(value => typeof value === 'string' && value.split(/\s+/).includes(name)))) { kept.push(name); continue; }
    const decision = decisions[name] ?? {};
    insist(record(decision), 'BAD_REQUEST', `Decision for ${name} must be an object.`);
    if (decision.create === false) continue;
    if (decision.create === undefined) {
      questions.push(question(`atom:${name}:create`, { type: 'boolean', title: `Create ${name}?`, description: `${name} was not found. Would you like to add a class atom?` }, { class_name: name, field: 'create' }));
      continue;
    }
    insist(decision.create === true, 'BAD_REQUEST', `Create ${name} must be boolean.`);
    if (!creators) {
      insist(typeof helpers.listTools === 'function' && typeof helpers.getTool === 'function' && typeof helpers.bindSettings === 'function', 'RUNNER_REQUIRED', 'Atom creation requires the shared runner catalog and input binding.');
      const listed = await helpers.listTools();
      creators = listed.items.filter(tool => tool.meta?.operation === 'create' && tool.meta?.target_type === 'atom' && classKinds.has(tool.meta.atom_kind));
      const react = creators.filter(tool => tool.meta.domain === 'react');
      if (react.length) creators = react;
    }
    const kinds = [...new Set(creators.map(tool => tool.meta.atom_kind))];
    insist(kinds.length, 'ATOM_TOOL_UNAVAILABLE', 'No class-producing atom tools are available.');
    if (decision.kind === undefined || decision.kind === '') {
      questions.push(question(`atom:${name}:kind`, { type: 'options', title: `Kind for ${name}`, description: 'Choose a class-producing atom. Container atoms skin containers; action atoms skin interactive elements.', enum: kinds, options: kinds.map(kind => ({ name: kind, description: creators.find(tool => tool.meta.atom_kind === kind).description })) }, { class_name: name, field: 'kind' }));
      continue;
    }
    insist(kinds.includes(decision.kind), 'BAD_REQUEST', 'Choose an available class-producing atom kind. Grid atoms use data-grid and effect atoms supply tokens.');
    const matches = creators.filter(tool => tool.meta.atom_kind === decision.kind);
    insist(matches.length === 1, 'AMBIGUOUS_ATOM_TOOL', `More than one tool creates ${decision.kind}; select a single implementation in the project toolkit.`);
    const tool = await helpers.getTool(matches[0].address ?? matches[0].key ?? matches[0].id);
    const childOptions = { ...(decision.options ?? {}) };
    insist(record(decision.options ?? {}), 'BAD_REQUEST', `Inputs for ${name} must be an object.`);
    childOptions.name = name;
    if (childOptions.location === undefined) childOptions.location = pathValue(settings.paths?.[`${decision.kind}s`]) ?? pathValue(settings.paths?.atoms);
    if (typeof childOptions.location === 'string' && childOptions.location !== '') {
      const relative = path.isAbsolute(childOptions.location) ? path.relative(context.project.root, childOptions.location) : childOptions.location;
      childOptions.location = await containedPath(context.project.root, relative.split(path.sep).join('/'), { allowMissing: true });
    }
    const bound = helpers.bindSettings(tool, childOptions);
    for (const missing of bound.missing) {
      const field = tool.settings.find(field => field.name === missing.name);
      questions.push(question(`atom:${name}:${missing.name}`, { ...field, title: `${name}: ${field.title ?? field.name}` }, { class_name: name, field: missing.name }));
    }
    if (!bound.missing.length) {
      // Existing class atom stamps accept declarations, never selectors or rules.
      if (bound.options.styles !== undefined) insist(typeof bound.options.styles === 'string' && !/[{}]/.test(bound.options.styles), 'BAD_REQUEST', 'Atom styles must be CSS declarations without selectors or braces.');
      const destination = path.join(bound.options.location, name);
      try { await lstat(destination); throw Object.assign(new Error(`Atom target already exists: ${destination}`), { code: 'EEXIST' }); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      dependencies.push({ key: tool.address ?? tool.key ?? String(tool.id), options: bound.options, class_name: name, kind: decision.kind });
      kept.push(name);
    }
  }
  if (kept.length) resolvedOptions.class_name = kept.join(' ');
  else delete resolvedOptions.class_name;
  return { questions, resolvedOptions, options: resolvedOptions, dependencies, grid };
};
