import path from 'node:path';
import { access, readdir } from 'node:fs/promises';
import { scanFiles, read, rel, lineOf, compactSnippet, maskComments, maskCommentsAndStrings, allMatches } from '../_scan-helpers.mjs';
import { hasStateSelector } from '../../css/_states.mjs';
import { readCssRules, splitCssList } from '../../css/_stylesheet.mjs';
import { SCRATCH_SCOPE } from '../../../bridge/tool-scratch.mjs';

const CODE_RE=/\.(?:[cm]?[jt]sx?)$/i;
const JSX_RE=/\.(?:jsx|tsx)$/i;
const CSS_RE=/\.css$/i;
const VISUAL_PROPS=new Set([
  'color','background','background-color','border','border-color','border-width','border-radius',
  'box-shadow','text-shadow','font-family','font-size','font-weight','opacity','outline','outline-color',
  'fill','stroke','stroke-width','text-decoration-color','caret-color'
]);
const COLLECTION_METHODS='map|filter|find|findIndex|some|every|reduce|forEach|flatMap|sort|slice';
const REQUIRED_HOUSE_KEYS=['id','name','title','description','settings','meta'];

const exists=async file=>{try{await access(file);return true;}catch{return false;}};
const sourceScope=(root,file)=>{const name=rel(root,file);if(/(?:^|\/)(?:verification)(?:\/|$)/i.test(name))return'verification';if(/(?:^|\/)(?:tests?|__tests__|fixtures?|mocks?)(?:\/|$)/i.test(name))return'test';return'runtime';};
const row=({root,file,source,index=0,rule,kind='code-review-violation',...extra})=>({file:rel(root,file),line:lineOf(source,index),kind,rule,text:compactSnippet(source,index),source_scope:sourceScope(root,file),...extra});
const componentFile=file=>JSX_RE.test(file)&&!/(?:^|\/)(?:hooks|elements|demo|grid|css|js|template)(?:\/|$)/i.test(file)&&!/\.(?:test|spec|stories|types)\.[jt]sx?$/i.test(file)&&!/^index\.[jt]sx?$/i.test(path.basename(file));
const componentName=file=>path.basename(file).replace(/\.(?:jsx|tsx)$/i,'');
const safeIdent=value=>String(value??'').match(/^[A-Za-z_$][\w$]*$/)?.[0]??null;

