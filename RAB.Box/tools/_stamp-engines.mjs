import { mkdir, readFile, writeFile, realpath, lstat } from 'node:fs/promises';
import path from 'node:path';
import { createRabMemory } from '../bridge/rab-memory.mjs';
import { renderTemplateTree, writeArtifactPlan, checkedAbsolutePath } from './_artifact-plan.mjs';
import { makeNode } from '../bridge/rab-node.mjs';
import { assertNumericId } from '../bridge/rab-id.mjs';
import { loadToolkit } from '../bridge/toolkit-links.mjs';
import { prepareComponentInputs } from './react/_component-inputs.mjs';
import { stampScaffoldRecords } from './_scaffold-records.mjs';


export const runProjectStamp=async({options,context,tool,destination,projectId,templateValues={},additionalFiles=[]})=>{
  const memory=createRabMemory({rabHome:context.rab_home});
  memory.newProjectPath(options.name); // Shared folder-name validation, before any artifacts.
  const target=destination??path.join(path.resolve(options.folder),options.name);
  const customToolkitPath=options.custom_toolkit_path===undefined ? tool.toolkit?.root??null : options.custom_toolkit_path;
  if(customToolkitPath!==null && customToolkitPath!=='') {
    if(typeof customToolkitPath!=='string' || !path.isAbsolute(customToolkitPath))throw Object.assign(new Error('custom_toolkit_path must be an absolute toolkit folder.'),{code:'BAD_INPUT'});
    await loadToolkit(customToolkitPath);
  }
  const template=path.join(tool.root,'template');
  const id=assertNumericId(projectId??await memory.allocateId());
  const rendered=await renderTemplateTree(template,{...templateValues,PROJECT_ID:id,PROJECT_NAME:options.name,NPM_NAME:String(options.name).toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^[._-]+/,'')||'app'});
  let files=rendered.map(file=>{
    if(!['settings.json','PATHS.json'].includes(file.path))return file;
    const value=JSON.parse(file.text);
    if(file.path==='PATHS.json')value.project.id=id;
    else Object.assign(value,makeNode({...value,id,title:options.title??options.name,description:options.description??value.description??'Local project',custom_toolkit_path:customToolkitPath,settings:[],meta:{kind:'project',source_root:path.resolve(target)}}));
    return {...file,text:JSON.stringify(value,null,2)+'\n'};
  });
  const stampedAt=new Date().toISOString();
  files=await Promise.all(files.map(async file=>{
    if(file.path.split(/[\\/]/).at(-1)!=='beacon.json'||file.text===undefined)return file;
    const beacon=JSON.parse(file.text);
    if(beacon.beacon!=='on'||beacon._scaffold===true)return file;
    return {...file,text:JSON.stringify({...beacon,id:await memory.allocateId(),date_added:stampedAt,path:path.resolve(target,path.dirname(file.path))},null,2)+'\n'};
  }));
  const combined=new Map(files.map(file=>[file.path,file]));
  for(const file of additionalFiles)combined.set(file.path,file);
  const stamped=await stampScaffoldRecords({files:[...combined.values()],target,memory,projectName:options.name});
  const verification=await memory.registerProject({id,name:options.name,root:path.resolve(target)},()=>writeArtifactPlan({destination:target,files:stamped}));
  const settings=JSON.parse(await readFile(path.join(target,'settings.json'),'utf8'));
  const meta={id,name:options.name,root:await realpath(target)};
  const opened=await memory.openProject(meta);
  let projectManifest;
  try{projectManifest=await memory.addProjectToManifest(meta);}
  catch(error){error.project_created=meta;throw error;}
  return {status:'created',project:{...meta,type:settings.type},settings,box_memory:opened.dir,project_manifest:projectManifest,verification};
};

