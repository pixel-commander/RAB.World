// Explicit, two-phase recovery of a misplaced Box home. Originals and a
// hash manifest are retained under the destination user's .rab/backups.
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {realpathSync} from 'node:fs';
import {readFile,writeFile,mkdir,readdir,lstat,rename} from 'node:fs/promises';
import {withMemoryLock} from '../bridge/rab-memory-lock.mjs';
import {assertNumericId} from '../bridge/rab-id.mjs';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const json = bytes => JSON.parse(bytes.toString('utf8'));
const encode = value => Buffer.from(JSON.stringify(value,null,2)+'\n');
const readMaybe = file => readFile(file).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
const canonical = value => {try{return realpathSync.native(path.resolve(value));}catch(error){if(error.code==='ENOENT')return path.resolve(value);throw error;}};
const fold = value => canonical(value).toLowerCase();
const inside = (root, relative) => {
  const result=path.resolve(root,relative), rel=path.relative(path.resolve(root),result);
  if(!rel||rel.startsWith('..'+path.sep)||rel==='..'||path.isAbsolute(rel))throw new Error(`Unsafe recovery path: ${relative}`);
  return result;
};
const files = async (root,relative='') => {
  const out=[];
  for(const entry of await readdir(path.join(root,relative),{withFileTypes:true})){
    if(entry.name==='.memory-locks')continue;
    const name=path.join(relative,entry.name);
    if(entry.isSymbolicLink())throw new Error(`Recovery refuses links: ${name}`);
    if(entry.isDirectory())out.push(...await files(root,name));
    else if(entry.isFile())out.push(name);
    else throw new Error(`Recovery refuses special files: ${name}`);
  }
  return out.sort();
};
const safeWrite = async (root,relative,bytes,{exclusive=true}={}) => {
  const file=inside(root,relative);
  let parent=path.dirname(file);
  while(parent!==path.resolve(root)){
    const info=await lstat(parent).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
    if(info&&(!info.isDirectory()||info.isSymbolicLink()))throw new Error(`Unsafe parent: ${parent}`);
    parent=path.dirname(parent);
  }
  await mkdir(path.dirname(file),{recursive:true});
  if(exclusive)await writeFile(file,bytes,{flag:'wx'});
  else {const tmp=file+`.recovery-${process.pid}.tmp`;await writeFile(tmp,bytes,{flag:'wx'});await rename(tmp,file);}
};
const retainedKeys=new Set(['origin','history_repair','text','raw_input','original','clause','prompt','question','message','description','title','name']);
const identityKeys=new Set(['id','project_id','session_id','project_key','projectId','sessionId']);
export const transformRecord = (value,{ids,paths},key='') => {
  if(retainedKeys.has(key))return value;
  if(typeof value==='string'){
    if(identityKeys.has(key)&&ids.has(value))return String(ids.get(value));
    // Only whole absolute path references are rebased, never substrings in
    // chat text, tool messages, prose, or provenance coordinates.
    for(const [from,to] of paths){
      const normalized=value.replaceAll('\\','/'), prefix=from.replaceAll('\\','/');
      if(normalized.toLowerCase()===prefix.toLowerCase())return to;
      if(normalized.toLowerCase().startsWith(prefix.toLowerCase()+'/'))return path.join(to,...normalized.slice(prefix.length+1).split('/'));
    }
    return value;
  }
  if(typeof value==='number')return identityKeys.has(key)&&ids.has(String(value))?ids.get(String(value)):value;
  if(Array.isArray(value))return value.map(item=>transformRecord(item,{ids,paths},key));
  if(!value||typeof value!=='object')return value;
  const out={};
  for(const [child,item] of Object.entries(value)){
    const nextKey=['sessions','fingerprints'].includes(key)&&ids.has(child)?String(ids.get(child)):child;
    out[nextKey]=transformRecord(item,{ids,paths},child);
  }
  if(value.version==='rab-session-index/v1')out.fingerprints={};
  return out;
};