const stateOwnership=async({root,file,source})=>{
  if(!componentFile(file))return[];
  const masked=maskCommentsAndStrings(source);
  const hooks=allMatches(/\b(?:React\s*\.\s*)?useState\s*(?:<[^>\n]+>)?\s*\(/g,masked);
  if(hooks.length<=1)return[];
  const name=componentName(file), expected=path.join(path.dirname(file),'hooks',`use${name}.ts`);
  return[row({root,file,source,index:hooks[1]?.index??hooks[0].index,rule:'owner-hook-required',state_hooks:hooks.length,expected:rel(root,expected),hook_exists:await exists(expected),message:`${name} owns ${hooks.length} state hooks; move mutable ownership to hooks/use${name}.ts.`})];
};

const conventions=async({root,file,source})=>{
  if(!componentFile(file))return[];
  const rows=[], dir=path.dirname(file), name=componentName(file), folder=path.basename(dir);
  if(name!==folder) rows.push(row({root,file,source,rule:'component-file-name',expected:`${folder}.tsx`,found:path.basename(file),message:'Main component filename must match its component folder.'}));
  let entries=[];try{entries=await readdir(dir,{withFileTypes:true});}catch{return rows;}
  const expectedTypes=`${folder}.types.ts`;
  for(const entry of entries){
    if(!entry.isFile())continue;
    const full=path.join(dir,entry.name);
    if(/\.css$/i.test(entry.name)) rows.push(row({root,file:full,source:await read(full),rule:'css-location',expected:`${folder}/css/`,message:'Component CSS belongs in the component css/ folder.'}));
    if(/^use[A-Z].*\.[jt]sx?$/i.test(entry.name)) rows.push(row({root,file:full,source:await read(full),rule:'hook-location',expected:`${folder}/hooks/`,message:'Component hooks belong in the component hooks/ folder.'}));
    if(/\.types\.[jt]sx?$/i.test(entry.name)&&entry.name!==expectedTypes) rows.push(row({root,file:full,source:await read(full),rule:'types-file-name',expected:expectedTypes,found:entry.name,message:'Component types file must follow ComponentName.types.ts.'}));
    if(/(?:demo|stories?)\.[jt]sx?$/i.test(entry.name)) rows.push(row({root,file:full,source:await read(full),rule:'demo-location',expected:`${folder}/demo/`,message:'Component demos/stories belong in demo/.'}));
  }
  return rows;
};

const loopItemNames=({root,file,source})=>{
  if(!CODE_RE.test(file))return[];
  const masked=maskCommentsAndStrings(source),rows=[];
  const mapCall=/\b([A-Za-z_$][\w$]*)\s*(?:\?\.|\.)\s*map\s*\(\s*(?:async\s+)?(?:\(\s*([A-Za-z_$][\w$]*)\s*(?:,\s*[A-Za-z_$][\w$]*)?\s*\)|([A-Za-z_$][\w$]*))\s*=>/g;
  for(const match of allMatches(mapCall,masked)){
    const collection=match[1],item=match[2]??match[3];
    if(collection.endsWith('s')&&`${item}s`===collection)continue;
    rows.push(row({root,file,source,index:match.index,rule:'plural-loop-item-name',collection,item,
      expected:collection.endsWith('s')?collection.slice(0,-1):null,
      message:collection.endsWith('s')?`Use ${collection.slice(0,-1)} as the mapped item name for ${collection}.`:`Mapped collection ${collection} must end in s.`}));
  }
  return rows;
};

const propRenames=({root,file,source})=>{
  if(!CODE_RE.test(file))return[];
  const masked=maskCommentsAndStrings(source), rows=[];
  for(const match of allMatches(/\b(?:(?:const|let|var)\s+)?([A-Za-z_$][\w$]*)\s*=\s*props\s*(?:\?\.|\.)\s*([A-Za-z_$][\w$]*)\b(?=\s*(?:[;,)}\r\n]|\?\?|\|\||$))/g,masked)){
    if(match[1]===match[2])continue;
    rows.push(row({root,file,source,index:match.index,rule:'prop-rename',prop:match[2],alias:match[1],expected:`Use ${match[2]} directly; do not rename props.${match[2]}.`}));
  }
  for(const match of allMatches(/\b(?:const|let|var)\s*\{([^}]+)\}\s*=\s*props\b/g,masked)){
    for(const part of match[1].split(',')){
      const alias=part.trim().match(/^([A-Za-z_$][\w$]*)\s*:\s*([A-Za-z_$][\w$]*)(?:\s*=|\s*$)/);
      if(alias&&alias[1]!==alias[2]) rows.push(row({root,file,source,index:match.index,rule:'prop-rename',prop:alias[1],alias:alias[2],expected:`Destructure as { ${alias[1]} }; prop aliases are not allowed.`}));
    }
  }
  for(const match of allMatches(/\(\s*\{([^{}]+)\}\s*(?::[^)]*)?\)\s*=>/g,masked)){
    for(const part of match[1].split(',')){
      const alias=part.trim().match(/^([A-Za-z_$][\w$]*)\s*:\s*([A-Za-z_$][\w$]*)(?:\s*=|\s*$)/);
      if(alias&&alias[1]!==alias[2])rows.push(row({root,file,source,index:match.index,rule:'prop-rename',prop:alias[1],alias:alias[2],expected:`Destructure as { ${alias[1]} }; parameter aliases are not allowed.`}));
    }
  }
  return rows;
};

