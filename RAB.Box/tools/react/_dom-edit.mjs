import { readFile, writeFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { collectScriptFiles } from './_source-glob.mjs';

const slash=value=>String(value).split(path.sep).join('/');
const escapeRe=value=>String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const unique=values=>[...new Set(values.filter(Boolean))];
const inputRequired=message=>Object.assign(new Error(message),{code:'INPUT_REQUIRED'});
const badRequest=message=>Object.assign(new Error(message),{code:'BAD_REQUEST'});
const targetNotFound=message=>Object.assign(new Error(message),{code:'TARGET_NOT_FOUND'});

const resolveFile=async({options,context})=>{
  const projectRoot=path.resolve(context?.project?.root ?? options.root ?? '.');
  const explicit=options.file ?? options.path;
  if(explicit){
    const file=path.isAbsolute(explicit)?path.resolve(explicit):path.resolve(projectRoot,explicit);
    // Compare canonical filesystem locations: Windows short and long spellings
    // can denote the same directory. The realpath check also rejects escapes
    // through symlinks/junctions before any write.
    const [projectReal,fileReal]=await Promise.all([realpath(projectRoot),realpath(file)]);
    if(fileReal!==projectReal&&!fileReal.startsWith(projectReal+path.sep))throw badRequest('Target file resolves outside the loaded project.');
    return {projectRoot,file:fileReal,component:options.component??null};
  }
  const component=String(options.component??'').trim();
  if(!component)throw inputRequired('Provide component, file, or path.');
  const source=await collectScriptFiles(projectRoot,['ts','tsx','js','jsx','mjs','cjs']);
  const exactBase=[];const declared=[];
  const declaration=new RegExp(`\\b(?:function|class)\\s+${escapeRe(component)}\\b|\\b(?:const|let|var)\\s+${escapeRe(component)}\\s*=`,'m');
  for(const relative of source.files){
    const ext=path.extname(relative);const base=path.basename(relative,ext);
    if(base===component)exactBase.push(relative);
    const text=await readFile(path.join(source.cwd,relative),'utf8');
    if(declaration.test(text))declared.push(relative);
  }
  const candidates=unique([...exactBase,...declared]);
  if(!candidates.length)throw targetNotFound(`Component not found: ${component}`);
  if(candidates.length>1)throw Object.assign(new Error(`Component is ambiguous: ${component}`),{code:'AMBIGUOUS_TARGET',candidates});
  return {projectRoot,file:path.join(source.cwd,candidates[0]),component};
};

const componentRange=(text,name)=>{
  if(!name)return {start:0,end:text.length};
  const patterns=[
    new RegExp(`\\b(?:export\\s+)?(?:default\\s+)?function\\s+${escapeRe(name)}\\b`,'m'),
    new RegExp(`\\b(?:export\\s+)?(?:const|let|var)\\s+${escapeRe(name)}\\s*=`,'m'),
    new RegExp(`\\bclass\\s+${escapeRe(name)}\\b`,'m')
  ];
  let match=null;
  for(const re of patterns){const m=re.exec(text);if(m){match=m;break;}}
  if(!match)return {start:0,end:text.length};
  const start=match.index,searchFrom=match.index+match[0].length;
  const tail=text.slice(searchFrom);
  const next=/\b(?:export\s+)?(?:default\s+)?function\s+[A-Z][A-Za-z0-9_$]*\b|\b(?:export\s+)?(?:const|let|var)\s+[A-Z][A-Za-z0-9_$]*\s*=|\bclass\s+[A-Z][A-Za-z0-9_$]*\b/g.exec(tail);
  return {start,end:next?searchFrom+next.index:text.length};
};

const scanTags=(text,range)=>{
  const tags=[];let i=range.start;
  while(i<range.end){
    const lt=text.indexOf('<',i);if(lt<0||lt>=range.end)break;
    const next=text[lt+1];
    if(next==='!'||next==='?'||next==='>'){i=lt+2;continue;}
    const closing=next==='/';let p=lt+(closing?2:1);
    const m=/^[A-Za-z][A-Za-z0-9:_-]*/.exec(text.slice(p));
    if(!m){i=lt+1;continue;}
    const name=m[0];p+=name.length;
    let quote=null,brace=0,j=p;
    for(;j<range.end;j++){
      const ch=text[j],prev=text[j-1];
      if(quote){if(ch===quote&&prev!=='\\')quote=null;continue;}
      if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
      if(ch==='{'){brace++;continue;}if(ch==='}'){brace=Math.max(0,brace-1);continue;}
      if(ch==='>'&&brace===0)break;
    }
    if(j>=range.end)break;
    const raw=text.slice(lt,j+1);const selfClosing=!closing&&/\/\s*>$/.test(raw);
    tags.push({start:lt,end:j+1,name,closing,selfClosing,raw});i=j+1;
  }
  return tags;
};

const attrValue=(raw,name)=>{
  const re=new RegExp(`\\b${escapeRe(name)}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|\\{\\s*"([^"]*)"\\s*\\}|\\{\\s*'([^']*)'\\s*\\}|\\{\\s*\`([^\`$]*)\`\\s*\\})`,'m');
  const m=re.exec(raw);return m?{value:m.slice(1).find(v=>v!==undefined)??'',match:m}:null;
};
const hasAttr=(raw,name)=>new RegExp(`\\b${escapeRe(name)}\\s*=`).test(raw);
const isJsxFile=file=>/\.(?:tsx|jsx|ts|js|mjs|cjs)$/i.test(file);

const selectorMatches=(tag,{seat_id,data_area,element,root},rootStart)=>{
  if(tag.closing||(tag.selfClosing&&root))return false;
  if(root)return tag.start===rootStart;
  if(element&&tag.name.toLowerCase()!==String(element).toLowerCase())return false;
  if(seat_id){const a=attrValue(tag.raw,'data-rab-seat');if(!a||a.value!==String(seat_id))return false;}
  if(data_area){const a=attrValue(tag.raw,'data-area');if(!a||a.value!==String(data_area))return false;}
  return Boolean(seat_id||element||data_area);
};

const pickTargets=(text,range,options)=>{
  const tags=scanTags(text,range).filter(t=>!t.closing);
  const native=tags.filter(t=>/^[a-z]/.test(t.name));
  const rootStart=native.find(t=>!t.selfClosing)?.start??tags.find(t=>!t.selfClosing)?.start??null;
  if(rootStart===null)throw targetNotFound('No renderable DOM element found in target scope.');
  const hasSelector=Boolean(options.seat_id||options.data_area||options.element);const root=!hasSelector;
  const matches=tags.filter(tag=>selectorMatches(tag,{seat_id:options.seat_id,data_area:options.data_area,element:options.element,root},rootStart));
  if(!matches.length)throw targetNotFound(`No DOM target matched${options.seat_id?` data-rab-seat=${options.seat_id}`:''}${options.data_area?` data-area=${options.data_area}`:''}${options.element?` element=${options.element}`:''}.`);
  return options.quantifier==='all'||options.all===true?matches:[matches[0]];
};

const targetSummary=tag=>({tag:tag.name,seat_id:attrValue(tag.raw,'data-rab-seat')?.value??null,data_area:attrValue(tag.raw,'data-area')?.value??null});

const replaceClassOnTag=(raw,file,{mode,class_name,from_class,to_class})=>{
  const attr=isJsxFile(file)?'className':'class';const alternate=attr==='className'?'class':'className';
  // Recognize only the canonical stamp's default + caller class composition.
  // Edit its static default without evaluating or discarding caller expressions.
  const composed=attr==='className'?/\bclassName\s*=\s*\{\s*\[\s*("(?:\\.|[^"\\])*")\s*,\s*className\s*\]\s*\.filter\(Boolean\)\.join\((['"]) \2\)\s*\}/.exec(raw):null;
  const existing=composed?{value:JSON.parse(composed[1]),match:composed}:attrValue(raw,attr)??attrValue(raw,alternate);const present=hasAttr(raw,attr)||hasAttr(raw,alternate);
  if(present&&!existing)throw Object.assign(new Error('Dynamic class expressions are not modified automatically.'),{code:'DYNAMIC_CLASS_UNSUPPORTED'});
  const desired=String(class_name??to_class??'').trim();
  if((mode==='add-class'||mode==='change-class')&&!desired)throw inputRequired(mode==='change-class'?'Provide to_class.':'Provide class_name.');
  if(mode==='change-class'&&!String(from_class??'').trim())throw inputRequired('Provide from_class.');
  if(mode==='remove-class'&&!String(class_name??'').trim())throw inputRequired('Provide class_name.');
  if(!existing){
    if(mode!=='add-class')return {raw,changed:false,reason:'class-not-present'};
    const insert=raw.lastIndexOf('/>')>=0?raw.lastIndexOf('/>'):raw.lastIndexOf('>');
    return {raw:`${raw.slice(0,insert)} ${attr}="${desired}"${raw.slice(insert)}`,changed:true};
  }
  const tokens=existing.value.split(/\s+/).filter(Boolean);let next=[...tokens];
  if(mode==='add-class')next=unique([...tokens,...desired.split(/\s+/)]);
  if(mode==='remove-class')next=tokens.filter(x=>x!==String(class_name));
  if(mode==='change-class')next=tokens.map(x=>x===String(from_class)?desired:x);
  if(mode==='change-class'&&!tokens.includes(String(from_class)))return {raw,changed:false,reason:'class-not-present'};
  const value=next.join(' ');const full=existing.match[0];const lhs=full.slice(0,full.indexOf('='));const replacement=composed?`className={[${JSON.stringify(value)}, className].filter(Boolean).join(' ')}`:`${lhs}="${value}"`;
  return {raw:raw.slice(0,existing.match.index)+replacement+raw.slice(existing.match.index+full.length),changed:replacement!==full};
};

