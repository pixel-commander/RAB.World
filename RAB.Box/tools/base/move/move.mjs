import { access, lstat, mkdir, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createToolHouse } from '../../../bridge/tool-house.mjs';

const exists=async file=>{try{await access(file);return true;}catch{return false;}};
const slash=value=>String(value).split(path.sep).join('/');
const safeRelative=value=>{
  const raw=String(value??'').trim().replaceAll('\\','/').replace(/^tools\//,'').replace(/^\/+|\/+$/g,'');
  if(!raw||raw.startsWith('/')||/^[A-Za-z]:\//.test(raw)||raw.startsWith('//'))return null;
  const parts=raw.split('/');
  if(parts.some(part=>!part||part==='.'||part==='..'))return null;
  return parts.join('/');
};
const atomicJson=async(file,value)=>{
  const temp=`${file}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temp,JSON.stringify(value,null,2)+'\n','utf8');
  await rename(temp,file);
};
const assertNoSymlinkAncestors=async(root,targetParent)=>{
  const rootReal=await realpath(root);
  const rel=path.relative(root,targetParent);
  if(rel.startsWith('..')||path.isAbsolute(rel))throw Object.assign(new Error('Destination escapes allowed root.'),{code:'INVALID_PATH'});
  let current=root;
  for(const part of rel.split(path.sep).filter(Boolean)){
    current=path.join(current,part);
    if(!(await exists(current)))break;
    const stat=await lstat(current);
    if(stat.isSymbolicLink())throw Object.assign(new Error(`Destination traverses a symlink: ${slash(path.relative(root,current))}`),{code:'INVALID_PATH'});
    if(!stat.isDirectory())throw Object.assign(new Error(`Destination parent is not a directory: ${slash(path.relative(root,current))}`),{code:'INVALID_PATH'});
    const currentReal=await realpath(current);
    if(currentReal!==rootReal&&!currentReal.startsWith(rootReal+path.sep))throw Object.assign(new Error('Destination resolves outside allowed root.'),{code:'INVALID_PATH'});
  }
};

export const run=async({options,context,root,tool})=>{
  const kind=tool.name;
  if(!['tool','stamp'].includes(kind))throw Object.assign(new Error(`Unsupported capability kind: ${kind}`),{code:'BAD_REQUEST'});
  const address=String(options.address??'').trim();
  const scope=String(options.scope??'house').trim();
  const destination=safeRelative(options.destination);
  if(!address)throw Object.assign(new Error('Provide the flat PATHS address to move.'),{code:'INPUT_REQUIRED'});
  if(!destination)throw Object.assign(new Error('Destination must be a safe relative semantic path.'),{code:'BAD_REQUEST'});
  if(options.confirm!==true)throw Object.assign(new Error('Explicit confirmation is required for control-plane path mutation.'),{code:'DENIED'});
  if(!['house','project'].includes(scope))throw Object.assign(new Error('scope must be house or project.'),{code:'BAD_REQUEST'});

  const projectRoot=context?.project?.root?path.resolve(context.project.root):null;
  if(scope==='project'&&!projectRoot)throw Object.assign(new Error('Project scope requires a loaded project.'),{code:'PROJECT_CONTEXT_REQUIRED'});
  const registryFile=scope==='house'?path.join(root,'PATHS.json'):path.join(projectRoot,'PATHS.json');
  const manifest=JSON.parse(await readFile(registryFile,'utf8'));
  const section=kind==='stamp'?'stamps':'tools';
  const entry=manifest?.[section]?.[address];
  if(!entry?.id||!entry?.path)throw Object.assign(new Error(`${scope} ${kind} address not found: ${address}`),{code:'TARGET_NOT_FOUND'});

  const oldPath=safeRelative(entry.path);
  if(!oldPath)throw Object.assign(new Error(`Current PATHS entry is invalid: ${entry.path}`),{code:'BAD_PATHS'});
  const allowedRoot=scope==='house'?path.join(root,'tools'):projectRoot;
  const source=path.resolve(allowedRoot,oldPath);
  const target=path.resolve(allowedRoot,destination);
  if(source===target)return {status:'unchanged',scope,kind,address,id:Number(entry.id),from:oldPath,to:destination,verified:true};
  if(target!==allowedRoot&&!target.startsWith(allowedRoot+path.sep))throw Object.assign(new Error('Destination escapes allowed root.'),{code:'INVALID_PATH'});
  if(path.basename(destination)!==path.basename(oldPath))throw Object.assign(new Error('A path move must preserve the capability leaf name. Rename is a separate operation.'),{code:'BAD_REQUEST'});
  if(!(await exists(source)))throw Object.assign(new Error(`Source capability folder is missing: ${oldPath}`),{code:'TARGET_NOT_FOUND'});
  if(await exists(target))throw Object.assign(new Error(`Destination already exists: ${destination}`),{code:'PATH_EXISTS'});
  await assertNoSymlinkAncestors(allowedRoot,path.dirname(target));

  const originalManifest=JSON.stringify(manifest,null,2)+'\n';
  let moved=false;
  try{
    await mkdir(path.dirname(target),{recursive:true});
    await rename(source,target); moved=true;
    manifest[section][address]={...entry,path:destination};
    await atomicJson(registryFile,manifest);

    const fresh=createToolHouse({root});
    const contextForVerify=scope==='project'?{project:{...context.project,root:projectRoot}}:{};
    const resolved=await fresh.getTool(address,{context:contextForVerify});
    if(Number(resolved.id)!==Number(entry.id)||resolved.path!==destination||resolved.kind!==kind){
      throw Object.assign(new Error('Post-move verification failed: stable identity/path/kind mismatch.'),{code:'VERIFY_FAILED'});
    }
    return {
      status:'moved',scope,kind,address,id:Number(entry.id),from:oldPath,to:destination,
      verified:true,stable_id_preserved:true,
      provided:{seats:{capability_id:Number(entry.id),capability_path:destination,address}}
    };
  }catch(error){
    try{await writeFile(registryFile,originalManifest,'utf8');}catch{}
    if(moved){try{await mkdir(path.dirname(source),{recursive:true});await rename(target,source);}catch{}}
    try{await rm(path.dirname(target),{recursive:false});}catch{}
    throw error;
  }
};
