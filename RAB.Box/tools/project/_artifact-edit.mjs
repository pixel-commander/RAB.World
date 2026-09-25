import { access, cp, lstat, mkdir, readFile, realpath, rename, rm, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { collectScriptFiles } from '../react/_source-glob.mjs';

const slash=value=>String(value).split(path.sep).join('/');
const exists=async file=>{try{await access(file);return true;}catch{return false;}};
const inputRequired=message=>Object.assign(new Error(message),{code:'INPUT_REQUIRED'});
const badRequest=message=>Object.assign(new Error(message),{code:'BAD_REQUEST'});
const notFound=message=>Object.assign(new Error(message),{code:'TARGET_NOT_FOUND'});
const alreadyExists=message=>Object.assign(new Error(message),{code:'ALREADY_EXISTS'});
const escapeRe=value=>String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

const lexicalInside=(root,target)=>target===root||target.startsWith(root+path.sep);
const realProject=async projectRoot=>realpath(projectRoot);
const assertExistingInside=async(projectRoot,target)=>{
  const abs=path.resolve(target);
  if(!lexicalInside(projectRoot,abs)||abs===projectRoot)throw badRequest('Artifact target must stay inside the loaded project and may not be the project root.');
  const [pr,tr]=await Promise.all([realProject(projectRoot),realpath(abs)]);
  if(!lexicalInside(pr,tr)||tr===pr)throw badRequest('Artifact target resolves outside the loaded project.');
  return tr;
};
const assertMissingInside=async(projectRoot,target)=>{
  const abs=path.resolve(target);
  if(!lexicalInside(projectRoot,abs)||abs===projectRoot)throw badRequest('Destination must stay inside the loaded project and may not be the project root.');
  let parent=path.dirname(abs);
  while(!(await exists(parent))&&parent!==projectRoot)parent=path.dirname(parent);
  const [pr,parentReal]=await Promise.all([realProject(projectRoot),realpath(parent)]);
  if(!lexicalInside(pr,parentReal))throw badRequest('Destination parent resolves outside the loaded project.');
  return abs;
};

const componentSource=async(projectRoot,name)=>{
  const source=await collectScriptFiles(projectRoot,['ts','tsx','js','jsx','mjs','cjs']);
  const candidates=[];
  const declaration=new RegExp(`\\b(?:function|class)\\s+${escapeRe(name)}\\b|\\b(?:const|let|var)\\s+${escapeRe(name)}\\s*=`,'m');
  for(const rel of source.files){
    const abs=path.join(source.cwd,rel);const ext=path.extname(rel);const base=path.basename(rel,ext);
    if(base===name){candidates.push(abs);continue;}
    const text=await readFile(abs,'utf8');if(declaration.test(text))candidates.push(abs);
  }
  const unique=[...new Set(candidates)];
  if(!unique.length)throw notFound(`Component not found: ${name}`);
  if(unique.length>1)throw Object.assign(new Error(`Component is ambiguous: ${name}`),{code:'AMBIGUOUS_TARGET',candidates:unique.map(x=>slash(path.relative(projectRoot,x)))});
  const file=await assertExistingInside(projectRoot,unique[0]);
  const parent=path.dirname(file);
  let artifact=file;
  if(path.basename(parent)===name)artifact=await assertExistingInside(projectRoot,parent);
  return {artifact,file,name};
};

const resolveSource=async({projectRoot,options,targetType})=>{
  const explicit=options.file??options.path??options.source;
  if(explicit){
    const abs=path.isAbsolute(explicit)?path.resolve(explicit):path.resolve(projectRoot,explicit);
    const artifact=await assertExistingInside(projectRoot,abs);
    const stat=await lstat(artifact);
    return {artifact,file:stat.isFile()?artifact:null,name:options.component??path.basename(artifact,path.extname(artifact))};
  }
  if(targetType==='component'||options.component){
    const name=String(options.component??options.name??'').trim();if(!name)throw inputRequired('Provide component, file, path, or source.');
    return componentSource(projectRoot,name);
  }
  throw inputRequired('Provide file, path, source, or component.');
};

const collectFiles=async root=>{
  const stat=await lstat(root);if(stat.isFile())return [root];
  const out=[];const walk=async dir=>{for(const e of await readdir(dir,{withFileTypes:true})){if(e.isSymbolicLink())continue;const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else if(e.isFile())out.push(p);}};await walk(root);return out;
};
const rewriteComponent=async({target,oldName,newName})=>{
  if(!oldName||!newName||oldName===newName)return [];
  const changed=[];const files=await collectFiles(target);const re=new RegExp(`\\b${escapeRe(oldName)}\\b`,'g');
  for(const file of files){
    if(!/\.(?:[cm]?[jt]sx?|json|css|scss|sass|less|md|txt)$/i.test(file))continue;
    const before=await readFile(file,'utf8');const after=before.replace(re,newName);
    if(after!==before){await writeFile(file,after,'utf8');changed.push(slash(file));}
  }
  const stat=await lstat(target);
  if(stat.isDirectory()){
    const candidates=await readdir(target,{withFileTypes:true});
    for(const e of candidates){
      if(!e.isFile())continue;const ext=path.extname(e.name);if(path.basename(e.name,ext)!==oldName)continue;
      const from=path.join(target,e.name),to=path.join(target,`${newName}${ext}`);if(!(await exists(to)))await rename(from,to);
    }
  }
  return changed;
};

const targetNameFor=({source,targetType,newName})=>{
  const statName=path.basename(source.artifact);const ext=path.extname(statName);
  if(!newName)return statName;
  if(targetType==='component'&&path.extname(source.artifact)==='')return newName;
  if(ext)return `${newName}${ext}`;
  return newName;
};

export const runArtifactEdit=async({mode,targetType='file',options={},context={}})=>{
  const projectRoot=path.resolve(context?.project?.root??options.root??'.');
  const source=await resolveSource({projectRoot,options,targetType});
  const relativeSource=slash(path.relative(projectRoot,source.artifact));
  if(mode==='delete'){
    if(options.confirm!==true)throw Object.assign(new Error('Destructive delete requires confirm=true.'),{code:'CONFIRM_REQUIRED'});
    await rm(source.artifact,{recursive:true,force:false});
    return {status:'deleted',mode,target_type:targetType,source:relativeSource,changed:true,provided:{seats:{deleted_path:relativeSource,component:targetType==='component'?source.name:undefined}}};
  }

  const newName=String(options.new_name??options.name_as??'').trim()||null;
  const destinationRaw=options.destination??options.folder??options.to_folder??null;
  let target;
  if(mode==='rename'){
    if(!newName)throw inputRequired('Provide new_name.');
    target=path.join(path.dirname(source.artifact),targetNameFor({source,targetType,newName}));
  }else{
    if(!destinationRaw)throw inputRequired('Provide destination folder.');
    const folder=path.isAbsolute(destinationRaw)?path.resolve(destinationRaw):path.resolve(projectRoot,destinationRaw);
    const folderTarget=await assertMissingInside(projectRoot,folder);
    await mkdir(folderTarget,{recursive:true});
    target=path.join(folderTarget,targetNameFor({source,targetType,newName:mode==='save-as'?newName:newName}));
  }
  target=await assertMissingInside(projectRoot,target);
  if(await exists(target))throw alreadyExists(`Destination already exists: ${slash(path.relative(projectRoot,target))}`);

  if(mode==='copy'||mode==='save-as')await cp(source.artifact,target,{recursive:true,errorOnExist:true,force:false});
  else if(mode==='move'||mode==='rename')await rename(source.artifact,target);
  else throw badRequest(`Unsupported artifact edit mode: ${mode}`);

  const effectiveNewName=newName??(targetType==='component'?path.basename(target,path.extname(target)):null);
  let rewritten=[];
  if(targetType==='component'&&effectiveNewName&&effectiveNewName!==source.name)rewritten=await rewriteComponent({target,oldName:source.name,newName:effectiveNewName});
  const targetRel=slash(path.relative(projectRoot,target));
  return {
    status:mode==='copy'||mode==='save-as'?'copied':'moved',mode,target_type:targetType,
    source:relativeSource,destination:targetRel,new_name:effectiveNewName,changed:true,rewritten_files:rewritten.map(x=>slash(path.relative(projectRoot,x))),
    provided:{seats:{path:targetRel,file:(await lstat(target)).isFile()?targetRel:undefined,component:targetType==='component'?(effectiveNewName??source.name):undefined,destination:targetRel}}
  };
};
