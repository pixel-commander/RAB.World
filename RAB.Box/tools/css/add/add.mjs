import path from 'node:path';
import { stat, readFile, writeFile, readdir } from 'node:fs/promises';
import { normalizeStates, STATE_SUFFIXES } from '../_states.mjs';
import { readCssRules, splitCssList, parseDeclarations } from '../_stylesheet.mjs';

const slash=value=>String(value).replaceAll('\\','/');
const esc=value=>String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const isDir=async target=>{try{return(await stat(target)).isDirectory();}catch{return false;}};
const isFile=async target=>{try{return(await stat(target)).isFile();}catch{return false;}};
const walkCss=async root=>{const out=[],stack=[root];while(stack.length){const dir=stack.pop();let entries=[];try{entries=await readdir(dir,{withFileTypes:true});}catch{continue;}for(const entry of entries){if(['node_modules','.git','.rab','dist','build','.next'].includes(entry.name))continue;const full=path.join(dir,entry.name);if(entry.isDirectory())stack.push(full);else if(entry.isFile()&&/\.css$/i.test(entry.name))out.push(full);}}return out;};
const normalizeClass=value=>{const raw=String(value??'').trim();if(!raw)throw Object.assign(new Error('class_name is required.'),{code:'INPUT_REQUIRED'});return raw.startsWith('.')?raw:`.${raw}`;};
const parseBlock=body=>{const ordered=[],map=new Map();for(const piece of splitCssList(body,';')){const line=piece.replace(/\/\*[\s\S]*?\*\//g,'').trim();if(!line)continue;const idx=line.indexOf(':');if(idx<1)continue;const property=line.slice(0,idx).trim(),value=line.slice(idx+1).trim();if(!map.has(property))ordered.push(property);map.set(property,value);}return{ordered,map};};
const formatBlock=({ordered,map})=>ordered.map(property=>`  ${property}: ${map.get(property)};`).join('\n');
export const mergeSelector=(source,selector,declarations)=>{
  const targets=splitCssList(selector), wanted=new Set(targets);
  // Base edits never hoist responsive or nested declarations into the root scope.
  const matches=readCssRules(source).filter(rule=>!rule.scope&&rule.selectors.some(item=>wanted.has(item)));
  const parsed={ordered:[],map:new Map()};
  const merge=pairs=>{for(const [property,value] of pairs){if(!parsed.map.has(property))parsed.ordered.push(property);parsed.map.set(property,value);}};
  for(const rule of matches)merge(parseBlock(rule.body).map);
  const previous=new Map(parsed.map);merge(declarations);
  if(matches.length===1&&matches[0].selectors.length===wanted.size&&matches[0].selectors.every(item=>wanted.has(item))&&[...parsed.map].every(([key,value])=>previous.get(key)===value))return{source,changed:false,created:false};
  const block=`${targets.join(',\n')} {\n${formatBlock(parsed)}\n}`;
  if(!matches.length){const prefix=source.trimEnd();return{source:`${prefix}${prefix?'\n\n':''}${block}\n`,changed:true,created:true};}
  let result=source;
  for(const rule of [...matches].reverse()){
    const remaining=rule.selectors.filter(item=>!wanted.has(item));
    const retained=remaining.length?`${remaining.join(',\n')} {${rule.body}}`:'';
    const replacement=rule===matches.at(-1)?`${retained}${retained?'\n\n':''}${block}`:retained;
    result=result.slice(0,rule.start)+replacement+result.slice(rule.end);
  }
  return{source:result,changed:result!==source,created:false};
};
const resolveAtomFile=async(root,atomName)=>{
  if(!root)throw Object.assign(new Error('Loaded project root is required when targeting an Atom by name.'),{code:'PROJECT_CONTEXT_REQUIRED'});
  const css=await walkCss(root), selector=`.${atomName}`, exactDir=`/atoms/${atomName}/`;
  const ranked=[];for(const file of css){const normalized=`/${slash(path.relative(root,file))}`;const text=await readFile(file,'utf8');let rank=0;if(normalized.includes(exactDir))rank+=4;if(path.basename(file,'.css')===atomName)rank+=3;if(new RegExp(`(^|[},\\s])${esc(selector)}(?=[\\s:{,.#>+~]|$)`,'m').test(text))rank+=2;if(rank)ranked.push({file,rank});}
  ranked.sort((a,b)=>b.rank-a.rank||a.file.localeCompare(b.file));if(!ranked.length)throw Object.assign(new Error(`Atom not found: ${atomName}`),{code:'TARGET_NOT_FOUND'});if(ranked.length>1&&ranked[0].rank===ranked[1].rank)throw Object.assign(new Error(`Atom target is ambiguous: ${atomName}`),{code:'AMBIGUOUS_TARGET',candidates:ranked.filter(x=>x.rank===ranked[0].rank).map(x=>slash(x.file))});return ranked[0].file;
};
const resolveClassFile=async(location,className,projectRoot)=>{
  const raw=String(location??'').trim();if(!raw)throw Object.assign(new Error('location is required.'),{code:'INPUT_REQUIRED'});const target=path.resolve(projectRoot??process.cwd(),raw);
  if(await isFile(target)){if(!/\.css$/i.test(target))throw Object.assign(new Error('location must be a CSS file or a folder containing the class.'),{code:'BAD_REQUEST'});return target;}
  if(!(await isDir(target)))throw Object.assign(new Error(`CSS location not found: ${raw}`),{code:'TARGET_NOT_FOUND'});
  const files=await walkCss(target),selector=normalizeClass(className),matches=[];for(const file of files){const text=await readFile(file,'utf8');if(new RegExp(`${esc(selector)}(?=[\\s:{,.#>+~]|$)`,'m').test(text))matches.push(file);}if(matches.length===1)return matches[0];if(!matches.length)throw Object.assign(new Error(`Class ${selector} was not found under ${raw}. Provide the CSS file location.`),{code:'TARGET_NOT_FOUND'});throw Object.assign(new Error(`Class ${selector} exists in more than one stylesheet under ${raw}. Provide the exact CSS file.`),{code:'AMBIGUOUS_TARGET',candidates:matches.map(slash)});
};

export const run=async({options,context,tool})=>{
  const parts=tool.key.split('/'), targetKind=parts.at(-1), stateMode=parts.includes('state');
  const projectRoot=context?.project?.root?path.resolve(context.project.root):null;
  const declarations=parseDeclarations(options.styles);
  const states=stateMode?normalizeStates(options.state):[];
  const state=states.length?states.join(', '):null;
  let file,selector;
  if(targetKind==='atom'){const atom=String(options.atom_name??'').trim().replace(/^\./,'');if(!atom)throw Object.assign(new Error('atom_name is required.'),{code:'INPUT_REQUIRED'});file=await resolveAtomFile(projectRoot,atom);selector=`.${atom}`;}
  else if(targetKind==='class'){selector=normalizeClass(options.class_name);file=await resolveClassFile(options.location,selector,projectRoot);}
  else throw Object.assign(new Error(`Unsupported CSS target kind: ${targetKind}`),{code:'BAD_TOOL'});
  if(state){
    if(!/^\.[A-Za-z_][A-Za-z0-9_-]*$/.test(selector))throw Object.assign(new Error('State updates require one CSS class name.'),{code:'BAD_REQUEST'});
    selector=states.map(name=>`${selector}${STATE_SUFFIXES[name]}`).join(',\n');
  }
  const before=await readFile(file,'utf8'), merged=mergeSelector(before,selector,declarations);if(merged.changed)await writeFile(file,merged.source,'utf8');
  return{status:merged.changed?'updated':'unchanged',action:state?'add-state-style':'add-style',target_type:targetKind,selector,state,states,file:slash(file),created_selector:merged.created,changed:merged.changed,properties:declarations.map(([property])=>property),provided:{seats:{css_path:file,class_name:selector}}};
};
