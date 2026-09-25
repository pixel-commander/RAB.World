import { readFile, writeFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { collectScriptFiles } from '../../_source-glob.mjs';

const slash=value=>String(value).split(path.sep).join('/');
const escapeRe=value=>String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const badRequest=message=>Object.assign(new Error(message),{code:'BAD_REQUEST'});
const inputRequired=message=>Object.assign(new Error(message),{code:'INPUT_REQUIRED'});
const targetNotFound=message=>Object.assign(new Error(message),{code:'TARGET_NOT_FOUND'});

const componentFile=async(projectRoot,name)=>{
  const source=await collectScriptFiles(projectRoot,['ts','tsx','js','jsx','mjs','cjs']);
  const declaration=new RegExp(`\\b(?:function|class)\\s+${escapeRe(name)}\\b|\\b(?:const|let|var)\\s+${escapeRe(name)}\\s*=`,'m');
  const hits=[];
  for(const relative of source.files){const file=path.join(source.cwd,relative);const base=path.basename(relative,path.extname(relative));const text=await readFile(file,'utf8');if(base===name||declaration.test(text))hits.push(file);}
  const unique=[...new Set(hits)];
  if(!unique.length)throw targetNotFound(`Component not found: ${name}`);
  if(unique.length>1)throw Object.assign(new Error(`Component is ambiguous: ${name}`),{code:'AMBIGUOUS_TARGET',candidates:unique.map(file=>slash(path.relative(projectRoot,file)))});
  return realpath(unique[0]);
};

const targetFile=async(projectRoot,options)=>{
  const explicit=options.file??options.path;
  if(explicit){const file=path.isAbsolute(explicit)?path.resolve(explicit):path.resolve(projectRoot,explicit);if(file!==projectRoot&&!file.startsWith(projectRoot+path.sep))throw badRequest('Target file must stay inside the loaded project.');return realpath(file);}
  const name=String(options.into_component??'').trim();if(!name)throw inputRequired('Provide into_component, file, or path.');return componentFile(projectRoot,name);
};

const importSpec=({from,to})=>{
  let rel=slash(path.relative(path.dirname(to),from)).replace(/\.(?:tsx?|jsx?|mjs|cjs)$/i,'');
  if(!rel.startsWith('.'))rel=`./${rel}`;
  return rel;
};
const importLine=({name,from,to})=>`import { ${name} } from '${importSpec({from,to})}';`;
const staticImports=text=>{
  const found=[];
  const re=/\bimport\s+([^;]+?)\s+from\s*['"]([^'"]+)['"]\s*;?/g;
  for(const match of text.matchAll(re))found.push({clause:match[1].trim(),source:match[2],text:match[0]});
  return found;
};
const importBindsName=(clause,name)=>{
  const beforeNamed=clause.split('{',1)[0].replace(/,\s*$/,'').trim();
  if(beforeNamed&&beforeNamed!==clause&&beforeNamed===name)return true;
  if(!clause.includes('{')&&!clause.startsWith('*')&&clause.split(',')[0].trim()===name)return true;
  if(new RegExp(`\\*\\s+as\\s+${escapeRe(name)}\\b`).test(clause))return true;
  const named=/\{([^}]*)\}/.exec(clause)?.[1]??'';
  return named.split(',').map(part=>part.trim()).filter(Boolean).some(part=>{
    const bits=part.split(/\s+as\s+/i).map(v=>v.trim());
    return (bits[1]??bits[0])===name;
  });
};

export const run=async({options,context,helpers})=>{
  const projectRoot=path.resolve(context?.project?.root??'.');
  const name=String(options.component??'').trim();if(!/^[A-Z][A-Za-z0-9_$]*$/.test(name))throw badRequest('Component name must be a valid capitalized React identifier.');
  if(!options.seat_id&&!options.area)throw inputRequired('Provide seat_id or area.');
  const source=await componentFile(projectRoot,name);const target=await targetFile(projectRoot,options);
  if(source===target)throw badRequest('A component cannot be inserted into its own source file.');
  const childOptions={file:target,seat_id:options.seat_id,data_area:options.area,tag:name};
  await helpers.runTool({key:'react/add/element',options:{...childOptions,dry_run:true}});

  const before=await readFile(target,'utf8');const line=importLine({name,from:source,to:target});const spec=importSpec({from:source,to:target});
  const imports=staticImports(before);
  const imported=imports.some(item=>item.source===spec&&importBindsName(item.clause,name));
  const conflict=imports.find(item=>item.source!==spec&&importBindsName(item.clause,name));
  if(conflict)throw Object.assign(new Error(`Import binding collision for ${name}: already bound from ${conflict.source}; expected ${spec}.`),{code:'IMPORT_COLLISION',component:name,existing_source:conflict.source,expected_source:spec});
  const withImport=imported?before:`${line}\n${before}`;
  if(withImport!==before)await writeFile(target,withImport,'utf8');
  try{
    const inserted=await helpers.runTool({key:'react/add/element',options:childOptions});
    return {status:'inserted',type:'component-use',component:name,target_file:inserted.result.file,area:options.area??null,seat_id:options.seat_id??null,import_added:!imported,import:line,provided:{seats:{file:target,component:name,area:options.area??undefined}}};
  }catch(error){if(withImport!==before)await writeFile(target,before,'utf8');throw error;}
};
