import { readdir, readFile, lstat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { insist, record } from '../engine/src/core.mjs';
import { createSeatParser } from './seat-parser.mjs';
import { createRabMemory } from './rab-memory.mjs';
import { makeItemSettings, makeSignalSettings } from './rab-node.mjs';
import { createPathsRegistry } from './paths-registry.mjs';
import { readToolkitLinks, readProjectToolkit, loadToolkit, pathIdentity, withinRoot } from './toolkit-links.mjs';
import { renderTemplateTree, writeArtifactPlan } from '../tools/_artifact-plan.mjs';
import { runProjectStamp, runReactComponentStamp } from '../tools/_stamp-engines.mjs';
import { resolveProjectFolder } from '../tools/react/_project-paths.mjs';
import { makeTransition, normalizeAuthority } from './flow-runtime.mjs';
import { canonicalizeShape } from './shape-codec.mjs';
import { createUsageLedger } from './usage-ledger.mjs';
import { scopeSeat, substituteReturnedSeats } from './seat-reducer.mjs';
import { compactValue, jsonBytes, newExecution } from './tool-tracking.mjs';
import { loadToolContract } from './tool-contract.mjs';
import { SCRATCH_SCOPE, createScratchScope, validateScratchInput } from './tool-scratch.mjs';

const readJson = async file => JSON.parse(await readFile(file, 'utf8'));
const exists = async file => { try { await lstat(file); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } };
const lower = value => String(value ?? '').toLowerCase();
const flatText = value => {
  const out = [];
  const walk = item => {
    if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') out.push(String(item));
    else if (Array.isArray(item)) item.forEach(walk);
    else if (record(item)) Object.values(item).forEach(walk);
  };
  walk(value); return out.join(' ');
};
const slash = value => String(value).split(path.sep).join('/');
const splitTag = value => String(value).split('-').filter(Boolean);
const normalizedTag = value => lower(value).replace(/-/g, '');
// Template and starter-kit trees are source assets, not Tool registrations.
const SKIP_DIRS = new Set(['template', 'starter-kits', 'node_modules', '.git', '.rab']);
const PATH_OPERATIONS = new Map([
  ['create','create'], ['new','create'], ['add','create'], ['stamp','create'], ['change','update'],
  ['find','find'], ['count','count'], ['list','list'], ['load','load'], ['view','view'],
  ['check','check'], ['remove','delete'], ['delete','delete'], ['update','update'], ['edit','update'],
  ['run','execute'], ['execute','execute'], ['move','move'], ['copy','copy'], ['rename','rename'], ['save','save'], ['unwrap','detach'], ['detach','detach'], ['import','import'], ['inspect','inspect'], ['audit','inspect'], ['scan','inspect'],
  ['determine','determine']
]);
const PATH_TARGETS = new Map([
  ['hook','hook'], ['hooks','hook'], ['component','component'], ['components','component'],
  ['project','project'], ['projects','project'], ['file','file'], ['files','file'],
  ['comment','comment'], ['comments','comment'], ['import','import'], ['imports','import'],
  ['export','export'], ['exports','export'], ['atom','atom'], ['atoms','atom'], ['chart','chart'], ['charts','chart'],
  ['tool','tool'], ['tools','tool'], ['stamp','stamp'], ['stamps','stamp'], ['grid','grid'], ['grids','grid'],
  ['class','class'], ['classes','class'], ['element','element'], ['elements','element'], ['div','element'], ['divs','element']
]);

const pathSemantics = tags => {
  const domain = tags[0] ?? null;
  const operation = tags.slice(1).map(tag => PATH_OPERATIONS.get(tag)).find(Boolean) ?? null;
  const target_type = [...tags.slice(1)].reverse().map(tag => PATH_TARGETS.get(tag)).find(Boolean) ?? null;
  return { domain, operation, target_type };
};

const validateTool = (settings, { key, domain, folder, tags, hasTemplate, hasScript }) => {
  insist(record(settings), 'BAD_TOOL', `${key}: settings.json must contain an object.`);
  for (const keyName of ['id','name','title','description','settings','meta']) insist(Object.hasOwn(settings,keyName), 'BAD_TOOL', `${key}: settings.json is missing ${keyName}.`);
  insist(typeof settings.name === 'string' && settings.name === folder, 'BAD_TOOL', `${key}: settings.name must match the leaf folder name.`);
  insist(typeof settings.title === 'string' && settings.title.trim(), 'BAD_TOOL', `${key}: title is required.`);
  insist(typeof settings.description === 'string' && settings.description.trim(), 'BAD_TOOL', `${key}: description is required.`);
  insist(Array.isArray(settings.settings), 'BAD_TOOL', `${key}: settings must be an array.`);
  insist(record(settings.meta), 'BAD_TOOL', `${key}: meta must be an object.`);
  insist(hasScript, 'BAD_TOOL', `${key}: requires its own executable or a nearest-parent <folder>.mjs executor.`);
  // Template presence determines the internal kind; public names stay semantic.
  if (!hasTemplate) insist(!folder.startsWith('stamp-'), 'BAD_TOOL', `${key}: stamp-* requires template/.`);

  const inherited = pathSemantics(tags);
  if (settings.meta.domain !== undefined) insist(settings.meta.domain === domain, 'PATH_META_CONFLICT', `${key}: meta.domain=${settings.meta.domain} contradicts path domain ${domain}.`);
  if (inherited.operation && settings.meta.operation !== undefined) insist(settings.meta.operation === inherited.operation, 'PATH_META_CONFLICT', `${key}: meta.operation=${settings.meta.operation} contradicts inherited path operation ${inherited.operation}.`);
  if (inherited.target_type && settings.meta.target_type !== undefined) insist(settings.meta.target_type === inherited.target_type, 'PATH_META_CONFLICT', `${key}: meta.target_type=${settings.meta.target_type} contradicts inherited path target ${inherited.target_type}.`);
  return settings;
};

const toolDirectories = async toolsRoot => {
  const out = [];
  const walk = async dir => {
    const entries = (await readdir(dir, { withFileTypes:true })).sort((a,b)=>a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink() || SKIP_DIRS.has(entry.name)) continue;
      const child = path.join(dir, entry.name);
      out.push(child);
      await walk(child);
    }
  };
  await walk(toolsRoot);
  return out;
};