const bagGuards=({root,file,source})=>{
  if(!CODE_RE.test(file))return[];
  const masked=maskCommentsAndStrings(source), rows=[];
  for(const match of allMatches(/\b(bag|bags)\s*\.\s*([A-Za-z_$][\w$]*)/g,masked)) rows.push(row({root,file,source,index:match.index,rule:'bag-optional-guard',expression:match[0],expected:`${match[1]}?.${match[2]}`}));
  for(const match of allMatches(/\b([A-Za-z_$][\w$]*)\s*\.\s*(bag|bags)\s*\.\s*([A-Za-z_$][\w$]*)/g,masked)) rows.push(row({root,file,source,index:match.index,rule:'bag-optional-guard',expression:match[0],expected:`${match[1]}?.${match[2]}?.${match[3]}`}));

  const mapRe=new RegExp(`\\b([A-Za-z_$][\\w$]*(?:\\?\\.[A-Za-z_$][\\w$]*)*)\\s*(\\?\\.|\\.)map\\s*\\(\\s*\\(?\\s*([A-Za-z_$][\\w$]*)\\s*\\)?\\s*=>\\s*([^;\\n]+?)\\s*\\)`, 'g');
  for(const match of allMatches(mapRe,masked)){
    const receiver=match[1], op=match[2], param=match[3], body=match[4].trim();
    if(op!== '?.') rows.push(row({root,file,source,index:match.index,rule:'collection-optional-guard',expression:`${receiver}.map(...)`,expected:`${receiver}?.map(...)`}));
    const direct=new RegExp(`^\\(?\\s*${param}\\s*(\\?\\.|\\.)\\s*([A-Za-z_$][\\w$]*)(?:\\s*(?:\\?\\.|\\.)\\s*[A-Za-z_$][\\w$]*)*\\s*(?:(\\?\\?|\\|\\|)[\\s\\S]+)?\\)?$`).exec(body);
    if(direct){
      if(direct[1]!== '?.') rows.push(row({root,file,source,index:match.index,rule:'mapped-item-optional-guard',expression:body,expected:`${param}?.${direct[2]} ...`}));
      if(!direct[3]) rows.push(row({root,file,source,index:match.index,rule:'mapped-value-fallback',expression:body,expected:`${param}?.${direct[2]} ?? <fallback>`,message:'Mapped optional leaf values require an explicit fallback.'}));
    }
  }
  for(const match of allMatches(/\bObject\s*\.\s*(entries|keys|values)\s*\(\s*([^\)]+?)\s*\)/g,masked)){
    const arg=match[2].trim();
    if(!/(?:\?\?|\|\|)/.test(arg)) rows.push(row({root,file,source,index:match.index,rule:'object-collection-fallback',expression:match[0],expected:`Object.${match[1]}(${arg} ?? {})`}));
  }
  return rows;
};

