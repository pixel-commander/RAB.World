import path from 'node:path';
import os from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir, readdir, lstat, rename, unlink, rmdir, mkdtemp } from 'node:fs/promises';
import { absolute, separate, within, readJson, fail, text } from '../_review.mjs';
const exec = promisify(execFile);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value,null,2)+'\n';
const relative = value => {
  if (typeof value!=='string' || !value || value.includes('\\') || value.includes(':') || path.isAbsolute(value) || value.split('/').some(p=>!p||p==='.'||p==='..')) fail('INVALID_PATH','Expected a contained relative path.');
  return value;
};
const scan = async root => {
  const manifest={}, buffers=new Map(); let bytes=0;
  const walk=async (folder,prefix='')=>{
    for(const entry of (await readdir(folder,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))) {
      const name=relative(prefix+entry.name), full=path.join(folder,entry.name);
      if(entry.isSymbolicLink())fail('INVALID_PATH','Working copy cannot contain links: '+name);
      if(entry.isDirectory()) await walk(full,name+'/');
      else if(entry.isFile()) {
        if(Object.keys(manifest).length>=4096)fail('CAPTURE_LIMIT','Working copy exceeds 4096 files; narrow the package before capture.');
        const info=await lstat(full);if(bytes+info.size>32*1024*1024)fail('CAPTURE_LIMIT','Working copy exceeds 32 MiB; no files are silently excluded.');
        await absolute(full,'Working file');
        const buffer=await readFile(full);bytes+=buffer.length;
        if(bytes>32*1024*1024)fail('CAPTURE_LIMIT','Working copy grew beyond 32 MiB.');
        const sha256=hash(buffer);manifest[name]={sha256,bytes:buffer.length};buffers.set(sha256,buffer);
      } else fail('INVALID_PATH','Unsupported working entry: '+name);
    }
  };
  await walk(root);return {manifest,buffers};
};
const equal=(a,b)=>json(Object.entries(a).sort())===json(Object.entries(b).sort());
const loadObject=async (evidence,entry)=>{
  if(!entry||!/^[a-f0-9]{64}$/.test(entry.sha256)||!Number.isSafeInteger(entry.bytes))fail('CORRUPT_EVIDENCE','Invalid object reference.');
  const file=await absolute(path.join(evidence,'objects',entry.sha256),'Evidence object');
  const buffer=await readFile(file);
  if(buffer.length!==entry.bytes||hash(buffer)!==entry.sha256)fail('CORRUPT_EVIDENCE','Saved object does not match its hash.');
  return buffer;
};
const saveObjects=async (evidence,snapshot,helpers)=>{
  const destination=path.join(evidence,'objects');
  for(const [sha,buffer] of snapshot.buffers){
    const file=path.join(destination,sha);await absolute(file,'Evidence object');
    try {const previous=await readFile(file);if(hash(previous)!==sha)fail('CORRUPT_EVIDENCE','Existing content-addressed object is damaged.');}
    catch(error){if(error.code!=='ENOENT')throw error;await helpers.writeArtifactPlan({destination,allowedRoot:evidence,uniqueDirectory:false,files:[{path:sha,base64:buffer.toString('base64')}]});}
  }
};
const atomic=async (file,value)=>{
  await absolute(file,'Capture state');
  const temporary=file+'.'+randomUUID()+'.tmp';await writeFile(temporary,json(value),{flag:'wx'});await rename(temporary,file);
};
const readManifest=async (session,reference,evidence)=>{
  const manifest=await readJson(path.join(session,relative(reference)));
  for(const [name,entry] of Object.entries(manifest)){relative(name);await loadObject(evidence,entry);}
  return manifest;
};
const turns=async (round,refs)=>{
  if(!Array.isArray(refs))fail('INVALID_INPUT','source_turns must be an array.');
  for(const ref of refs){if(!/^turns\/turn-\d{3,}\.json$/.test(ref))fail('INVALID_INPUT','Turn reference must name a local turn file.');await readJson(path.join(round,ref));}
  return refs;
};
const diff=async (changed,before,after,evidence)=>{
  if(!changed.length)return '';
  const testRoot=path.join(os.homedir(),'.rab','temp','test');await mkdir(testRoot,{recursive:true});
  const scratch=await mkdtemp(path.join(testRoot,'review-diff-'));
  for(const side of ['before','after'])await mkdir(path.join(scratch,side));
  for(const name of changed)for(const [side,manifest] of [['before',before],['after',after]]){
    if(!manifest[name])continue;
    const full=path.join(scratch,side,name);await mkdir(path.dirname(full),{recursive:true});await writeFile(full,await loadObject(evidence,manifest[name]),{flag:'wx'});
  }
  let output;
  try {output=await exec('git',['-c','core.autocrlf=false','-c','core.quotePath=true','diff','--no-index','--no-ext-diff','--no-textconv','--binary','--no-renames','--','before','after'],{cwd:scratch,windowsHide:true,maxBuffer:64*1024*1024});}
  catch(error){if(error.code!==1)throw error;output=error;}
  return output.stdout;
};
export const run=async({options,helpers,tool})=>{
  const action=options.action;
  if(!['baseline','begin','finish','status'].includes(action))fail('INVALID_INPUT','Action must be baseline, begin, finish or status.');
  const session=await absolute(options.session,'Session',true);
  separate(path.resolve(tool.root,'..'),session);
  const settings=await readJson(path.join(session,'settings.json'));
  if(settings.kind!=='code-review-session'||settings.schema_version!==1)fail('INVALID_SESSION','Expected a code-review session.');
  const working=await absolute(settings.working_copy?.path,'Working copy',true);
  separate(session,working);
  const original=settings.original_source?.path;
  if(typeof original!=='string'||!path.isAbsolute(original))fail('INVALID_SESSION','Expected an absolute original-source reference.');
  separate(path.dirname(original.endsWith('.zip')?original:path.join(original,'file')),working);
  const evidence=await absolute(path.join(session,'evidence'),'Evidence directory');
  await mkdir(evidence,{recursive:true});
  const lock=await absolute(path.join(evidence,'.lock'),'Capture lock');
  try{await mkdir(lock);}catch(error){if(error.code==='EEXIST')fail('CAPTURE_BUSY','Another capture is running, or a failed process left a lock. Inspect before retrying.');throw error;}
  try{
    const stateFile=path.join(evidence,'state.json');
    let state=null;
    try{state=await readJson(stateFile);}catch(error){if(error.code!=='ENOENT')throw error;}
    if(action==='status')return {status:'inspected',state,working_copy:working};
    if(action==='baseline'){
      if(state)fail('EEXIST','A baseline already exists.');
      const snapshot=await scan(working);await saveObjects(evidence,snapshot,helpers);
      await helpers.writeArtifactPlan({destination:path.join(evidence,'baseline'),allowedRoot:evidence,files:[{path:'manifest.json',text:json(snapshot.manifest)},{path:'settings.json',text:json({schema_version:1,created_at:new Date().toISOString(),working_copy:working,scope:'all regular files; no exclusions',source_archive_sha256:settings.original_source.sha256??null})}]});
      await atomic(stateFile,{schema_version:1,head:'evidence/baseline/manifest.json',active:null});
      return {status:'captured',baseline:'evidence/baseline/manifest.json',files:Object.keys(snapshot.manifest).length};
    }
    if(!state)fail('BASELINE_REQUIRED','Capture the baseline before editing.');
    if(action==='begin'){
      if(state.active)fail('CHANGE_ACTIVE','Finish the active change before beginning another.');
      const before=await readManifest(session,state.head,evidence);
      const current=await scan(working);
      if(!equal(before,current.manifest))fail('UNTRACKED_CHANGE','Working copy changed outside capture. Nothing was silently accepted; preserve and reconcile it first.');
      const roundName=text(options.round,'Round');
      if(!/^round-\d{3,}$/.test(roundName))fail('INVALID_INPUT','Round must be round-NNN.');
      const round=await absolute(path.join(session,'rounds',roundName),'Round',true);
      const roundSettings=await readJson(path.join(round,'settings.json'));
      if(roundSettings.session_id!==settings.id)fail('INVALID_SESSION','Round belongs to another session.');
      const reason=text(options.reason,'Reason');
      const sourceTurns=await turns(round,options.source_turns??[]);
      const folder=await absolute(path.join(round,'changes'),'Changes');await mkdir(folder,{recursive:true});
      let max=0;
      for(const entry of await readdir(folder,{withFileTypes:true})){
        if(!entry.name.startsWith('change-'))continue;
        const match=/^change-(\d{3,})$/.exec(entry.name);const n=match?Number(match[1]):NaN;
        if(!Number.isSafeInteger(n)||n<1||!entry.isDirectory()||entry.isSymbolicLink()||entry.name!=='change-'+String(n).padStart(3,'0'))fail('INVALID_CHANGE','Malformed existing change entry.');
        max=Math.max(max,n);
      }
      const name='change-'+String(max+1).padStart(3,'0');
      const destination=path.join(folder,name);
      const record=await helpers.createItemSettings({name,title:reason,description:reason,settings:[],meta:{kind:'review-change'},indexed:false,schema_version:1,session_id:settings.id,round:roundName,source_turns:sourceTurns,created_at:new Date().toISOString(),before:state.head,status:'pending'});
      await helpers.writeArtifactPlan({destination,allowedRoot:folder,files:[{path:'settings.json',text:json(record)}]});
      const active=path.relative(session,destination).split(path.sep).join('/');
      await atomic(stateFile,{...state,active});
      return {status:'begun',change:active,before:state.head,reason};
    }
    if(!state.active)fail('NO_ACTIVE_CHANGE','Begin a change before editing.');
    const change=path.join(session,relative(state.active));await absolute(change,'Change',true);
    const record=await readJson(path.join(change,'settings.json'));
    const before=await readManifest(session,record.before,evidence);
    const after=await scan(working);
    const changed=[...new Set([...Object.keys(before),...Object.keys(after.manifest)])].sort().filter(name=>before[name]?.sha256!==after.manifest[name]?.sha256);
    const renames=options.renames??[];
    if(!Array.isArray(renames))fail('INVALID_INPUT','renames must be an array of {from,to}.');
    const renamed=new Set();
    for(const pair of renames){
      relative(pair.from);relative(pair.to);
      if(!before[pair.from]||after.manifest[pair.from]||before[pair.to]||!after.manifest[pair.to]||renamed.has(pair.from)||renamed.has(pair.to))fail('INVALID_INPUT','Rename must link unique deleted and created paths.');
      renamed.add(pair.from);renamed.add(pair.to);
    }
    await saveObjects(evidence,after,helpers);
    const changes=changed.map(file=>({file,operation:!before[file]?'created':!after.manifest[file]?'deleted':'modified',before:before[file]??null,after:after.manifest[file]??null}));
    const patch=await diff(changed,before,after.manifest,evidence);
    if(!equal(after.manifest,(await scan(working)).manifest))fail('WORKING_COPY_CHANGED','Working copy changed while capturing; retry finish after editing stops.');
    const done=await helpers.writeArtifactPlan({destination:path.join(change,'completed'),allowedRoot:change,files:[
      {path:'manifest.json',text:json(after.manifest)},
      {path:'changes.json',text:json({schema_version:1,change_id:record.id,captured_at:new Date().toISOString(),status:changed.length?'captured':'no_change',changes,renames,approval:null})},
      {path:'change.patch',text:patch},
      {path:'verification.json',text:json({status:'not_tested',checks:[],note:'Hash verification proves capture integrity, not correctness of the code.'})}
    ]});
    await atomic(stateFile,{...state,head:state.active+'/completed/manifest.json',active:null});
    return {status:'captured',change:state.active,changed_files:changes,renames,verification:done.verification};
  }finally{await rmdir(lock);}
};
