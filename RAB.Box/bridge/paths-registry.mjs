import { readFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { insist, record } from '../engine/src/core.mjs';

const readJson = async file => JSON.parse(await readFile(file, 'utf8'));
const exists = async file => { try { await lstat(file); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } };
const slash = value => String(value).split(path.sep).join('/');
const safeKey = value => /^[a-z0-9][a-z0-9-]*$/.test(String(value ?? ''));
const safeRelativePath = value => {
  const raw = String(value ?? '').trim().replaceAll('\\','/');
  if (!raw || raw.startsWith('/') || /^[A-Za-z]:\//.test(raw) || raw.startsWith('//')) return false;
  const parts = raw.split('/');
  return parts.every(part => part && part !== '.' && part !== '..');
};

const validateDirectMap = (value, label) => {
  insist(record(value), 'BAD_PATHS', `${label} must be an object.`);
  for (const [key, entry] of Object.entries(value)) {
    insist(safeKey(key), 'BAD_PATHS', `${label}.${key}: direct lookup keys must be lowercase kebab-case.`);
    insist(record(entry), 'BAD_PATHS', `${label}.${key}: entry must be an object.`);
    // New house-address entries are { id, path }. Legacy project stamps may still be
    // { settings, script, ... }; those remain readable by the legacy engine.
    if (Object.hasOwn(entry, 'path')) {
      insist(Number.isSafeInteger(Number(entry.id)) && Number(entry.id) > 0, 'BAD_PATHS', `${label}.${key}: id must be a positive stable integer.`);
      insist(typeof entry.path === 'string' && entry.path.trim(), 'BAD_PATHS', `${label}.${key}: path is required.`);
      insist(!path.isAbsolute(entry.path) && safeRelativePath(entry.path), 'BAD_PATHS', `${label}.${key}: path must be a safe relative path without dot segments.`);
      if (entry.toolkit !== undefined) insist(Number.isSafeInteger(entry.toolkit) && entry.toolkit > 0, 'BAD_PATHS', `${label}.${key}: toolkit must be a positive numeric toolkit ID.`);
    }
  }
  return value;
};

export const createPathsRegistry = ({ root, discover = null }) => {
  const houseFile = path.join(root, 'PATHS.json');

  const readHouse = async () => {
    if (!(await exists(houseFile))) return { file:houseFile, manifest:{ stamps:{}, tools:{} } };
    const manifest = await readJson(houseFile);
    validateDirectMap(manifest.stamps ?? {}, 'PATHS.stamps');
    validateDirectMap(manifest.tools ?? {}, 'PATHS.tools');
    return { file:houseFile, manifest };
  };

  const readProject = async projectRoot => {
    if (!projectRoot) return { file:null, manifest:{ stamps:{}, tools:{} } };
    const file = path.join(path.resolve(projectRoot), 'PATHS.json');
    if (!(await exists(file))) return { file, manifest:{ stamps:{}, tools:{} } };
    const manifest = await readJson(file);
    validateDirectMap(manifest.stamps ?? {}, 'project.PATHS.stamps');
    validateDirectMap(manifest.tools ?? {}, 'project.PATHS.tools');
    return { file, manifest };
  };

  const pack = async ({ projectRoot } = {}) => {
    const house = await readHouse();
    const project = await readProject(projectRoot);
    const catalog = discover ? await discover({projectRoot}) : null;
    const diagnostics = [];
    const generated = new Map();
    for (const tool of catalog?.items ?? []) {
      const address = tool.key.split('/').slice(1).map(part=>part.replace(/^stamp-/, '')).join('-');
      if (!safeKey(address)) continue;
      const candidates = generated.get(address) ?? [];
      candidates.push(tool); generated.set(address, candidates);
    }
    const declared = address => Object.hasOwn(house.manifest.tools ?? {}, address) || Object.hasOwn(house.manifest.stamps ?? {}, address)
      || ['tools','stamps'].some(section => { const entry=project.manifest[section]?.[address]; return entry && Object.hasOwn(entry,'id') && Object.hasOwn(entry,'path'); });
    for (const [address, candidates] of generated) if (candidates.length > 1 && !declared(address))
      diagnostics.push({address,code:'AMBIGUOUS_PATH',message:`Derived address ${address} matches multiple tools; use a permanent ID or full tool path.`,candidates:candidates.map(tool=>tool.key)});
    const combine = section => {
      const out = {};
      for (const [key, entry] of Object.entries(house.manifest[section] ?? {})) out[key] = { ...entry, address:key, kind:section === 'stamps' ? 'stamp' : 'tool', source:'house', source_file:house.file, shadowed:null };
      for (const [key, entry] of Object.entries(project.manifest[section] ?? {})) {
        const discovered=generated.get(key);
        const inherited=discovered?.length===1 && (discovered[0].kind==='stamp'?'stamps':'tools')===section ? discovered[0] : null;
        const prior = out[key] ?? (inherited?{id:inherited.id,path:inherited.path,source:inherited.source??'house'}:null);
        // Legacy project stamp entries are intentionally not treated as new-style
        // direct overrides unless they provide the stable {id,path} pair.
        if (!(Object.hasOwn(entry, 'id') && Object.hasOwn(entry, 'path'))) continue;
        out[key] = { ...entry, address:key, kind:section === 'stamps' ? 'stamp' : 'tool', source:'project', source_file:project.file, shadowed:prior ? { id:prior.id, path:prior.path, source:prior.source } : null };
      }
      // Existing explicit addresses keep their preferred order for planners.
      // Derived names supplement registration; they never supersede it.
      for (const [address, candidates] of generated) {
        if (candidates.length !== 1 || declared(address)) continue;
        const tool=candidates[0];
        if ((tool.kind === 'stamp' ? 'stamps' : 'tools') !== section) continue;
        out[address]={id:tool.id,path:tool.key,address,kind:tool.kind,source:tool.source??'house',source_file:null,derived:true,shadowed:null,...(tool.toolkit?{toolkit:tool.toolkit.id}:{})};
      }
      return out;
    };
    const stamps=combine('stamps'), tools=combine('tools');
    if (catalog) for (const entry of [...Object.values(stamps),...Object.values(tools)]) {
      if ((entry.source !== 'house' && entry.toolkit === undefined) || entry.derived) continue;
      const byId=catalog.items.find(tool=>String(tool.id)===String(entry.id));
      const byPath=catalog.items.find(tool=>tool.key===entry.path);
      if (!byId || byId.key !== entry.path || (entry.toolkit !== undefined && byId.toolkit?.id !== entry.toolkit) || (byPath && String(byPath.id)!==String(entry.id)))
        diagnostics.push({address:entry.address,code:'STALE_PATH',message:`Registered address ${entry.address} no longer matches its tool identity and path.`,id:entry.id,path:entry.path,current_path:byId?.key??null});
    }
    return { version:'0.8.5', project_root:projectRoot ? path.resolve(projectRoot) : null, stamps, tools, diagnostics };
  };

  const resolve = async (address, { projectRoot, kind } = {}) => {
    insist(safeKey(address), 'BAD_REQUEST', 'PATHS lookup key must be lowercase kebab-case.');
    const packed = await pack({ projectRoot });
    const ambiguous=packed.diagnostics.find(item=>item.address===address&&item.code==='AMBIGUOUS_PATH');
    insist(!ambiguous,'AMBIGUOUS_PATH',ambiguous?.message);
    const matches = [];
    if (kind !== 'tool' && packed.stamps[address]) matches.push(packed.stamps[address]);
    if (kind !== 'stamp' && packed.tools[address]) matches.push(packed.tools[address]);
    insist(matches.length <= 1, 'AMBIGUOUS_PATH', `PATHS key exists in both stamps and tools: ${address}`);
    return matches[0] ?? null;
  };

  const tagsFromPath = value => slash(value).split('/').filter(Boolean);

  return Object.freeze({ readHouse, readProject, pack, resolve, tagsFromPath });
};