const houseKeys=async({root,file,source})=>{
  if(path.basename(file)!=='settings.json'||!/(?:^|\/)tools\//.test(rel(root,file))||/(?:^|\/)template(?:\/|$)/i.test(rel(root,file)))return[];
  let data;try{data=JSON.parse(source);}catch{return[row({root,file,source,rule:'house-key-json',message:'Tool settings.json must be valid JSON.'})];}
  const rows=[];
  for(const key of REQUIRED_HOUSE_KEYS) if(!Object.prototype.hasOwnProperty.call(data,key)) rows.push(row({root,file,source,rule:'house-key-missing',house_key:key,expected:REQUIRED_HOUSE_KEYS,message:`Missing required Tool House key: ${key}.`}));
  const leaf=path.basename(path.dirname(file));
  if(typeof data.name==='string'&&data.name!==leaf) rows.push(row({root,file,source,rule:'house-key-name',house_key:'name',found:data.name,expected:leaf,message:'Tool name must match its leaf folder.'}));
  if(Object.prototype.hasOwnProperty.call(data,'settings')&&!Array.isArray(data.settings)) rows.push(row({root,file,source,rule:'house-key-settings-shape',house_key:'settings',expected:'array'}));
  if(Object.prototype.hasOwnProperty.call(data,'meta')&&(!data.meta||Array.isArray(data.meta)||typeof data.meta!=='object')) rows.push(row({root,file,source,rule:'house-key-meta-shape',house_key:'meta',expected:'object'}));
  return rows;
};

const parseCssRules=source=>allMatches(/([^{}]+)\{([^{}]*)\}/g,source).map(match=>({match,selector:match[1].trim(),body:match[2]}));
const cssStates=({root,file,source})=>{
  if(!CSS_RE.test(file))return[];
  const rows=[], seen=new Map();
  let rules;
  try { rules=readCssRules(source); }
  catch(error){return[row({root,file,source,rule:'invalid-css-state-source',message:error.message})];}
  for(const {start,selectors,body,scope} of rules){
    const states=selectors.filter(hasStateSelector);
    if(!states.length)continue;
    const normalized=states.join(', ');
    for(const selector of states){
      const key=`${scope}\u0000${selector.replace(/\s+/g,' ').trim()}`;
      if(seen.has(key)) rows.push(row({root,file,source,index:start,rule:'duplicate-css-state',selector,first_line:seen.get(key),message:'State selector is declared more than once in the same CSS scope.'}));
      else seen.set(key,lineOf(source,start));
    }
    const props=new Map();
    for(const decl of splitCssList(body,';')){
      const m=decl.replace(/\/\*[\s\S]*?\*\//g,'').match(/^\s*([\w-]+)\s*:/);if(!m)continue;const prop=m[1].startsWith('--')?m[1]:m[1].toLowerCase();
      if(props.has(prop)) rows.push(row({root,file,source,index:start,rule:'duplicate-css-state-property',selector:normalized,property:prop,message:'State block declares the same property more than once.'}));
      else props.set(prop,true);
    }
  }
  return rows;
};

const rawVisualEvidence=value=>{
  const stripped=value.replace(/var\([^)]*\)/g,' ').replace(/\b(?:linear-gradient|radial-gradient|calc|min|max|clamp)\s*\(/g,'(');
  const color=stripped.match(/#[0-9a-f]{3,8}\b|\brgba?\s*\(|\bhsla?\s*\(|\b(?:white|black|red|green|blue|gray|grey|yellow|orange|purple|pink|cyan|magenta)\b/i)?.[0];
  if(color)return color;
  const number=stripped.match(/(?:^|[\s,(])(-?(?:\d+\.?\d*|\.\d+)(?:px|rem|em|%|vh|vw|vmin|vmax|pt|pc|ch|ex|s|ms|deg)?)\b/i)?.[1];
  if(number&&Number(number)!==0)return number;
  if(/["'][^"']+["']/.test(stripped))return stripped.match(/["'][^"']+["']/)?.[0]??'quoted-value';
  return null;
};
const cssTokens=({root,file,source})=>{
  if(!CSS_RE.test(file))return[];
  const name=rel(root,file);
  if(/(?:^|\/)(?:tokens?|theme|themes|variables?|design-tokens)(?:\/|$)/i.test(name))return[];
  const rows=[];
  for(const {match,selector,body} of parseCssRules(source)){
    for(const decl of body.split(';')){
      const m=decl.match(/^\s*([\w-]+)\s*:\s*([\s\S]+?)\s*$/);if(!m)continue;
      const property=m[1].toLowerCase(), value=m[2].trim();
      if(property.startsWith('--')||!VISUAL_PROPS.has(property)||/^(?:none|inherit|initial|unset|currentColor|transparent|normal)$/i.test(value))continue;
      const raw=rawVisualEvidence(value);
      if(raw||!value.includes('var(')) rows.push(row({root,file,source,index:match.index,rule:'css-token-required',selector,property,value,raw_value:raw??value,expected_category:'semantic/theme token',message:`Visual property ${property} should resolve through var(--token).`}));
    }
  }
  return rows;
};

const classDisplayMap=async(root,files)=>{
  const map=new Map();
  for(const file of files.filter(x=>CSS_RE.test(x))){
    const source=await read(file);
    for(const {selector,body} of parseCssRules(source)){
      const display=body.match(/\bdisplay\s*:\s*(grid|flex)\b/i)?.[1]?.toLowerCase();if(!display)continue;
      for(const c of selector.matchAll(/\.([A-Za-z_-][\w-]*)/g))map.set(c[1],display);
    }
  }
  return map;
};
const layoutOf=(tag,attrs,classMap)=>{
  const lower=tag.toLowerCase();
  if(lower==='grid'||/Grid$/.test(tag)||/\bdata-grid(?:\s|=|$)/i.test(attrs))return'grid';
  if(lower==='flex'||/Flex$/.test(tag)||/\bdata-flex(?:\s|=|$)/i.test(attrs))return'flex';
  const style=attrs.match(/\bdisplay\s*:\s*['"]?(grid|flex)['"]?/i)?.[1]?.toLowerCase();if(style)return style;
  const classes=attrs.match(/\bclass(?:Name)?\s*=\s*["']([^"']+)["']/i)?.[1]?.split(/\s+/)??[];
  if(classes.includes('grid')||classes.some(x=>classMap.get(x)==='grid'))return'grid';
  if(classes.includes('flex')||classes.some(x=>classMap.get(x)==='flex'))return'flex';
  return null;
};
const gridContinuity=({root,file,source,classMap})=>{
  if(!JSX_RE.test(file))return[];
  const searchable=maskComments(source), rows=[], stack=[];
  const tagRe=/<\s*(\/?)\s*([A-Za-z][\w.$:-]*)\b([^<>]*?)(\/?)\s*>/g;
  for(const match of allMatches(tagRe,searchable)){
    const closing=Boolean(match[1]), tag=match[2], attrs=match[3]??'', self=Boolean(match[4]);
    if(closing){for(let i=stack.length-1;i>=0;i--){if(stack[i].tag===tag){stack.length=i;break;}}continue;}
    const layout=layoutOf(tag,attrs,classMap), entry={tag,layout,line:lineOf(source,match.index),label:`${tag}${layout?`[${layout}]`:''}`};
    if(layout==='grid'){
      let lastGrid=-1;for(let i=stack.length-1;i>=0;i--)if(stack[i].layout==='grid'){lastGrid=i;break;}
      if(lastGrid>=0){const between=stack.slice(lastGrid+1);if(between.some(x=>x.layout==='flex'))rows.push(row({root,file,source,index:match.index,rule:'grid-flex-grid',chain:[stack[lastGrid],...between,entry].map(x=>x.label),expected:'Grid continuity without a Flex intermediary.',message:'Flex must not sit between parent and child Grid layers.'}));}
    }
    if(!self&&!/^(?:input|img|br|hr|meta|link)$/i.test(tag))stack.push(entry);
  }
  return rows;
};


const formContract=async({root,files,options})=>{
  const resolveFile=value=>value?path.resolve(root,String(value)):null;
  const selected=[resolveFile(options.frontend_file),resolveFile(options.server_file),resolveFile(options.schema_file)].filter(Boolean);
  const candidates=selected.length?selected:files.filter(file=>/\.(?:html?|[jt]sx?|json)$/i.test(file));
  const frontend=new Map(), server=new Map(), schema=new Map();
  for(const file of candidates){if(!(await exists(file)))continue;const source=await read(file);
    if(!options.frontend_file||file===resolveFile(options.frontend_file))for(const m of allMatches(/\bname\s*=\s*["']([^"']+)["']/g,source))frontend.set(m[1],{file,source,index:m.index});
    if(!options.server_file||file===resolveFile(options.server_file))for(const m of allMatches(/\bformData\s*\.\s*(?:get|getAll)\s*\(\s*["']([^"']+)["']\s*\)/g,source))server.set(m[1],{file,source,index:m.index});
    if((options.schema_file&&file===resolveFile(options.schema_file))||(!options.schema_file&&/\.json$/i.test(file))){try{const data=JSON.parse(source);const arr=Array.isArray(data)?data:Array.isArray(data?.fields)?data.fields:[];for(const item of arr){const name=typeof item==='string'?item:item?.name??item?.columnName;if(name)schema.set(String(name),{file,source,index:source.indexOf(String(name))});}}catch{}}
  }
  const rows=[];const add=(map,key,rule,message,side)=>{const hit=map.get(key);if(hit)rows.push(row({root,file:hit.file,source:hit.source,index:Math.max(0,hit.index),rule,field:key,side,message}));};
  if(frontend.size&&server.size){for(const key of frontend.keys())if(!server.has(key))add(frontend,key,'form-contract-missing-server',`Frontend field ${key} has no matching FormData extraction key.`,'frontend');for(const key of server.keys())if(!frontend.has(key))add(server,key,'form-contract-missing-frontend',`FormData key ${key} has no matching frontend field name.`,'server');}
  if(schema.size){for(const key of frontend.keys())if(!schema.has(key))add(frontend,key,'form-contract-missing-schema',`Frontend field ${key} is absent from the supplied/discovered schema contract.`,'frontend');for(const key of server.keys())if(!schema.has(key))add(server,key,'form-contract-missing-schema',`FormData key ${key} is absent from the supplied/discovered schema contract.`,'server');}
  return rows;
};
const dependencyTopology=({graph,tool})=>{
  let data=graph;if(typeof data==='string'){try{data=JSON.parse(data);}catch{throw Object.assign(new Error(`${tool.key}: graph must be valid JSON.`),{code:'BAD_REQUEST'});}}
  if(!data||Array.isArray(data)||typeof data!=='object')throw Object.assign(new Error(`${tool.key}: graph must be an object mapping nodes to dependency arrays.`),{code:'BAD_REQUEST'});
  const nodes=new Set(Object.keys(data)), rows=[], inbound=new Map([...nodes].map(x=>[x,0]));
  for(const [node,deps] of Object.entries(data)){if(!Array.isArray(deps))throw Object.assign(new Error(`${tool.key}: dependencies for ${node} must be an array.`),{code:'BAD_REQUEST'});const seen=new Set();for(const dep of deps){if(typeof dep!=='string'||!dep)throw Object.assign(new Error(`${tool.key}: dependency names must be non-empty strings.`),{code:'BAD_REQUEST'});if(dep===node)rows.push({file:'(graph)',line:1,kind:'code-review-violation',rule:'dependency-self-edge',node,dependency:dep,text:`${node} -> ${dep}`});if(seen.has(dep))rows.push({file:'(graph)',line:1,kind:'code-review-violation',rule:'dependency-duplicate-edge',node,dependency:dep,text:`${node} -> ${dep}`});seen.add(dep);if(!nodes.has(dep))rows.push({file:'(graph)',line:1,kind:'code-review-violation',rule:'dependency-missing-node',node,dependency:dep,text:`${node} -> ${dep}`});else inbound.set(dep,(inbound.get(dep)??0)+1);}}
  const state=new Map(), stack=[];const emitted=new Set();const visit=node=>{if(state.get(node)===2)return;if(state.get(node)===1){const i=stack.indexOf(node),cycle=[...stack.slice(i),node];const key=cycle.join('>');if(!emitted.has(key)){emitted.add(key);rows.push({file:'(graph)',line:1,kind:'code-review-violation',rule:'dependency-cycle',cycle,text:cycle.join(' -> ')});}return;}state.set(node,1);stack.push(node);for(const dep of data[node]??[])if(nodes.has(dep)&&dep!==node)visit(dep);stack.pop();state.set(node,2);};for(const node of nodes)visit(node);
  return{rows,roots:[...nodes].filter(x=>(inbound.get(x)??0)===0).sort(),nodes:[...nodes].sort()};
};

export const run=async({options,context,tool})=>{
  const rule=tool.meta.rule;
  const scratch=Boolean(context?.[SCRATCH_SCOPE]);
  if(rule==='dependency-topology'){const out=dependencyTopology({graph:options.graph,tool});return{status:out.rows.length?'review':'ok',scan:'code-review-dependency-topology',root:null,totals:{files_scanned:0,matches:out.rows.length,nodes:out.nodes.length},roots:out.roots,rows:out.rows};}
  const sourceFolder=options.folder??context?.project?.root??(options.frontend_file?path.dirname(path.resolve(options.frontend_file)):null);
  if(!sourceFolder)throw Object.assign(new Error(`${tool.key}: folder, loaded project, or explicit form-contract files are required.`),{code:'INPUT_REQUIRED'});
  const root=path.resolve(sourceFolder), files=await scanFiles(root), rows=[];
  if(rule==='form-contract'){rows.push(...await formContract({root,files,options}));rows.sort((a,b)=>a.file.localeCompare(b.file)||a.line-b.line||a.rule.localeCompare(b.rule));return{status:rows.length?'review':'ok',scan:'code-review-form-contract',root,totals:{files_scanned:files.length,matches:rows.length},rows};}
  const classMap=rule==='grid-continuity'?await classDisplayMap(root,files):null;
  let filesScanned=0;
  for(const file of files){
    const eligible=rule==='house-key'?path.basename(file)==='settings.json':rule==='css-states'||rule==='css-tokens'?CSS_RE.test(file):rule==='grid-continuity'?JSX_RE.test(file):CODE_RE.test(file);
    if(!eligible)continue;filesScanned++;const source=await read(file);
    if(rule==='state-ownership')rows.push(...await stateOwnership({root,file,source}));
    else if(rule==='conventions')rows.push(...(scratch?[]:await conventions({root,file,source})),...loopItemNames({root,file,source}));
    else if(rule==='prop-renames')rows.push(...propRenames({root,file,source}));
    else if(rule==='bag-guards')rows.push(...bagGuards({root,file,source}));
    else if(rule==='house-key')rows.push(...await houseKeys({root,file,source}));
    else if(rule==='css-states')rows.push(...cssStates({root,file,source}));
    else if(rule==='css-tokens')rows.push(...cssTokens({root,file,source}));
    else if(rule==='grid-continuity')rows.push(...gridContinuity({root,file,source,classMap}));
  }
  rows.sort((a,b)=>a.file.localeCompare(b.file)||a.line-b.line||a.rule.localeCompare(b.rule));
  return{status:'ok',scan:`code-review-${rule}`,root,totals:{files_scanned:filesScanned,matches:rows.length},rows};
};