export const prepareRecovery = async ({sourceHome,targetHome,recoveryId,sessionIds={},projectIds={},sourceAliases=[]}) => {
  assertNumericId(recoveryId);
  sourceHome=path.resolve(sourceHome);targetHome=path.resolve(targetHome);
  sourceAliases=[...new Set(sourceAliases.flatMap(value=>[path.resolve(value),canonical(value)]))];
  if(fold(sourceHome)===fold(targetHome))throw new Error('Source and destination must differ.');
  const backup=path.join(targetHome,'backups',String(recoveryId));
  if(await readMaybe(path.join(backup,'plan.json')))throw new Error('Recovery plan already exists.');
  const sourceFiles=await files(sourceHome), sourceBytes=new Map();
  for(const relative of sourceFiles)sourceBytes.set(relative,await readFile(inside(sourceHome,relative)));
  const sourceRoots=json(sourceBytes.get('project-roots.json'));
  const targetRootsBytes=await readFile(path.join(targetHome,'project-roots.json'));
  const targetRoots=json(targetRootsBytes), roots=structuredClone(targetRoots);
  roots.directories??={};
  const targetSettings=json(await readFile(path.join(targetHome,'settings.json')));
  const sourceSettings=json(sourceBytes.get('settings.json'));
  const mappings=[], paths=[], ids=new Map(Object.entries({...projectIds,...sessionIds}).map(([from,to])=>[from,assertNumericId(to)]));
  const targetProjects=await readdir(path.join(targetHome,'projects'),{withFileTypes:true});
  for(const next of Object.values(sessionIds)){
    for(const entry of targetProjects.filter(entry=>entry.isDirectory())){
      if(await readMaybe(path.join(targetHome,'projects',entry.name,'sessions',String(next),'state.json')))throw new Error(`Target session ID already exists: ${next}`);
    }
  }
  for(const [sourceRoot,oldId] of Object.entries(sourceRoots.roots)){
    const sourceDirectory=sourceRoots.directories?.[String(oldId)]??String(oldId);
    const node=json(sourceBytes.get(path.join('projects',sourceDirectory,'settings.json')));
    const id=projectIds[oldId]??oldId;
    const existing=Object.entries(roots.roots).find(([root])=>fold(root)===fold(sourceRoot));
    if(existing&&existing[1]!==id)throw new Error(`Explicit project mapping required for ${sourceRoot}`);
    const merged=Boolean(existing);
    const directory=merged?(roots.directories[String(id)]??String(id)):node.name;
    if(!directory||directory==='.'||directory==='..'||/[<>:"/\\|?*\x00-\x1f]/.test(directory)||/[. ]$/.test(directory))throw new Error(`Invalid project directory: ${directory}`);
    if(!merged&&(targetProjects.some(entry=>entry.name.toLowerCase()===directory.toLowerCase())||Object.values(roots.roots).includes(id)))throw new Error(`Target project collides: ${directory}/${id}`);
    const oldDirectory=path.join(sourceHome,'projects',sourceDirectory), nextDirectory=path.join(targetHome,'projects',directory);
    for(const home of [sourceHome,...sourceAliases])paths.push([path.join(home,'projects',sourceDirectory),nextDirectory]);
    const ownedRoot=[sourceHome,...sourceAliases].some(home=>fold(sourceRoot)===fold(path.join(home,'projects',sourceDirectory)));
    const nextRoot=ownedRoot?nextDirectory:node.meta.source_root;
    roots.roots[fold(nextRoot)]=id;roots.directories[String(id)]=directory;
    mappings.push({old_id:oldId,id,source_directory:sourceDirectory,directory,source_root:node.meta.source_root,root:nextRoot,merged});
  }
  // Session-qualified paths take precedence over their project prefixes.
  for(const mapping of mappings){
    for(const [oldId,nextId] of Object.entries(sessionIds))for(const kind of ['sessions','runs','receipts']){
      for(const home of [sourceHome,...sourceAliases])paths.unshift([path.join(home,'projects',mapping.source_directory,kind,oldId),path.join(targetHome,'projects',mapping.directory,kind,String(nextId))]);
    }
  }
  const operations=[],retained=[];
  const add=async(relative,bytes,{replace=false}={})=>{
    const prior=await readMaybe(inside(targetHome,relative));
    if(prior&&digest(prior)===digest(bytes))return;
    if(prior&&!replace)throw new Error(`Refusing to overwrite ${relative}`);
    operations.push({path:relative,before:prior?digest(prior):null,after:digest(bytes),bytes,prior});
  };
  for(const [relative,original] of sourceBytes){
    const parts=relative.split(path.sep);
    if(parts[0]!=='projects')continue;
    const mapping=mappings.find(item=>item.source_directory===parts[1]);
    if(!mapping)throw new Error(`Unregistered source project: ${relative}`);
    parts[1]=mapping.directory;
    if(['sessions','runs','receipts'].includes(parts[2])&&sessionIds[parts[3]])parts[3]=String(sessionIds[parts[3]]);
    const destination=parts.join(path.sep), prior=await readMaybe(inside(targetHome,destination));
    const historical=relative.includes('.before-history-repair.')||/^PROJECT_.*\.snapshot\.json$/.test(path.basename(relative));
    let bytes=original;
    if(!historical&&relative.endsWith('.json'))bytes=encode(transformRecord(json(original),{ids,paths}));
    else if(!historical&&relative.endsWith('.jsonl'))bytes=Buffer.from(original.toString('utf8').split(/\r?\n/).filter(Boolean).map(line=>JSON.stringify(transformRecord(JSON.parse(line),{ids,paths}))).join('\n')+'\n');
    if(mapping.merged&&prior){
      if(parts.length===3&&parts[2]==='RESOURCES.json'){
        const current=json(prior), imported=json(bytes), combined=structuredClone(current);
        for(const [kind,values] of Object.entries(imported))if(values&&typeof values==='object'&&!Array.isArray(values))combined[kind]={...values,...(current[kind]??{})};
        await add(destination,encode(combined),{replace:true});
      } else if(parts.length===3||destination.endsWith(path.join('telemetry','HEALTH.json')))retained.push({source:relative,destination,reason:'Existing project metadata retained; imported original archived.'});
      else throw new Error(`Merge needs explicit review: ${destination}`);
    }else await add(destination,bytes);
  }
  // Import old application requests into the current Global scope; retain the
  // original app descriptor, request bytes and submission receipt in backup.
  const requestPrefix=path.join('apps',String(sourceSettings.app_id),'requests')+path.sep;
  for(const [relative,bytes] of sourceBytes){
    if(!relative.startsWith(requestPrefix)||!relative.endsWith(path.sep+'settings.json'))continue;
    const node=json(bytes), current={...node,scope:'global',meta:{...node.meta,parent:{kind:'app',id:targetSettings.app_id}}};
    await add(path.join('feature-requests',String(node.id),'settings.json'),encode(current));
  }
  const submissionsPrefix=path.join('apps',String(sourceSettings.app_id),'submissions')+path.sep;
  for(const [relative,bytes] of sourceBytes)if(relative.startsWith(submissionsPrefix))await add(path.join('feature-requests','.submissions',path.basename(relative)),bytes);
  await add('project-roots.json',encode(roots),{replace:true});
  const plan={version:'rab-home-recovery/v1',sourceHome,targetHome,recoveryId,backup,sessionIds,projectIds,mappings,retained,source_manifest:[],operations:[]};
  for(const [relative,bytes] of sourceBytes){await safeWrite(backup,path.join('original',relative),bytes);plan.source_manifest.push({path:relative,sha256:digest(bytes)});}
  for(const op of operations){
    await safeWrite(backup,path.join('staged',op.path),op.bytes);
    if(op.prior)await safeWrite(backup,path.join('destination-before',op.path),op.prior);
    plan.operations.push({path:op.path,before:op.before,after:op.after});
  }
  await safeWrite(backup,'plan.json',encode(plan));
  return plan;
};

export const applyRecovery = async plan => withMemoryLock(path.join(plan.targetHome,'.memory-locks','project-registration'),async()=>{
  if(await readMaybe(path.join(plan.backup,'applied.json')))throw new Error('Recovery was already applied.');
  const currentFiles=await files(plan.sourceHome);
  if(JSON.stringify(currentFiles)!==JSON.stringify(plan.source_manifest.map(item=>item.path)))throw new Error('Source files changed after planning.');
  for(const item of plan.source_manifest)if(digest(await readFile(inside(plan.sourceHome,item.path)))!==item.sha256)throw new Error(`Source changed: ${item.path}`);
  for(const item of plan.operations){
    const current=await readMaybe(inside(plan.targetHome,item.path));
    if((current?digest(current):null)!==item.before)throw new Error(`Destination changed: ${item.path}`);
    if(digest(await readFile(inside(plan.backup,path.join('staged',item.path))))!==item.after)throw new Error(`Staged data changed: ${item.path}`);
  }
  const applied=[];
  try{
    // Registry is the final operation, so partial copies cannot be selected.
    for(const item of plan.operations){
      const bytes=await readFile(inside(plan.backup,path.join('staged',item.path)));
      await safeWrite(plan.targetHome,item.path,bytes,{exclusive:item.before===null});
      if(digest(await readFile(inside(plan.targetHome,item.path)))!==item.after)throw new Error(`Verification failed: ${item.path}`);
      applied.push(item.path);
    }
  }catch(error){await safeWrite(plan.backup,'interrupted.json',encode({applied,error:error.message}));throw error;}
  await safeWrite(plan.backup,'applied.json',encode({applied,verified:true,at:new Date().toISOString()}));
  return {backup:plan.backup,files:applied.length,sessionIds:plan.sessionIds,mappings:plan.mappings};
});

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [mode,input]=process.argv.slice(2), data=json(await readFile(input));
  if(mode==='prepare')console.log(JSON.stringify(await prepareRecovery(data),null,2));
  else if(mode==='apply')console.log(JSON.stringify(await applyRecovery(data),null,2));
  else throw new Error('Use prepare <config.json> or apply <plan.json>.');
}