export const runReactComponentStamp=async({options,context,helpers,templateUrl,parentOption,templateValues={}})=>{
  if(!/^[A-Z][A-Za-z0-9_$]*$/.test(String(options.name??'')))throw Object.assign(new Error('Component name must be a valid capitalized React identifier.'),{code:'BAD_REQUEST'});
  const parent=await checkedAbsolutePath(options[parentOption]),dir=path.join(parent,options.name);
  try{await lstat(dir);throw Object.assign(new Error(`Target already exists: ${dir}`),{code:'EEXIST'});}catch(error){if(error.code!=='ENOENT')throw error;}
  const prepared=await prepareComponentInputs({options,context,helpers});
  if(prepared.questions.length)throw Object.assign(new Error('Resolve the component atom choices before creating files.'),{code:'INPUT_REQUIRED',details:{safe_to_resume:true,missing:prepared.questions}});
  options=prepared.resolvedOptions;
  const dependencies=[];
  let text=await readFile(templateUrl,'utf8');
  text=text.replaceAll('__COMPONENT_NAME__',options.name);
  const areas=prepared.grid?.areas??[];
  const values={...templateValues,DEFAULT_CLASS:JSON.stringify(options.class_name??''),GRID_ATTRIBUTE:prepared.grid?` data-grid="${prepared.grid.name}"`:'',DEFAULT_CHILDREN:prepared.grid?`(\n    <>\n${areas.map(area=>`      <div data-area="${area}" data-rab-seat="area-${area}:a1"></div>`).join('\n')}\n    </>\n  )`:JSON.stringify(options.name)};
  for(const [key,value] of Object.entries(values))text=text.replaceAll(`__${key}__`,String(value));
  const ext=options.save_as_text?'.txt':'.tsx',file=path.join(dir,`${options.name}${ext}`);
  const metadata=await helpers.createItemSettings({
    name:options.name,
    title:options.title??options.name,
    description:options.description??`React component ${options.name}.`,
    settings:[],
    meta:{kind:'component'},
    type:'component',
    ...(options.class_name?{class:options.class_name}:{}),
    ...(prepared.grid?{grid:prepared.grid.name,areas}:{}),
    parent_path:parentOption==='parent_path'?parent:null,
    ...(options.indexed===undefined?{}:{indexed:options.indexed})
  });
  let verification;
  try{
    for(const dependency of prepared.dependencies)dependencies.push(await helpers.runTool({key:dependency.key,options:dependency.options}));
    verification=await writeArtifactPlan({destination:dir,allowedRoot:parent,files:[
      {path:`${options.name}${ext}`,text},
      {path:'settings.json',text:JSON.stringify(metadata,null,2)+'\n'},
      {path:'README.txt',text:`Generated component ${options.name}. Skin is composed from host-owned atoms.\n`}
    ]});
  }catch(error){
    if(dependencies.length)error.details={...error.details,safe_to_resume:false,dependencies,component_destination:dir};
    throw error;
  }
  return{status:'created',type:'component',id:metadata.id,name:options.name,title:metadata.title,description:metadata.description,settings:metadata,path:file,file,folder:dir,parent_path:parent,verification,...(prepared.grid?{grid:prepared.grid.name,areas,construction_seats:areas.map(area=>({id:`area-${area}:a1`,role:'area',area}))}:{}),...(dependencies.length?{dependencies}:{}),provided:{seats:{name:options.name,component_name:options.name,target:file,file,path:file,folder:dir}}};
};

const safe=value=>String(value).replace(/[^A-Za-z0-9_$]/g,'');
export const runReactHookStamp=async({options,templateUrl,nativeSymbol,seats,templateValues={}})=>{const name=safe(options.name);if(!/^use[A-Z]/.test(name))throw Object.assign(new Error('Custom hook name must begin with use followed by a capitalized name.'),{code:'BAD_INPUT'});const location=path.resolve(options.location);await mkdir(location,{recursive:true});let text=await readFile(templateUrl,'utf8');text=text.replaceAll('__HOOK_NAME__',name);for(const[k,v]of Object.entries(templateValues))text=text.replaceAll(`__${k}__`,String(v));const file=path.join(location,`${name}.tsx`);await writeFile(file,text,{flag:'wx'});return{status:'created',type:'hook',name,path:file,native_symbol:nativeSymbol,seats};};
