import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { insist, record } from '../engine/src/core.mjs';

const within = (root, file) => {
  const relative = path.relative(root, file);
  return !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`);
};
const get = (value, selector) => selector.split('.').reduce((at, key) => at && Object.hasOwn(at, key) ? at[key] : undefined, value);

export const validateSignalContract = data => {
  insist(record(data) && data.version === 'tool-contract/v1', 'BAD_TOOL_CONTRACT', 'Signal requires a tool-contract/v1 contract.');
  insist(record(data.source) && ['template', 'internal', 'hybrid', 'composite', 'file-operation', 'unclassified'].includes(data.source.kind) && typeof data.source.description === 'string' && data.source.description.trim(), 'BAD_TOOL_CONTRACT', 'Signal contract requires its source kind and description.');
  insist(Array.isArray(data.settings) && record(data.result), 'BAD_TOOL_CONTRACT', 'Signal contract requires settings array and result object.');
  return data;
};

export const loadSignalContract = async folder => {
  const contractFile = path.join(folder, 'contract.json');
  const resolved = await realpath(contractFile);
  insist(within(await realpath(folder), resolved), 'BAD_TOOL_CONTRACT', 'Signal contract leaves its folder.');
  const raw = validateSignalContract(JSON.parse(await readFile(resolved, 'utf8')));
  const contract = await loadToolContract({ tool: { root: folder, scriptFile: path.join(folder, '_not-executed.mjs'), settings: raw.settings, meta: {} }, boundary: folder });
  return { ...contract, ready: raw.source.kind !== 'unclassified', executable: false };
};

// Declarative sidecars only: browsing a contract never imports its executor.
// The executor's folder owns defaults; a leaf can override supplied fields.
export async function loadToolContract({ tool, boundary }) {
  boundary = await realpath(boundary);
  const files = [];
  const owners = {};
  const read = async (file, stack = [], optional = false) => {
    let resolved;
    try { resolved = await realpath(file); }
    catch (error) { if (optional && error.code === 'ENOENT') return {}; throw error; }
    insist(within(boundary, resolved), 'BAD_TOOL_CONTRACT', 'Contract reference leaves its tool boundary.');
    insist(!stack.includes(resolved), 'BAD_TOOL_CONTRACT', `Circular contract reference: ${file}`);
    const data = JSON.parse(await readFile(resolved, 'utf8'));
    insist(record(data) && data.version === 'tool-contract/v1', 'BAD_TOOL_CONTRACT', `${file}: expected tool-contract/v1.`);
    if (!files.includes(resolved)) files.push(resolved);
    return evaluate(data, resolved, [...stack, resolved]);
  };
  const evaluate = async (node, file, stack) => {
    insist(record(node), 'BAD_TOOL_CONTRACT', `${file}: contract branch must be an object.`);
    let values = {};
    if (Object.hasOwn(node, 'extends')) {
      insist(typeof node.extends === 'string' && !path.isAbsolute(node.extends), 'BAD_TOOL_CONTRACT', `${file}: extends must be a relative file.`);
      values = await read(path.resolve(path.dirname(file), node.extends), stack);
    }
    for (const key of ['result', 'source', 'settings']) if (Object.hasOwn(node, key)) {
      if (key === 'source' && node[key] !== null) {
        insist(record(node[key]) && ['template', 'internal', 'hybrid', 'composite', 'file-operation', 'unclassified'].includes(node[key].kind), 'BAD_TOOL_CONTRACT', `${file}: invalid source kind.`);
      }
      values[key] = node[key]; owners[key] = file;
    }
    if (Object.hasOwn(node, 'select')) {
      insist(typeof node.select === 'string' && /^(meta\.[a-zA-Z0-9_.]+|name)$/.test(node.select) && record(node.variants), 'BAD_TOOL_CONTRACT', `${file}: invalid contract selector.`);
      const selected = get(tool, node.select);
      if (['string', 'number', 'boolean'].includes(typeof selected) && Object.hasOwn(node.variants, String(selected)))
        values = { ...values, ...await evaluate(node.variants[String(selected)], file, stack) };
    }
    return values;
  };
  try {
    const owner = path.join(path.dirname(tool.scriptFile), 'contract.json');
    const local = path.join(tool.root, 'contract.json');
    const inherited = await read(owner, [], true);
    const overrides = local === owner ? {} : await read(local, [], true);
    return { consumes: tool.settings.map(field => field.name), returns: Array.isArray(tool.meta.returns) ? tool.meta.returns : [],
      ...inherited, ...overrides, files, owners };
  } catch (error) {
    if (!error.code || ['ENOENT', 'EISDIR'].includes(error.code)) error.code = 'BAD_TOOL_CONTRACT';
    throw error;
  }
}