const replaceAttributeOnTag=(raw,{mode,attribute_name,attribute_value})=>{
  const name=String(attribute_name??'').trim();if(!name)throw inputRequired('Provide attribute_name.');
  if(!/^[A-Za-z_:][A-Za-z0-9:_.-]*$/.test(name))throw badRequest(`Invalid attribute name: ${name}`);
  const existing=attrValue(raw,name);const present=hasAttr(raw,name);
  if(present&&!existing)throw Object.assign(new Error(`Dynamic attribute expressions are not modified automatically: ${name}`),{code:'DYNAMIC_ATTRIBUTE_UNSUPPORTED'});
  const needsValue=mode==='add-attribute'||mode==='change-attribute';
  const value=String(attribute_value??'');if(needsValue&&attribute_value===undefined)throw inputRequired('Provide attribute_value.');
  if(mode==='add-attribute'&&existing){
    if(existing.value===value)return {raw,changed:false,reason:'attribute-already-present'};
    throw Object.assign(new Error(`Attribute already exists: ${name}`),{code:'ATTRIBUTE_EXISTS'});
  }
  if(mode==='change-attribute'&&!existing)return {raw,changed:false,reason:'attribute-not-present'};
  if(mode==='remove-attribute'&&!existing)return {raw,changed:false,reason:'attribute-not-present'};
  if(mode==='add-attribute'){
    const insert=raw.lastIndexOf('/>')>=0?raw.lastIndexOf('/>'):raw.lastIndexOf('>');
    return {raw:`${raw.slice(0,insert)} ${name}="${value.replaceAll('"','&quot;')}"${raw.slice(insert)}`,changed:true};
  }
  const full=existing.match[0];
  if(mode==='remove-attribute'){
    let start=existing.match.index;while(start>0&&/\s/.test(raw[start-1]))start--;
    return {raw:raw.slice(0,start)+raw.slice(existing.match.index+full.length),changed:true};
  }
  const lhs=full.slice(0,full.indexOf('='));const replacement=`${lhs}="${value.replaceAll('"','&quot;')}"`;
  return {raw:raw.slice(0,existing.match.index)+replacement+raw.slice(existing.match.index+full.length),changed:replacement!==full};
};