const nearestExecutor = async ({ toolsRoot, toolRoot }) => {
  let current = toolRoot;
  while (current !== toolsRoot && current.startsWith(toolsRoot + path.sep)) {
    const owner = path.basename(current);
    const candidate = path.join(current, `${owner}.mjs`);
    if (await exists(candidate)) return { file:candidate, ownerRoot:current, inherited:current !== toolRoot };
    current = path.dirname(current);
  }
  return null;
};

export const createToolHouse = ({ root, toolsRoot = path.join(root, 'tools'), usageLedger = null }) => {
  let cache = null;
  let cacheContext = null;
  let parserPromise = null;
  const parser = () => parserPromise ??= createSeatParser({ languageRoot:path.join(root,'language') });
  const pathsRegistry = createPathsRegistry({ root, discover: ({projectRoot}={}) => scan({context:{project:projectRoot?{root:projectRoot}:null}}) });

  const scan = async ({ fresh = false, context = {} } = {}) => {
    const contextKey=context.project?.root?pathIdentity(context.project.root):null;
    if (cache && !fresh && cacheContext===contextKey) return cache;
    const items = [], unavailable = [], toolkits = [];
    const sources = [{toolsRoot:await realpath(toolsRoot), toolkit:null}];
    let links = [];
    try { links = (await readToolkitLinks(root)).toolkits; }
    catch (error) { unavailable.push({key:'TOOLKITS.json',code:error.code ?? 'BAD_TOOLKITS',message:error.message}); }
    try {
      const projectToolkit=await readProjectToolkit(context.project?.root);
      if(projectToolkit)links.push({path:projectToolkit,project:true});
    } catch(error) { unavailable.push({key:'custom_toolkit_path',source:'project',code:error.code??'BAD_TOOLKIT',message:error.message}); }
    for (const link of links) {
      if (link.enabled === false) { toolkits.push({root:link.path,enabled:false}); continue; }
      try {
        const toolkit = await loadToolkit(link.path);
        if(link.project && sources.some(source=>pathIdentity(source.toolsRoot)===pathIdentity(toolkit.toolsRoot)))continue;
        const overlap = sources.find(source => withinRoot(source.toolsRoot,toolkit.toolsRoot) || withinRoot(toolkit.toolsRoot,source.toolsRoot));
        insist(!overlap,'DUPLICATE_TOOLKIT_ROOT',`Toolkit root overlaps another tools tree: ${toolkit.root}`);
        sources.push({toolsRoot:toolkit.toolsRoot,toolkit});
        toolkits.push({...toolkit,enabled:true});
      } catch (error) { unavailable.push({key:link.path,source:'toolkit',code:error.code ?? 'BAD_TOOLKIT',message:error.message}); }
    }
    const toolkitCounts=new Map();
    for(const source of sources)if(source.toolkit)toolkitCounts.set(source.toolkit.id,(toolkitCounts.get(source.toolkit.id)??0)+1);
    const conflictingToolkits=new Set([...toolkitCounts].filter(([,count])=>count>1).map(([id])=>id));
    for (const source of sources) {
    if(source.toolkit && conflictingToolkits.has(source.toolkit.id)) {
      unavailable.push({key:source.toolkit.root,toolkit:source.toolkit,source:'toolkit',code:'DUPLICATE_TOOLKIT_ID',message:`Toolkit ID ${source.toolkit.id} belongs to multiple roots; every contender is unavailable.`});
      continue;
    }
    const boundary = source.toolsRoot;
    let directories;
    try { directories=await toolDirectories(boundary); }
    catch(error) { if(!source.toolkit)throw error;unavailable.push({key:boundary,source:'toolkit',toolkit:source.toolkit,code:error.code??'BAD_TOOLKIT',message:error.message});continue; }
    for (const toolRoot of directories) {
      const settingsFile = path.join(toolRoot, 'settings.json');
      if (!(await exists(settingsFile))) continue;
      const relative = slash(path.relative(boundary, toolRoot));
      const tags = relative.split('/').filter(Boolean);
      const domain = source.toolkit?.name ?? tags[0] ?? '';
      const folder = tags.at(-1) ?? '';
      const key = relative;
      const templateRoot = path.join(toolRoot, 'template');
      try {
        const executor = await nearestExecutor({ toolsRoot:boundary, toolRoot });
        const hasTemplate = await exists(templateRoot);
        if (source.toolkit) {
          for (const file of [settingsFile,executor?.file,...(hasTemplate?[templateRoot]:[])].filter(Boolean)) {
            const info=await lstat(file);
            insist(!info.isSymbolicLink() && withinRoot(boundary,await realpath(file)), 'INVALID_PATH', `${key}: Toolkit settings, executor and template must stay inside their tools tree without links.`);
            if(file!==templateRoot)insist(info.isFile(),'BAD_TOOL',`${key}: settings and executor must be regular files.`);
            if(file===settingsFile)insist(info.size<=1024*1024,'BAD_TOOL',`${key}: settings.json must stay under 1 MiB.`);
          }
          if (hasTemplate) insist((await lstat(templateRoot)).isDirectory(),'BAD_TOOL',`${key}: template must be a directory.`);
        }
        const definition = await readJson(settingsFile);
        if (definition.indexed === false) continue;
        const settings = validateTool(makeItemSettings(definition), { key, domain, folder, tags, hasTemplate, hasScript:Boolean(executor) });
        if (source.toolkit) {
          insist(Number.isSafeInteger(settings.id) && settings.id>0,'BAD_TOOL',`${key}: external Tool id must be a positive numeric integer.`);
          const names=new Set();
          for(const field of settings.settings) {
            insist(record(field) && typeof field.name==='string' && /^[a-z][a-z0-9_]*$/.test(field.name) && !['constructor','prototype','__proto__'].includes(field.name) && !names.has(field.name),'BAD_TOOL',`${key}: each input needs a unique safe name.`);
            names.add(field.name);
            insist(['text','textarea','folder','file','path','boolean','number','options','json','settings'].includes(field.type),'BAD_TOOL',`${key}: unsupported input type ${field.type}.`);
            insist(field.required===undefined || typeof field.required==='boolean','BAD_TOOL',`${key}: required must be boolean.`);
            insist(field.enum===undefined || Array.isArray(field.enum),'BAD_TOOL',`${key}: enum must be an array.`);
          }
        }
        const scriptName = path.basename(executor.file);
        const scriptOwner = slash(path.relative(boundary, executor.ownerRoot));
        const item = {
          id: settings.id,
          key,
          path: key,
          tags,
          domain,
          kind: hasTemplate ? 'stamp' : 'tool',
          name: settings.name,
          title: settings.title,
          description: settings.description,
          indexed: settings.indexed,
          settings: settings.settings,
          meta: settings.meta,
          inherited: pathSemantics(tags),
          root: toolRoot,
          script: scriptName,
          scriptFile: executor.file,
          scriptOwner,
          inheritedExecutor: executor.inherited,
          settingsFile,
          template: hasTemplate ? templateRoot : null,
          source: source.toolkit ? 'toolkit' : 'house',
          toolkit: source.toolkit,
          contract: { consumes: settings.settings.map(field=>field.name), returns: Array.isArray(settings.meta.returns) ? settings.meta.returns : [] },
          authorityClass: normalizeAuthority(settings.meta.authority),
          index: { id:settings.id, path:key, tags, script:scriptName }
        };
        item.contract = await loadToolContract({ tool:item, boundary });
        items.push(item);
      } catch (error) { unavailable.push({ key, source:source.toolkit?'toolkit':'house', toolkit:source.toolkit, code:error.code ?? 'BAD_TOOL', message:error.message }); }
    }
    }

    const counts = new Map();
    for (const item of items) counts.set(String(item.id), (counts.get(String(item.id)) ?? 0) + 1);
    const duplicateIds = new Set([...counts].filter(([,count])=>count>1).map(([id])=>id));
    if (duplicateIds.size) {
      for (const item of items.filter(item=>duplicateIds.has(String(item.id)))) unavailable.push({ key:item.key, source:item.source, toolkit:item.toolkit, code:'DUPLICATE_TOOL_ID', message:`${item.key}: Tool ID ${item.id} is also used by another Tool. IDs are permanent identities and must be unique.` });
    }
    const keys = new Map();
    for (const item of items) keys.set(item.key,(keys.get(item.key)??0)+1);
    const duplicateKeys = new Set([...keys].filter(([,count])=>count>1).map(([key])=>key));
    for (const item of items.filter(item=>duplicateKeys.has(item.key))) unavailable.push({key:item.key,source:item.source,toolkit:item.toolkit,code:'DUPLICATE_TOOL_PATH',message:`${item.key}: multiple Tools use this full path. All contenders are unavailable; use distinct paths.`});
    const visible = items.filter(item=>!duplicateIds.has(String(item.id)) && !duplicateKeys.has(item.key));
    cache = { items:visible, unavailable, toolkits, scanned_at:new Date().toISOString() };
    cacheContext=contextKey;
    return cache;
  };

  const listTools = async ({ domain, includeStamps = true, fresh = false, context = {} } = {}) => {
    const data = await scan({fresh,context});
    const items = data.items.filter(tool => {
      if (!includeStamps && tool.kind === 'stamp') return false;
      if (!domain) return true;
      return tool.domain === 'base' || tool.domain === domain;
    });
    return { ...data, items };
  };

  const findTools = async ({ query, domain, includeStamps = true, functionPrefix, requestFrame: suppliedFrame = null, context = {} } = {}) => {
    insist(typeof query === 'string' && query.trim() && query.length <= 1000, 'BAD_REQUEST', 'find-tool requires query text.');
    const data = await listTools({domain,includeStamps,context});
    let candidates=data.items;
    const unavailable=[...data.unavailable];
    if(context.project?.root) {
      const packed=await pathsRegistry.pack({projectRoot:context.project.root});
      const overrides=[...Object.values(packed.stamps),...Object.values(packed.tools)].filter(entry=>entry.source==='project');
      const shadowed=new Set(overrides.map(entry=>String(entry.shadowed?.id)).filter(id=>id!=='undefined'));
      const effective=new Map(candidates.filter(tool=>!shadowed.has(String(tool.id))).map(tool=>[String(tool.id),tool]));
      for(const entry of overrides) {
        try {
          const tool=await getTool(entry.address,{context});
          if((includeStamps || tool.kind!=='stamp') && (!domain || tool.domain==='base' || tool.domain===domain))effective.set(String(tool.id),tool);
        }catch(error){unavailable.push({key:entry.address,source:'project',code:error.code??'BAD_TOOL',message:error.message});}
      }
      candidates=[...effective.values()];
    }
    const functionTag = functionPrefix ? String(functionPrefix).replace(/-+$/,'').toLowerCase() : null;
    const terms = lower(query).split(/\s+/).map(x=>x.replace(/[^a-z0-9-]/g,'')).filter(x=>x.length>1);
    const seatParser=await parser();
    const parsed=seatParser.parse(query,{context:{domain:domain??null},knownEntities:[]});
    const requestFrame=suppliedFrame??parsed.frames[0]??null;
    const hardSeats=new Set(['domain','operation','target_type']);
    const ranked=[];
    for (const tool of candidates.filter(tool => !functionTag || tool.name.startsWith(`${functionTag}-`) || tool.tags.includes(functionTag))) {
      const tagWords = new Set(tool.tags.flatMap(tag=>[tag, normalizedTag(tag), ...splitTag(tag)]));
      const pathMatches=[];
      let pathScore=0;
      for (const term of terms) {
        const flat=normalizedTag(term);
        const exactTag=tool.tags.find(tag=>tag===term || normalizedTag(tag)===flat);
        if (exactTag) { pathScore+=12; pathMatches.push({term,tag:exactTag,kind:'exact'}); continue; }
        const word=[...tagWords].find(word=>word===term || normalizedTag(word)===flat);
        if (word) { pathScore+=12; pathMatches.push({term,tag:word,kind:'segment'}); continue; }
        const partial=tool.tags.find(tag=>tag.includes(term) || normalizedTag(tag).includes(flat));
        if (partial) { pathScore+=4; pathMatches.push({term,tag:partial,kind:'partial'}); }
      }

      const text = lower([tool.key,tool.tags.join(' '),tool.name,tool.title,tool.description,flatText(tool.settings),flatText(tool.meta)].join(' '));
      const matched = terms.filter(term=>text.includes(term) || text.replace(/-/g,'').includes(normalizedTag(term)));
      const nameMatches = terms.filter(term=>lower(tool.name).includes(term) || lower(tool.name).replace(/-/g,'').includes(normalizedTag(term)));
      const textScore = matched.length * 2 + nameMatches.length * 3 + (terms.length && matched.length === terms.length ? 4 : 0);
      const compiled=seatParser.compileCapability(tool.description,{context:{domain:tool.domain}}).frames[0]??null;
      let seatScore=0, hardConflict=false; const seatMatches=[], seatConflicts=[];
      if(requestFrame&&compiled){
        const seatCompatible=(seat,wanted,offered)=>{
          if(String(wanted)===String(offered))return true;
          if(seat==='operation'&&tool.tags.includes('add')&&['attach','insert'].includes(String(wanted))&&String(offered)==='create')return true;
          return false;
        };
        for(const seat of seatParser.coreSeats){
          const wanted=requestFrame.seats?.[seat], offered=tool.meta?.[seat]??compiled.seats?.[seat]??null;
          if(wanted===null||wanted===undefined||offered===null||offered===undefined)continue;
          const pathOwnsHardSeat=seat==='domain'||(seat==='operation'&&Boolean(tool.inherited?.operation))||(seat==='target_type'&&Boolean(tool.inherited?.target_type));
          if(seatCompatible(seat,wanted,offered)){seatScore+=pathOwnsHardSeat?8:4;seatMatches.push([seat,wanted]);}
          else {seatConflicts.push([seat,wanted,offered]);if(pathOwnsHardSeat)hardConflict=true;else seatScore-=4;}
        }
        const reqTypes=new Set(requestFrame.data_types??[]), toolTypes=new Set([...(compiled.data_types??[]),...(tool.meta?.data_types??[])]);
        for(const value of reqTypes)if(toolTypes.has(value)){seatScore+=3;seatMatches.push(['data_type',value]);}
      }
      if(hardConflict) continue;
      const score=pathScore+textScore+seatScore;
      if(score>0) ranked.push({ ...tool, score, path_score:pathScore, text_score:textScore, shape_score:seatScore, path_matches:pathMatches, matched_terms:matched, seat_matches:seatMatches, seat_conflicts:seatConflicts });
    }
    ranked.sort((a,b)=>b.score-a.score || b.path_score-a.path_score || b.shape_score-a.shape_score || a.key.localeCompare(b.key));
    return { query, domain:domain??null, include_stamps:includeStamps, function_prefix:functionPrefix??null, request_shape:requestFrame?{seats:requestFrame.seats,data_types:requestFrame.data_types,complete:requestFrame.completeLanguage}:null, items:ranked, unavailable, authority:0 };
  };

  const loadProjectTool = async ({ address, entry, context }) => {
    insist(context?.project?.root, 'PROJECT_CONTEXT_REQUIRED', `${address}: project override requires a loaded project root.`);
    const projectRoot = path.resolve(context.project.root);
    const toolRoot = path.resolve(projectRoot, entry.path);
    insist(toolRoot !== projectRoot && toolRoot.startsWith(projectRoot + path.sep), 'INVALID_PATH', `${address}: project Tool path must stay inside the project.`);
    insist((await lstat(toolRoot)).isDirectory(), 'TOOL_NOT_FOUND', `${address}: project Tool folder does not exist.`);
    const realProjectRoot = await realpath(projectRoot);
    const realToolRoot = await realpath(toolRoot);
    insist(realToolRoot !== realProjectRoot && realToolRoot.startsWith(realProjectRoot + path.sep), 'INVALID_PATH', `${address}: project Tool path resolves outside the project.`);
    const settingsFile = path.join(toolRoot, 'settings.json');
    insist(await exists(settingsFile), 'BAD_TOOL', `${address}: project Tool needs settings.json in ${entry.path}.`);
    const templateRoot = path.join(toolRoot, 'template');
    const hasTemplate = await exists(templateRoot);
    const executor = await nearestExecutor({ toolsRoot:projectRoot, toolRoot });
    const parts = slash(entry.path).split('/').filter(Boolean);
    if (['project-stamps','tools','stamps'].includes(parts[0])) parts.shift();
    const tags = parts;
    const folder = path.basename(toolRoot);
    const domain = tags[0] ?? folder;
    const semanticPath = tags.join('/');
    const definition = await readJson(settingsFile);
    insist(definition?.indexed!==false,'TOOL_NOT_FOUND',`${address}: this Tool is excluded by indexed:false.`);
    const settings = validateTool(makeItemSettings(definition), { key:semanticPath || address, domain, folder, tags, hasTemplate, hasScript:Boolean(executor) });
    insist(String(settings.id) === String(entry.id), 'PATH_ID_CONFLICT', `${address}: PATHS id ${entry.id} does not match settings.json id ${settings.id}.`);
    const scriptName = path.basename(executor.file);
    const tool = {
      id:settings.id,
      key:semanticPath || address,
      address,
      path:semanticPath || slash(entry.path),
      physicalPath:slash(entry.path),
      tags,
      domain,
      kind:hasTemplate?'stamp':'tool',
      name:settings.name,
      title:settings.title,
      description:settings.description,
      settings:settings.settings,
      meta:settings.meta,
      inherited:pathSemantics(tags),
      root:toolRoot,
      script:scriptName,
      scriptFile:executor.file,
      scriptOwner:slash(path.relative(projectRoot,executor.ownerRoot)),
      inheritedExecutor:executor.inherited,
      settingsFile,
      template:hasTemplate?templateRoot:null,
      source:'project',
      sourceFile:entry.source_file,
      shadowed:entry.shadowed??null,
      index:{id:settings.id,path:semanticPath || slash(entry.path),tags,script:scriptName}
    };
    tool.contract = await loadToolContract({ tool, boundary:projectRoot });
    return tool;
  };

  const loadLinkedTool = async ({address, entry, data}) => {
    const tool=data.items.find(item=>item.toolkit?.id===Number(entry.toolkit) && String(item.id)===String(entry.id));
    insist(tool,'TOOL_NOT_FOUND',`${address}: linked toolkit ${entry.toolkit} does not supply available Tool ${entry.id}.`);
    insist(tool.key===entry.path,'STALE_PATH',`${address}: linked Tool ${entry.id} is at ${tool.key}, not ${entry.path}.`);
    insist(tool.kind===entry.kind,'PATH_KIND_CONFLICT',`${address}: registration kind does not match the linked Tool.`);
    return {...tool,address,source:entry.source,implementation_source:'toolkit',sourceFile:entry.source_file,registeredPath:entry.path,shadowed:entry.shadowed??null};
  };

  const getTool = async (ref, { context = {} } = {}) => {
    const value=String(ref??'').trim();
    insist(value, 'BAD_REQUEST', 'Tool reference is required.');
    const data = await scan({context});
    if(/^\d+$/.test(value)) {
      const house=data.items.find(x=>String(x.id)===value);
      if(house)return house;
      if(context?.project?.root){
        const packed=await pathsRegistry.pack({projectRoot:context.project.root});
        const local=[...Object.values(packed.stamps),...Object.values(packed.tools)].find(x=>x.source==='project'&&String(x.id)===value);
        if(local)return local.toolkit!==undefined ? loadLinkedTool({address:local.address,entry:local,data}) : loadProjectTool({address:local.address,entry:local,context});
      }
      insist(false,'TOOL_NOT_FOUND',`Tool not found: ${value}`);
    }
    if(/^[a-z0-9-]+(?:\/[a-z0-9-]+)+$/.test(value)) {
      const direct=data.items.find(x=>x.key===value);
      insist(direct,'TOOL_NOT_FOUND',`Tool not found: ${value}`);
      return direct;
    }
    insist(/^[a-z0-9][a-z0-9-]*$/.test(value), 'BAD_REQUEST', 'Tool reference must be a permanent numeric ID, a tools-relative path, or a flat PATHS key such as count-use-effect.');
    const entry=await pathsRegistry.resolve(value,{projectRoot:context?.project?.root});
    insist(entry,'TOOL_NOT_FOUND',`PATHS key not found: ${value}`);
    if(entry.toolkit!==undefined)return loadLinkedTool({address:value,entry,data});
    if(entry.source==='project')return loadProjectTool({address:value,entry,context});
    const byId=data.items.find(x=>String(x.id)===String(entry.id));
    insist(byId,'TOOL_NOT_FOUND',`House PATHS entry ${value} points to missing Tool ID ${entry.id}.`);
    insist(byId.key===entry.path,'STALE_PATH',`House PATHS entry ${value} points to ${entry.path}, but Tool ID ${entry.id} is now at ${byId.key}.`);
    const tool=byId;
    return {...tool,address:value,source:tool.source??'house',sourceFile:entry.source_file,registeredPath:entry.path,shadowed:entry.shadowed??null};
  };

  const bindSettings = (tool, supplied = {}) => {
    insist(record(supplied), 'BAD_REQUEST', 'Tool options must be an object.');
    const declared = new Map(tool.settings.map(field=>[field.name,field]));
    for (const key of Object.keys(supplied)) insist(declared.has(key), 'BAD_REQUEST', `${tool.key}: unexpected option ${key}.`);
    const options = {}, missing = [];
    for (const field of tool.settings) {
      let value = supplied[field.name];
      if (value === undefined && Object.hasOwn(field,'default')) value = field.default;
      if (value === undefined || value === null || (field.required && value === '')) {
        if (field.required) missing.push({ name:field.name, title:field.title??field.name, description:field.description??'', type:field.type, try:field.try??null });
        continue;
      }
      if(field.type==='boolean')insist(typeof value==='boolean','INVALID_INPUT',`${field.name} must be Boolean.`);
      if(field.type==='number')insist(typeof value==='number'&&Number.isFinite(value),'INVALID_INPUT',`${field.name} must be a finite number.`);
      if(['text','textarea','folder','file','path'].includes(field.type))insist(typeof value==='string','INVALID_INPUT',`${field.name} must be text.`);
      if(Array.isArray(field.enum))insist(field.enum.includes(value),'INVALID_INPUT',`${field.name} must be a declared choice.`);
      options[field.name] = value;
    }
    return { options, missing };
  };

  const extractChildValue=(field,result)=>{
    const value=result?.result??result;
    if(value?.provided?.seats?.[field.name]!==undefined)return value.provided.seats[field.name];
    if(value?.provided?.value!==undefined)return value.provided.value;
    if(value?.provided?.path!==undefined)return value.provided.path;
    if(value?.provided?.file!==undefined)return value.provided.file;
    if(value?.continuation?.seat===field.name&&value.continuation.value!==undefined)return value.continuation.value;
    if(value?.[field.name]!==undefined)return value[field.name];
    if(value?.path!==undefined)return value.path;
    if(value?.file!==undefined)return value.file;
    return undefined;
  };

  const packResultSeats=(taskSeats,result)=>{
    const value=result?.result??result;
    const packed={};
    if(record(value?.provided?.seats)){
      for(const [name,seatValue] of Object.entries(value.provided.seats)){
        taskSeats[name]=seatValue;
        packed[name]=seatValue;
      }
    }
    if(typeof value?.continuation?.seat==='string'&&value.continuation.value!==undefined){
      taskSeats[value.continuation.seat]=value.continuation.value;
      packed[value.continuation.seat]=value.continuation.value;
    }
    return packed;
  };

  const runTool = async ({ key, options = {}, context = {} }) => {
    // Direct Tool callers may supply only a project root. Tracking and usage
    // must use the same fallback identity for that root throughout the run.
    if(context.project&&context.project.id==null)context={...context,project:{...context.project,id:'project'}};
    const started=performance.now();
    const trace=context.__rab_trace??[];
    const telemetryContext=context.__rab_telemetry??{};
    const run=context.__rab_run??{memory:createRabMemory({rabHome:context.rab_home}),sessionId:telemetryContext.session_id??context.__rab_session_id??null};
    // Identity belongs to the local home even when no project is selected. Keep
    // project persistence optional; children share this same allocation owner.
    const memory=context.project?run.memory:null;
    const execution=newExecution({id:await run.memory.allocateId(),key,parentExecutionId:context.__rab_parent_execution_id??null});
    const eventLedger=usageLedger??(memory?createUsageLedger({rabHome:memory.rabHome}):null);
    const telemetryMeta=context?.project?{id:context.project.id??'project',name:context.project.name??context.project.id??'project',root:context.project.root}:null;
    const emit=async event=>eventLedger&&telemetryMeta?eventLedger.append(telemetryMeta,{session_id:run.sessionId,step_id:telemetryContext.step_id??context.__rab_step_id??null,turn_id:telemetryContext.turn_id??context.__rab_turn_id??null,execution_id:execution.execution_id,parent_execution_id:execution.parent_execution_id,start_date:execution.start_date,end_date:execution.end_date,duration_ms:execution.duration_ms,...event}):null;
    const seatState=context.__rab_seat_state??{promoted:{...(record(context?.bag?.seats)?context.bag.seats:{})},locals:{}};
    const parentTaskId=context.__rab_parent_task_id??null;
    const task={id:execution.execution_id,parentTaskId,requested:key,auto:Boolean(parentTaskId),reason:context.__rab_reason??(parentTaskId?'child-of-tool':'operator/tool-call'),status:'running',started_at:execution.start_date,tool:null,options:{},result:null,error:null,seat_delta:{},execution};
    trace.push(task);
    const rootTask=parentTaskId===null;
    const rootPromotions={};
    let output=null,failure=null,reportAttempted=false;
    let taskSeats=seatState.locals[task.id]??{};
    seatState.locals[task.id]=taskSeats;
    const visibleSeats=()=>({...seatState.promoted,...taskSeats});
    const setTaskSeats=values=>{ taskSeats=values; seatState.locals[task.id]=values; return values; };
    const writeTaskSeat=(name,value,{promote=false}={})=>{
      taskSeats[name]=value;
      if(rootTask&&promote)rootPromotions[name]=value;
      return value;
    };
    try{
      if(memory){
        if(rootTask){
          const saved=await memory.openProject(context.project);
          run.audit=saved.projectSettings?.type==='audit'||saved.meta?.project_type==='audit'||context.bag?.projectSettings?.type==='audit';
          run.projectKey=saved.key;
          if(!run.sessionId)run.sessionId=(await memory.createSession(context.project)).id;
        }
        execution.session_id=run.sessionId;
        execution.project_key=run.projectKey;
        task.tracking_file=await memory.saveToolExecution(context.project,execution);
      }
      if(rootTask)await scan({fresh:true,context});
      const tool = await getTool(key,{context});
      if(rootTask && tool.meta.operation==='create' && tool.meta.target_type==='project')run.audit=false;
      const provenance={source:tool.source??'house',toolkit:tool.toolkit?{id:tool.toolkit.id,name:tool.toolkit.name,root:tool.toolkit.root}:null,implementation_source:tool.implementation_source??tool.source??'house',source_file:tool.sourceFile??tool.settingsFile,shadowed:tool.shadowed??null};
      task.tool={address:tool.address??(String(key).includes('/')?null:String(key)),id:tool.id,path:tool.path,key:tool.key,kind:tool.kind,...provenance};
      task.authority=tool.meta.authority??'read';
      execution.tool={id:tool.id,address:tool.address??tool.key,...provenance};
      execution.options=compactValue(options);
      if(memory)await memory.saveToolExecution(context.project,execution);
      await emit({type:'capability-start',kind:tool.kind,task_id:task.id,auto:task.auto,subject:{type:tool.kind,id:tool.id,address:tool.address??tool.key,path:tool.path,name:tool.name},status:'started',authority:tool.meta.authority??'read'});
      if(rootTask&&run.audit){
        run.auditFolder=await memory.requireAuditFolder(context.project);
        run.auditReady=true;
      }
      if(rootTask&&memory){
        for(const [name,value] of Object.entries(seatState.promoted))seatState.promoted[name]=await memory.resolveToolValue(context.project,value);
      }
      const beforeShape = canonicalizeShape({ seats:visibleSeats(), options:{...options} });
      let supplied={...options};
      if(memory){
        for(const [name,value] of Object.entries(supplied))supplied[name]=await memory.resolveToolValue(context.project,value);
      }
      for(const field of tool.settings){
        const empty=supplied[field.name]===undefined||supplied[field.name]===null||(field.required&&supplied[field.name]==='');
        if(!empty)continue;
        if(run.audit&&field.name==='folder'){
          supplied.folder=run.auditFolder;
          writeTaskSeat('folder',run.auditFolder,{promote:true});
          task.seat_delta.folder={value:run.auditFolder,source:'project-settings:paths.folder'};
          continue;
        }
        if(Object.hasOwn(seatState.promoted,field.name)){ supplied[field.name]=seatState.promoted[field.name]; continue; }
        if(memory){
          const saved=await memory.getProjectPath(context.project,field.name);
          if(saved?.value!==undefined&&saved?.value!==null&&saved?.value!==''){
            const stored=saved.value;
            const value=['folder','file'].includes(field.type)&&!path.isAbsolute(stored)?path.resolve(context.project.root,stored):stored;
            supplied[field.name]=value; writeTaskSeat(field.name,value,{promote:true});
            task.seat_delta[field.name]={value,stored,source:`project-path:${field.name}`};
          }
        }
      }
      let bound=bindSettings(tool,supplied);
      for(const missing of [...bound.missing]){
        if(!missing.try)continue;
        const childTool=await getTool(missing.try,{context});
        const childDeclared=new Set(childTool.settings.map(x=>x.name));
        const childAvailable={...bound.options,...supplied};
        const childOptions=Object.fromEntries(Object.entries(childAvailable).filter(([name,value])=>childDeclared.has(name)&&value!==undefined&&value!==null&&value!==''));
        const child=await runTool({key:missing.try,options:childOptions,context:{...context,__rab_run:run,__rab_parent_execution_id:execution.execution_id,__rab_trace:trace,__rab_seat_state:seatState,__rab_parent_task_id:task.id,__rab_reason:`fill:${missing.name}`}});
        const field=tool.settings.find(x=>x.name===missing.name); const value=extractChildValue(field,child);
        if(value!==undefined){
          const childOwner=child.transition?.task_id??'child';
          const binding=substituteReturnedSeats({parent:taskSeats,returned:{[missing.name]:value},bindings:{[missing.name]:missing.name},childOwner});
          if(binding.applied.some(entry=>entry.from===scopeSeat(childOwner,missing.name))){
            setTaskSeats(binding.values);
            supplied[missing.name]=value;
            if(rootTask)rootPromotions[missing.name]=value;
            task.seat_delta[missing.name]={value,source:`child:${missing.try}`};
          }
        }
      }
      bound=bindSettings(tool,supplied); task.options=bound.options;
      insist(!bound.missing.length, 'INPUT_REQUIRED', `${tool.title} needs more input.`, { missing:bound.missing, safe_to_resume:true });
      if(context[SCRATCH_SCOPE])await validateScratchInput({scope:context[SCRATCH_SCOPE],tool,options:bound.options});
      else if(run.audit&&Object.hasOwn(bound.options,'folder')){
        try{await memory.validateAuditFolder(bound.options.folder);}
        catch(error){throw Object.assign(new Error(`Invalid audit folder: ${error.message}`),{code:'AUDIT_PATH_REQUIRED',field:'folder'});}
      }
      const stat = await lstat(tool.scriptFile);
      const url = pathToFileURL(tool.scriptFile); url.searchParams.set('v', String(stat.mtimeMs));
      const mod = await import(url.href);
      insist(typeof mod.run === 'function', 'BAD_TOOL', `${tool.key}: module must export run().`);
      const publicContext={...context}; delete publicContext.__rab_trace; delete publicContext.__rab_parent_task_id; delete publicContext.__rab_reason; delete publicContext.__rab_telemetry; delete publicContext.__rab_seats; delete publicContext.__rab_seat_state;
      delete publicContext.__rab_run; delete publicContext.__rab_parent_execution_id;
      const scopedHelpers = {
        createItemSettings: async input => makeItemSettings({ ...input, id: Object.hasOwn(input, 'id') ? input.id : await run.memory.allocateId() }),
        createSignalSettings: async input => makeSignalSettings({ ...input, id: await run.memory.allocateId() }),
        renderTemplateTree,
        writeArtifactPlan,
        runProjectStamp: (extra = {}) => runProjectStamp({...extra,options:bound.options,context:publicContext,tool}),
        runReactComponentStamp: (extra = {}) => runReactComponentStamp({...extra,options:bound.options,context:publicContext,helpers:scopedHelpers}),
        resolveProjectFolder: (extra = {}) => resolveProjectFolder({...extra,context:publicContext}),
        inspectUiKitTemplate: async (...args) => {
          const { inspectUiKitTemplate } = await import('../tools/react/seed/stamp-ui-kit/stamp-ui-kit.mjs');
          return inspectUiKitTemplate(...args);
        },
        listTools: (args = {}) => listTools({...args,context:publicContext}),
        findTools: (args = {}) => findTools({...args,context:publicContext}),
        getTool: ref => getTool(ref,{context:publicContext}),
        bindSettings,
        runTool: args => runTool({...args,context:{...publicContext,...(args.context??{}),__rab_run:run,__rab_parent_execution_id:execution.execution_id,__rab_trace:trace,__rab_seat_state:seatState,__rab_parent_task_id:task.id,__rab_reason:`child-of:${tool.address??tool.key}`,__rab_telemetry:telemetryContext}}),
        runScratchTool: async args => {
          const scope=await createScratchScope({folder:args.options?.folder,rabHome:run.memory.rabHome});
          return runTool({...args,context:{...publicContext,[SCRATCH_SCOPE]:scope,__rab_run:run,__rab_parent_execution_id:execution.execution_id,__rab_trace:trace,__rab_seat_state:seatState,__rab_parent_task_id:task.id,__rab_reason:`scratch-child-of:${tool.address??tool.key}`,__rab_telemetry:telemetryContext}});
        },
        getSeat: name => Object.hasOwn(taskSeats,name)?taskSeats[name]:seatState.promoted[name],
        fillSeat: (name,value) => { insist(typeof name==='string'&&name,'BAD_REQUEST','Seat name is required.'); writeTaskSeat(name,value,{promote:true}); task.seat_delta[name]={value,source:`tool:${tool.address??tool.key}`}; return value; },
        loadProjectFacts: async () => memory ? memory.loadFacts(publicContext.project) : { version:'0.8.3-facts', facts:{} },
        getProjectFact: async key => memory ? memory.getFact(publicContext.project,key) : null,
        setProjectFact: async (key,value,source=tool.path) => {
          insist(memory, 'PROJECT_CONTEXT_REQUIRED', `${tool.key}: project context is required to persist ${key}.`);
          return memory.setFact(publicContext.project,key,value,{source});
        }
      };
      const result = await mod.run({ options:bound.options, context:publicContext, tool, root, toolsRoot:tool.toolkit?.toolsRoot??toolsRoot, helpers:scopedHelpers });
      const beforePacked={...taskSeats}; const packed=packResultSeats(taskSeats,result);
      if(rootTask)Object.assign(rootPromotions,packed);
      for(const [name,value] of Object.entries(taskSeats)) if(beforePacked[name]!==value&&!Object.hasOwn(task.seat_delta,name)) task.seat_delta[name]={value,source:`return:${tool.address??tool.key}`};
      task.status='completed';task.completed_at=new Date().toISOString();task.result=result;
      execution.status='completed';execution.result_bytes=jsonBytes(result);
      if(rootTask)Object.assign(seatState.promoted,rootPromotions);
      const afterSeats=rootTask?{...seatState.promoted}:visibleSeats();
      task.transition = makeTransition({ index:trace.indexOf(task)+1, taskId:task.id, capability:tool.address??tool.key, authority:tool.meta.authority, before:beforeShape, returned:canonicalizeShape(result), after:canonicalizeShape({seats:afterSeats}) });
      cache = null;
      output={ tool:{ address:tool.address??null,key:tool.key,id:tool.id,path:tool.path,tags:tool.tags,script:tool.script,script_owner:tool.scriptOwner,name:tool.name,title:tool.title,domain:tool.domain,kind:tool.kind,meta:tool.meta,contract:{consumes:tool.contract.consumes,returns:tool.contract.returns},authority_class:normalizeAuthority(tool.meta.authority),...provenance }, options:bound.options, result, seats:afterSeats, authority:tool.meta.authority ?? 'read', transition:task.transition, tasks:trace, execution, session_id:run.sessionId };
      if(rootTask&&memory){reportAttempted=true;const file=await memory.saveToolResult(context.project,output,{sessionId:run.sessionId,stepId:telemetryContext.step_id??null});if(file)output.result_file=file;}
      return output;
    }catch(error){
      if(error.details?.safe_to_resume&&trace.some(t=>t!==task&&t.status==='completed'&&t.authority!=='read'))error.details.safe_to_resume=false;
      failure=error;
      const code=error.code??'ERROR';
      const terminalState=['INPUT_REQUIRED','AUDIT_PATH_REQUIRED','DENIED','PLAN_GAPS'].includes(code)?'blocked':'failed';
      task.status=terminalState;task.completed_at=new Date().toISOString();task.error={code,message:error.message};
      execution.status=terminalState;execution.error={code,message:String(error.message).slice(0,2048)};
      if(rootTask&&run.auditReady&&!reportAttempted&&task.authority==='read'){
        try{await memory.saveToolResult(context.project,{tool:task.tool,options:task.options,result:null,seats:{},authority:task.authority,error:execution.error,tasks:trace,execution},{sessionId:run.sessionId,stepId:telemetryContext.step_id??null});}
        catch(saveError){error.persistence_error={code:saveError.code??'ERROR',message:saveError.message};}
      }
      throw error;
    }finally{
      execution.options=compactValue(task.options);
      execution.status=task.status;
      execution.end_date=new Date().toISOString();
      execution.duration_ms=Math.max(0,performance.now()-started);
      if(memory){
        const finished=rootTask?trace:[task];
        for(const item of finished)item.tracking_file=await memory.saveToolExecution(context.project,item.execution);
      }
      if(output)output.tracking_file=task.tracking_file??null;
      if(failure){failure.execution=execution;failure.tracking_file=task.tracking_file??null;}
      const subject=task.tool?{type:task.tool.kind,id:task.tool.id,address:task.tool.address??task.requested,path:task.tool.path}:null;
      const outcome=task.status==='completed'?'success':task.status==='blocked'?'blocked':'failure';
      if(task.tool)await emit({type:'capability-use',kind:task.tool.kind,task_id:task.id,auto:task.auto,subject,status:task.status,outcome,authority:task.authority,seat_delta:Object.fromEntries(Object.entries(task.seat_delta).map(([name,delta])=>[name,{source:delta.source}])),error:execution.error});
      await emit({type:'terminal',kind:task.tool?.kind??'tool',task_id:task.id,auto:task.auto,subject,terminal_state:task.status,status:task.status,outcome,last_stage:failure?'tool-execution':'tool-returned',reason:{code:execution.error?.code??'COMPLETED'},tracking_file:task.tracking_file??null});
      if(failure)await emit({type:'loss',kind:task.status==='blocked'?'tool-blocked':'tool-error',task_id:task.id,auto:task.auto,subject,status:task.status,outcome,error:execution.error});
    }
  };

  return Object.freeze({ scan, listTools, findTools, getTool, bindSettings, runTool, pathsRegistry });
};
