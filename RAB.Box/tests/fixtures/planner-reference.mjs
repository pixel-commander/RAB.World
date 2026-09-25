import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { containedPath, insist, own } from '../../engine/src/core.mjs';
import { loadProject, loadStamp } from '../../engine/src/project.mjs';
import { createToolHouse } from '../../bridge/tool-house.mjs';

const normalize = value => String(value ?? '').toLowerCase().replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
const words = value => normalize(value).match(/[a-z0-9_-]+/g) ?? [];
const uniq = xs => [...new Set(xs)];
const quoteValues = text => [...String(text).matchAll(/["']([^"']+)["']/g)].map(m => ({ value: m[1], index: m.index ?? 0 }));
const fieldValue = (text, names) => {
  const alt = names.map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const quoted = new RegExp(`(?:${alt})\\s*["']([^"']+)["']`, 'i').exec(text);
  if (quoted) return quoted[1].trim();
  const bare = new RegExp(`(?:${alt})\\s+([^,.;]+?)(?=\\s+(?:and|then)\\b|[.;]|$)`, 'i').exec(text);
  return bare?.[1]?.trim() ?? null;
};
const extractPath = text => {
  const quoted = [...String(text).matchAll(/["']([^"']+)["']/g)].map(m => m[1]).find(v => /^(?:[a-z]:[\\/]|\/|\\\\)/i.test(v));
  if (quoted) return quoted;
  const win = /\b([a-z]:[\\/][^,;\n]+?)(?=\s+(?:and|then|for|to)\b|[.;]|$)/i.exec(text);
  if (win) return win[1].trim();
  const posix = /(?:^|\s)(\/(?:[^\s,;]+\/?)+)(?=\s|[.;]|$)/.exec(text);
  return posix?.[1]?.trim() ?? null;
};
const basenameAny = value => String(value ?? '').replace(/[\\/]+$/,'').split(/[\\/]/).pop() || null;

const detectDomain = (text, context = {}) => {
  const t = normalize(text);
  if (/\b(audit|auditing|scan (?:the )?(?:repo|project|codebase)|inspect (?:the )?(?:repo|project|codebase))\b/.test(t)) return { value:'audit', source:'request' };
  if (/\b(react project|react app|component|atom|div|page|build|create|make|add|start)\b/.test(t)) return { value: context.domain === 'audit' && !/\b(react project|react app)\b/.test(t) ? 'audit' : 'build', source: context.domain === 'audit' ? 'context' : 'request' };
  if (context.domain) return { value:context.domain, source:'context' };
  return { value:null, source:null };
};