const applyReplacements=(text,replacements)=>{
  let next=text;for(const item of [...replacements].sort((a,b)=>b.start-a.start))next=next.slice(0,item.start)+item.text+next.slice(item.end);return next;
};
const findMatchingClose=(tags,target)=>{
  if(target.selfClosing)return null;let depth=0;
  for(const tag of tags){
    if(tag.start<=target.start||tag.name!==target.name)continue;
    if(!tag.closing&&!tag.selfClosing)depth++;
    if(tag.closing){if(depth===0)return tag;depth--;}
  }
  return null;
};
const fullRange=(tags,target)=>{const close=findMatchingClose(tags,target);return {start:target.start,end:close?.end??target.end,close};};
const openTag=(file,{tag,class_name,new_data_area,new_seat_id})=>{
  const name=String(tag??'div').trim()||'div';if(!/^[A-Za-z][A-Za-z0-9:_-]*$/.test(name))throw badRequest(`Invalid element tag: ${name}`);
  const attrs=[];const cls=String(class_name??'').trim();if(cls)attrs.push(`${isJsxFile(file)?'className':'class'}="${cls}"`);if(new_data_area)attrs.push(`data-area="${String(new_data_area)}"`);if(new_seat_id)attrs.push(`data-rab-seat="${String(new_seat_id)}"`);
  return {name,text:`<${name}${attrs.length?' '+attrs.join(' '):''}>`};
};
const makeElement=(file,options)=>{const open=openTag(file,options);return `${open.text}</${open.name}>`;};

const insertionForChild=(text,target,close,element)=>{
  const lineStart=text.lastIndexOf('\n',close.start-1)+1;const closeIndent=/^\s*/.exec(text.slice(lineStart,close.start))[0];
  const openLineStart=text.lastIndexOf('\n',target.start-1)+1;const openIndent=/^\s*/.exec(text.slice(openLineStart,target.start))[0];
  const indentUnit=closeIndent.length>openIndent.length?closeIndent.slice(openIndent.length):'  ';const childIndent=openIndent+indentUnit;
  const multiline=text.slice(target.end,close.start).includes('\n');const closeOwnLine=text.slice(lineStart,close.start).trim()==='';
  return multiline&&closeOwnLine?{start:lineStart,end:close.start,text:`${childIndent}${element}\n${closeIndent}`}:{start:close.start,end:close.start,text:`\n${childIndent}${element}\n${openIndent}`};
};

const normalizedMode=(mode,options)=>{
  if(mode==='add'||mode==='change'||mode==='remove')return `${mode}-class`;
  if(mode==='add-data-area')return 'add-attribute';
  if(mode==='change-data-area')return 'change-attribute';
  if(mode==='remove-data-area')return 'remove-attribute';
  return mode;
};

export const runDomEdit=async({mode,options,context})=>{
  const resolved=await resolveFile({options,context});const text=await readFile(resolved.file,'utf8');const range=componentRange(text,resolved.component);
  const actual=normalizedMode(mode,options);const mapped={...options};
  if(mode.endsWith?.('data-area')){mapped.attribute_name='data-area';mapped.attribute_value=options.new_data_area??options.attribute_value;}
  const targets=pickTargets(text,range,mapped);const tags=scanTags(text,range);let next=text;const edits=[];

  if(actual==='add-element'){
    const element=makeElement(resolved.file,mapped);const inserts=[];
    for(const target of targets){const close=findMatchingClose(tags,target);if(!close)throw Object.assign(new Error(`Target <${target.name}> cannot accept a child element.`),{code:'INVALID_TARGET'});inserts.push(insertionForChild(text,target,close,element));edits.push({target:targetSummary(target),added:{tag:mapped.tag??'div',class_name:mapped.class_name??null,data_area:mapped.new_data_area??null,seat_id:mapped.new_seat_id??null}});}
    next=applyReplacements(text,inserts);
  }else if(['add-class','change-class','remove-class'].includes(actual)){
    const replacements=[];for(const target of targets){const changed=replaceClassOnTag(target.raw,resolved.file,{mode:actual,...mapped});if(changed.changed)replacements.push({start:target.start,end:target.end,text:changed.raw});edits.push({target:targetSummary(target),changed:changed.changed,reason:changed.reason??null});}next=applyReplacements(text,replacements);
  }else if(['add-attribute','change-attribute','remove-attribute'].includes(actual)){
    const replacements=[];for(const target of targets){const changed=replaceAttributeOnTag(target.raw,{mode:actual,...mapped});if(changed.changed)replacements.push({start:target.start,end:target.end,text:changed.raw});edits.push({target:targetSummary(target),attribute:mapped.attribute_name,changed:changed.changed,reason:changed.reason??null});}next=applyReplacements(text,replacements);
  }else if(actual==='remove-element'){
    const replacements=[];for(const target of targets){const r=fullRange(tags,target);replacements.push({start:r.start,end:r.end,text:''});edits.push({removed:targetSummary(target)});}next=applyReplacements(text,replacements);
  }else if(actual==='replace-element'){
    const replacementTag=String(mapped.replacement_tag??mapped.tag??'').trim();if(!/^[A-Za-z][A-Za-z0-9:_-]*$/.test(replacementTag))throw inputRequired('Provide a valid replacement_tag.');
    const replacements=[];for(const target of targets){const close=findMatchingClose(tags,target);const openRaw=target.raw.replace(new RegExp(`^<${escapeRe(target.name)}\\b`),`<${replacementTag}`);replacements.push({start:target.start,end:target.end,text:openRaw});if(close)replacements.push({start:close.start,end:close.end,text:close.raw.replace(new RegExp(`^</${escapeRe(target.name)}\\b`),`</${replacementTag}`)});edits.push({target:targetSummary(target),from:target.name,to:replacementTag});}next=applyReplacements(text,replacements);
  }else if(actual==='wrap-element'){
    const wrapper=openTag(resolved.file,{tag:mapped.wrapper_tag??mapped.tag??'div',class_name:mapped.class_name,new_data_area:mapped.new_data_area,new_seat_id:mapped.new_seat_id});const replacements=[];
    for(const target of targets){const r=fullRange(tags,target);const source=text.slice(r.start,r.end);replacements.push({start:r.start,end:r.end,text:`${wrapper.text}${source}</${wrapper.name}>`});edits.push({wrapped:{...targetSummary(target),with:wrapper.name,new_seat_id:mapped.new_seat_id??null}});}next=applyReplacements(text,replacements);
  }else if(actual==='move-element'){
    if(targets.length!==1)throw badRequest('move-element supports one source target per operation.');
    const source=targets[0];const sr=fullRange(tags,source);const destOptions={seat_id:mapped.to_seat_id,data_area:mapped.to_data_area,element:mapped.to_element,quantifier:'one'};
    if(!destOptions.seat_id&&!destOptions.data_area&&!destOptions.element)throw inputRequired('Provide to_seat_id, to_data_area, or to_element.');
    const destination=pickTargets(text,range,destOptions)[0];const dr=fullRange(tags,destination);
    if(destination.start===source.start||destination.start>sr.start&&destination.start<sr.end)throw badRequest('Cannot move an element into itself or one of its descendants.');
    const close=dr.close;if(!close)throw Object.assign(new Error(`Destination <${destination.name}> cannot accept a child element.`),{code:'INVALID_TARGET'});
    const sourceText=text.slice(sr.start,sr.end);const insert=insertionForChild(text,destination,close,sourceText);
    next=applyReplacements(text,[insert,{start:sr.start,end:sr.end,text:''}]);edits.push({moved:{...targetSummary(source),to:targetSummary(destination)}});
  }else throw badRequest(`Unsupported DOM edit mode: ${actual}`);

  const changed=next!==text;if(changed&&!mapped.dry_run)await writeFile(resolved.file,next,'utf8');
  return {status:mapped.dry_run?'preview':changed?'updated':'unchanged',mode,file:slash(path.relative(resolved.projectRoot,resolved.file)),component:resolved.component,target:{seat_id:mapped.seat_id??null,data_area:mapped.data_area??null,element:mapped.element??null,quantifier:mapped.quantifier??'one',defaulted_to_root:!mapped.seat_id&&!mapped.data_area&&!mapped.element},changed,targets:targets.length,edits,provided:{seats:{file:resolved.file,component:resolved.component??undefined}}};
};