const detectOperation = (text, domain) => {
  const t = normalize(text);
  if (/\b(do not|don't|dont|never)\b/.test(t)) return 'negated';
  if (domain === 'audit' && /\b(find|show|get|report|list|scan|count|audit|inspect|check|measure)\b/.test(t)) return 'measure';
  if (/\b(rename|re-name)\b/.test(t)) return 'rename';
  if (/\b(replace|swap)\b/.test(t)) return 'replace';
  if (/\b(delete|destroy)\b/.test(t)) return 'delete';
  if (/\b(remove|detach|take off)\b/.test(t)) return 'detach';
  if (/\b(wrap|wrapped|apply|use|using|attach)\b/.test(t)) return 'attach';
  if (/\b(create|make|add|start|build|new|give)\b/.test(t)) return 'create';
  return domain === 'audit' ? 'measure' : 'unknown';
};
const detectTarget = (text, domain) => {
  const t = normalize(text);
  if (domain === 'audit') {
    if (/\b(use ?state|state hooks?)\b/.test(t)) return { type:'tool-result', subtype:'state-hooks' };
    if (/\b(use ?effect|effect hooks?)\b/.test(t)) return { type:'tool-result', subtype:'use-effects' };
    if (/\borphan(?:ed)?\b/.test(t)) return { type:'tool-result', subtype:'orphans' };
    if (/\bimports?\b/.test(t)) return { type:'tool-result', subtype:'imports' };
    if (/\bexports?\b/.test(t)) return { type:'tool-result', subtype:'exports' };
    if (/\bcomments?\b/.test(t)) return { type:'tool-result', subtype:'comments' };
    if (/\bcomponents?\b/.test(t)) return { type:'tool-result', subtype:'components' };
    if (/\bfile ?types?\b/.test(t)) return { type:'tool-result', subtype:'filetypes' };
    if (/\bsvg\b/.test(t)) return { type:'tool-result', subtype:'svg' };
    if (/\bpaths?\b/.test(t)) return { type:'tool-result', subtype:'paths' };
    if (/\bneurons?\b/.test(t)) return { type:'tool-result', subtype:'neurons' };
    return { type:'audit', subtype:null };
  }
  if (/\b(react project|react app|project)\b/.test(t)) return { type:'project', subtype:/react/.test(t) ? 'react' : null };
  if (/\b(home ?page|page|screen|view)\b/.test(t)) return { type:'page', subtype:/home ?page/.test(t) ? 'home' : null };
  if (/\b(component)\b/.test(t)) return { type:'component', subtype:null };
  if (/\b(atom)\b/.test(t) || /\bcontainer-[a-z0-9_-]+\b/.test(t)) return { type:'atom', subtype:/\bcontainer\b|container-/.test(t) ? 'container' : null };
  if (/\b(div|element)\b/.test(t)) return { type:'div', subtype:null };
  return { type:'unknown', subtype:null };
};

const parseSemantics = (text, operation, target) => {
  const t = normalize(text);
  const quotes = quoteValues(text);
  const values = {};
  const explicitName = fieldValue(text, ['named','called','name']);
  if (explicitName) values.name = explicitName.replace(/^["']|["']$/g,'');
  const destination = fieldValue(text, ['save it to','save to','into','under','at','location']);
  if (destination) values.location = destination.replace(/^["']|["']$/g,'');
  const said = /\b(?:says?|text|content)\s*["']([^"']+)["']/i.exec(text);
  if (said) values.content = said[1];
  let resource = null;
  const knownClass = /\b(container-[a-z0-9_-]+)\b/i.exec(text);
  if (knownClass) resource = { type:'atom', name:knownClass[1] };
  else if (operation === 'attach' && quotes.length) resource = { type:/\batom\b/.test(t) ? 'atom' : 'resource', name:quotes.at(-1).value };
  const relation = /\bwrap(?:ped|s|ping)?\b/.test(t) ? 'wrap' : /\battach(?:ed|es|ing)?\b/.test(t) ? 'attach' : /\bapply|using|\buse\b/.test(t) ? 'apply' : null;
  if (target.type === 'page' && target.subtype === 'home') values.pageName = 'HomePage';
  return { values, resource, relation };
};

const splitClauses = text => {
  const raw = String(text).trim();
  const pieces = raw.split(/(?<=[.!?])\s+|\s+then\s+|\s+and\s+(?=(?:make|create|add|start|build|give|wrap|apply|use|remove|delete|replace|rename|find|show|get|report|list|scan|count|audit|inspect|check)\b)/i).map(x=>x.trim()).filter(Boolean);
  return pieces.length ? pieces : [raw];
};
const conceptsFor = frame => uniq([frame.target.type, frame.target.subtype, frame.operation, ...words(frame.text).filter(w => w.length > 2 && !['the','and','with','then','new','named','called','into','from','that','this','will','have','give'].includes(w))].filter(Boolean));
const scoreCatalog = (entry, concepts) => {
  const name = normalize(entry.name), desc = normalize(entry.description), hay = `${name} ${desc}`;
  let score = 0; const hits = [];
  for (const c of concepts) {
    if (!c || c.length < 2) continue;
    if (name === c) { score += 8; hits.push(c); continue; }
    if (name.includes(c)) { score += 5; hits.push(c); continue; }
    if (hay.includes(c)) { score += 2; hits.push(c); }
  }
  return { score, hits:uniq(hits) };
};
const stampTarget = (name, entry) => {
  const names = (entry.language?.names ?? []).join(' ').toLowerCase();
  if (/react project|react app/.test(names) || /react-project/.test(name)) return 'project';
  if (/component/.test(names) || /component/.test(name)) return 'component';
  if (/\bdiv\b/.test(names) || /div/.test(name)) return 'div';
  if (/\batom\b/.test(names) || /atom/.test(name)) return 'atom';
  if (/page|screen|view/.test(names) || /page/.test(name)) return 'page';
  return 'unknown';
};
const operationCompatible = operation => !['negated','unknown','detach','delete','replace','rename','attach'].includes(operation);
const bindFromText = (frame, key) => {
  const text = frame.text;
  if (key === 'name') {
    const explicit = fieldValue(text,['named','called','name']);
    if (explicit) return { value:explicit.replace(/^["']|["']$/g,''), source:'request:explicit-name' };
    if (frame.target.type === 'page' && frame.target.subtype === 'home') return { value:'HomePage', source:'parser:home-page' };
    const qs = quoteValues(text);
    if (frame.target.type === 'project' && qs.length) return { value:qs[0].value, source:'request:near-target-quoted-value' };
  }
  if (key === 'location') {
    const v = fieldValue(text,['save it to','save to','into','under','at','location']);
    if (v) return { value:v.replace(/^["']|["']$/g,''), source:'request:destination' };
  }
  return null;
};
const optionRecord = ({ key, spec, binding, stampName, writeRoot }) => {
  if (binding) return { value:binding.value, status:'resolved', required:!!spec.required, source:binding.source };
  if (own(spec,'default')) return { value:spec.default, status:'resolved', required:!!spec.required, source:'contract:default' };
  if (Array.isArray(spec.enum) && spec.enum.length === 1) return { value:spec.enum[0], status:'derived', required:!!spec.required, source:'contract:single-enum' };
  if (key === 'location' && writeRoot) return { value:writeRoot, status:'derived', required:!!spec.required, source:`PATHS.json.stamps.${stampName}.write_roots[0]` };
  return { value:null, status:spec.required ? 'unknown' : 'unbound', required:!!spec.required, source:null };
};

const resolveAuditTask = async ({ frame, toolHouse, bag, taskId }) => {
  const found = await toolHouse.findTools({ query:frame.text, includeStamps:false });
  const packed = await toolHouse.pathsRegistry.pack({});
  const entries = [...Object.entries(packed.tools), ...Object.entries(packed.stamps)];
  const ranked = found.items
    .filter(tool => String(tool.meta?.authority ?? 'read').toLowerCase() === 'read')
    .map(tool => ({ tool, address:entries.find(([,entry])=>String(entry.id)===String(tool.id)&&entry.path===tool.path)?.[0] ?? tool.key, score:tool.score, pathScore:tool.path_score }));
  const top = ranked[0], next = ranked[1];
  const genericOrphan = /\borphan(?:ed)?\b/i.test(frame.text) && top?.tool?.path === 'audit/find-files';
  const proven = top && !genericOrphan && top.score >= 20 && (!next || top.score >= next.score + 4 || top.pathScore >= 24);
  if (!proven) return {
    task:{ id:taskId, frameId:frame.id, type:'unresolved', domain:'audit', operation:'measure', target:frame.target, sourceText:frame.text, parsed:{values:frame.values,resource:frame.resource,relation:frame.relation}, candidates:{ tools:ranked.slice(0,6).map(x=>({address:x.address,path:x.tool.path,title:x.tool.title,score:x.score})) }, options:{}, unknowns:[] },
    gap:{ frameId:frame.id, type:'capability', operation:'measure', target:frame.target, text:frame.text, reason:'no-proven-audit-tool', suggestions:ranked.slice(0,6).map(x=>({name:x.address,score:x.score,description:x.tool.description,path:x.tool.path})) }
  };
  const tool=top.tool, options={}, unknowns=[];
  for (const field of tool.settings ?? []) {
    let value;
    if (field.name === 'folder' && bag.projectRoot) value = bag.projectRoot;
    else if (Object.hasOwn(field,'default')) value = field.default;
    if (value !== undefined) options[field.name] = { value, status:'resolved', required:!!field.required, source:field.name==='folder'?'bag.projectRoot':'contract:default' };
    else {
      options[field.name] = { value:null, status:field.required?'unknown':'unbound', required:!!field.required, source:null };
      if (field.required) unknowns.push({taskId,frameId:frame.id,field:field.name,reason:'required tool input',question:field.description ? `Provide ${field.name}: ${field.description}` : `What is ${field.name}?`});
    }
  }
  return { task:{ id:taskId,frameId:frame.id,type:'tool',domain:'audit',tool:{id:tool.id,address:top.address,path:tool.path,title:tool.title},operation:'measure',target:frame.target,sourceText:frame.text,parsed:{values:frame.values,resource:frame.resource,relation:frame.relation},dependsOn:[],options,unknowns,candidates:{tools:ranked.slice(0,6).map(x=>({address:x.address,path:x.tool.path,title:x.tool.title,score:x.score}))}}, gap:null };
};

export const createPlanner = ({ root }) => {
  const toolHouse = createToolHouse({ root });
  const load = async () => {
    const host = JSON.parse(await readFile(await containedPath(root,'HOST.json'),'utf8'));
    const projectRoot = await containedPath(root,'tests/fixtures/stamp-contracts');
    const project = await loadProject(projectRoot);
    let external=[];
    if (host.candidate_catalog) {
      const file=await containedPath(root,host.candidate_catalog); const data=JSON.parse(await readFile(file,'utf8')); external=Array.isArray(data.stamps)?data.stamps:[];
    }
    let domains={domains:{}};
    try { domains=JSON.parse(await readFile(await containedPath(root,'domains.json'),'utf8')); } catch {}
    return {host,project,projectRoot,external,domains};
  };

  const plan = async ({ text, context = {} }) => {
    insist(typeof text === 'string' && text.trim() && text.length <= 16000,'BAD_REQUEST','Supply request text, up to 16,000 characters.');
    const {project,projectRoot,external,domains}=await load();
    const domain=detectDomain(text,context);
    const requestPath=extractPath(text);
    const bag={
      domain:domain.value,
      domainSource:domain.source,
      projectRoot:requestPath ?? context.projectRoot ?? null,
      projectRootSource:requestPath ? 'request:path' : context.projectRoot ? 'context:projectRoot' : null,
      projectName:context.projectName ?? (requestPath ? basenameAny(requestPath) : null),
      currentTarget:context.currentTarget ?? null,
      paths:context.paths ?? {}
    };
    const gaps={ semantic:[], configuration:[], requiredInputs:[], capabilities:[] };
    if (!bag.domain) gaps.semantic.push({type:'domain',message:'Magic Box cannot resolve the work domain yet.',question:'What kind of work is this? Known domains: audit or build.',choices:Object.keys(domains.domains ?? {})});
    if (bag.domain === 'audit' && !bag.projectRoot) gaps.configuration.push({type:'project-root',field:'projectRoot',message:'Audit mode is resolved, but no project/root folder is selected.',question:'What folder should I audit?'});

    const clauses=splitClauses(text);
    const frames=clauses.map((clause,i)=>{const op=detectOperation(clause,bag.domain),target=detectTarget(clause,bag.domain);return{id:`frame-${i+1}`,text:clause,operation:op,target,...parseSemantics(clause,op,target)};});
    const tasks=[];
    for (const frame of frames) {
      if (frame.operation === 'negated') { gaps.semantic.push({frameId:frame.id,type:'negation',text:frame.text,message:'Negated requests are not executable until an explicit supported operation is resolved.'}); continue; }
      if (bag.domain === 'audit') {
        // A clause that only establishes audit mode/path is context, not a Tool invocation.
        const setupOnly = frame.target.type === 'audit' && !/\b(find|show|get|report|list|count|check)\b/i.test(frame.text);
        if (setupOnly) continue;
        const taskId=`task-${tasks.length+1}`;
        const resolved=await resolveAuditTask({frame,toolHouse,bag,taskId});
        tasks.push(resolved.task);
        if (resolved.gap) gaps.capabilities.push(resolved.gap);
        else gaps.requiredInputs.push(...resolved.task.unknowns);
        continue;
      }
      if (frame.operation === 'unknown' || frame.target.type === 'unknown') { gaps.semantic.push({frameId:frame.id,type:'unresolved-clause',text:frame.text,message:'Magic Box could not resolve both an operation and a target.'}); continue; }
      if (frame.target.type === 'project' && !frame.target.subtype) { gaps.semantic.push({frameId:frame.id,type:'project-kind',text:frame.text,message:'Project creation is clear, but the project kind is unresolved.',question:'What kind of project? Registered runtime support currently includes React project.',choices:['react']}); continue; }
      const legacyPlannerStamps=new Set(['react-project','atom-stamp','div-stamp','component-stamp']);
      const runtimeCandidates=Object.entries(project.manifest.stamps).filter(([name,entry])=>legacyPlannerStamps.has(name)&&stampTarget(name,entry)===frame.target.type).map(([name,entry])=>({source:'project',name,operationCompatible:operationCompatible(frame.operation),names:entry.language.names}));
      const usable=runtimeCandidates.filter(x=>x.operationCompatible);
      const concepts=conceptsFor(frame);
      const suggestions=external.map(entry=>({entry,...scoreCatalog(entry,concepts)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.entry.name.localeCompare(b.entry.name)).slice(0,5).map(x=>({name:x.entry.name,description:x.entry.description,score:x.score,matched:x.hits,indexed:x.entry.indexed===true}));
      if (usable.length !== 1) { const taskId=`task-${tasks.length+1}`; gaps.capabilities.push({frameId:frame.id,operation:frame.operation,target:frame.target,text:frame.text,reason:usable.length?'multiple-runtime-capabilities':'no-proven-runtime-capability',runtimeCandidates,suggestions}); tasks.push({id:taskId,frameId:frame.id,type:'unresolved',domain:'build',operation:frame.operation,target:frame.target,sourceText:frame.text,parsed:{values:frame.values,resource:frame.resource,relation:frame.relation},candidates:{runtime:runtimeCandidates,suggestions},options:{},unknowns:[]}); continue; }
      const stampName=usable[0].name, stamp=await loadStamp(project,stampName), options={}, unknowns=[], taskId=`task-${tasks.length+1}`;
      for (const [key,spec] of Object.entries(stamp.settings.options)) {
        let binding=bindFromText(frame,key);
        if (!binding && key==='location' && bag.projectRoot) binding={value:bag.projectRoot,source:bag.projectRootSource ?? 'bag.projectRoot'};
        const rec=optionRecord({key,spec,binding,stampName,writeRoot:stamp.entry.write_roots?.[0]}); options[key]=rec;
        if (rec.status==='unknown') {const gap={taskId,frameId:frame.id,field:key,reason:'required stamp input',question:spec.question??`What is ${key}?`};unknowns.push(gap);gaps.requiredInputs.push(gap);}
      }
      tasks.push({id:taskId,frameId:frame.id,type:'stamp',domain:'build',stamp:{id:String(stamp.settings.id),name:stampName,title:stamp.settings.title},operation:frame.operation,target:frame.target,sourceText:frame.text,parsed:{values:frame.values,resource:frame.resource,relation:frame.relation},dependsOn:[],options,unknowns,candidates:{runtime:runtimeCandidates,suggestions}});
    }
    const projectTask=tasks.find(t=>t.type==='stamp'&&t.target.type==='project'&&t.operation==='create');
    if (projectTask) for (const task of tasks) if (task.id!==projectTask.id&&['page','component','atom','div'].includes(task.target?.type)) task.dependsOn=uniq([...(task.dependsOn??[]),projectTask.id]);
    const semanticCount=gaps.semantic.length+gaps.capabilities.length+gaps.configuration.length;
    const accounted=tasks.length + gaps.semantic.filter(g=>g.frameId).length;
    return {
      version:'0.5-plan',request:text,domain:bag.domain,bag,
      context:{projectRoot:bag.projectRoot ?? projectRoot,projectId:project.id,domain:bag.domain,projectName:bag.projectName,paths:bag.paths},
      frames,tasks,gaps,
      coverage:{clauses:clauses.length,accountedFor:accounted,complete:semanticCount===0 && (tasks.length>0 || bag.domain==='audit')},
      readyForInputCollection:semanticCount===0,
      readyToExecute:semanticCount===0&&gaps.requiredInputs.length===0&&tasks.length>0&&tasks.every(t=>['stamp','tool'].includes(t.type)),
      authority:0,
      note:'Planning output only. Domain and Bag context may persist in the browser. No Tool or Stamp executed and no execution authority granted.'
    };
  };
  return Object.freeze({plan});
};
