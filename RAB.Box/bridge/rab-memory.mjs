import {pathValue,withPathValue} from './project-paths.mjs';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { realpathSync, readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile, rename, lstat, readdir, realpath, stat, unlink, open as openFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { withMemoryLock } from './rab-memory-lock.mjs';
import { containedPath, insist } from '../engine/src/core.mjs';
import { compactReceipt, jsonBytes, packToolReport, pointerKey, resultReference } from './tool-tracking.mjs';
import { assertNumericId, reserveObservedIds, validateIdState, enrollNumericIds } from './rab-id.mjs';
import { makeNode,assertNode } from './rab-node.mjs';
import { createFolderRecords } from './rab-folder-records.mjs';

const safe = value => String(value ?? 'project').replace(/[^A-Za-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80) || 'project';
const hash = value => createHash('sha256').update(String(value)).digest('hex').slice(0,12);
const jsonRead = async file => JSON.parse(await readFile(file,'utf8'));
const atomicJson = async (file,data) => {
  await mkdir(path.dirname(file),{recursive:true});
  const tmp=`${file}.${process.pid}.${randomBytes(3).toString('hex')}.tmp`;
  try {
    const handle=await openFile(tmp,'wx');
    try { await handle.writeFile(JSON.stringify(data,null,2)+'\n','utf8'); await handle.sync(); }
    finally { await handle.close(); }
    for(let attempt=0;;attempt++){
      try{await rename(tmp,file);break;}
      catch(error){
        if(!['EPERM','EACCES','EBUSY'].includes(error.code)||attempt>=7)throw error;
        await delay(Math.min(10*2**attempt,160));
      }
    }
  } catch(error) {
    try{await unlink(tmp);}catch(cleanup){if(cleanup.code!=='ENOENT')error.cleanup_error={code:cleanup.code,message:cleanup.message};}
    throw error;
  }
};
const exists = async file => { try { await lstat(file); return true; } catch (e) { if(e.code==='ENOENT') return false; throw e; } };
const canonicalPath = value => {
  const absolute=path.resolve(value);
  try{return realpathSync.native(absolute);}catch(error){
    if(error.code!=='ENOENT')throw error;
    const parent=path.dirname(absolute);
    if(parent===absolute)throw error;
    return path.join(canonicalPath(parent),path.basename(absolute));
  }
};

const recordFolderName = (name, kind = 'Project') => {
  if(typeof name!=='string'||!name.trim()||name.length>255||/[<>:"/\\|?*\x00-\x1f]/.test(name)||/[. ]$/.test(name)||/^(\.{1,2}|con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name))
    throw Object.assign(new Error(`${kind} name must be one valid folder name.`),{code:'BAD_REQUEST',field:'name'});
  return name;
};
const projectFolderName = name => recordFolderName(name);

export const userRabHome = () => path.join(os.homedir(),'.rab');
export const defaultRabHome = () => process.env.RAB_HOME ? path.resolve(process.env.RAB_HOME) : userRabHome();

export const createRabMemory = ({ rabHome = defaultRabHome() } = {}) => {
  rabHome=canonicalPath(rabHome);
  const rootsFile=path.join(rabHome,'project-roots.json');
  const rootKey=meta=>{ const value=canonicalPath(meta.root); return process.platform==='win32'?value.toLowerCase():value; };
  const readRoots=()=>{try{return JSON.parse(readFileSync(rootsFile,'utf8'));}catch(error){if(error.code==='ENOENT')return {version:'rab-project-roots/v1',roots:{}};throw error;}};
  const allocateIds=async(count=1)=>withMemoryLock(path.join(rabHome,'.memory-locks','ids'),async()=>{
    const file=path.join(rabHome,'id-state.json');
    let state;
    try { state=await jsonRead(file); validateIdState(state); }
    catch(error){
      if(error.code!=='ENOENT')throw error;
      const roots=readRoots();
      insist(!Object.keys(roots.roots??{}).length&&!Object.keys(roots.directories??{}).length,'BAD_ID_STATE','ID reservation state is missing from initialized storage.');
      const home=await jsonRead(path.join(rabHome,'settings.json')).catch(e=>{if(e.code==='ENOENT')return {};throw e;});
      insist(!home.app_id,'BAD_ID_STATE','ID reservation state is missing from initialized application storage.');
      for(const collection of ['projects','worlds','apps','feature-requests']){
        const entries=await readdir(path.join(rabHome,collection),{withFileTypes:true}).catch(e=>{if(e.code==='ENOENT')return [];throw e;});
        insist(!entries.some(e=>e.isDirectory()&&/^\d+$/.test(e.name)),'BAD_ID_STATE','ID reservation state is missing while numeric records exist.');
        if(['projects','worlds'].includes(collection))for(const entry of entries.filter(e=>e.isDirectory()&&!e.isSymbolicLink())){
          const node=await jsonRead(path.join(rabHome,collection,entry.name,'settings.json')).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
          insist(node?.version!=='rab-node/v1'||!['project','world'].includes(node?.meta?.kind),'BAD_ID_STATE','ID reservation state is missing while saved projects or worlds exist.');
        }
      }
      state={version:'rab-ids/v2',reserved:[]};
    }
    const reserved=await reserveObservedIds({state,count});
    await atomicJson(file,reserved.state);
    return reserved.ids;
  });
  const allocateId=async()=> (await allocateIds(1))[0];
  const enrollId=async id=>withMemoryLock(path.join(rabHome,'.memory-locks','ids'),async()=>{
    const file=path.join(rabHome,'id-state.json');
    const state=await jsonRead(file);
    await atomicJson(file,enrollNumericIds(state,Array.isArray(id)?id:[id]));
  });
  const ensureHome = async () => withMemoryLock(path.join(rabHome,'.memory-locks','home'),async () => {
    for (const dir of ['', 'projects','apps','temp','failures','training','language']) await mkdir(path.join(rabHome,dir),{recursive:true});
    const settings=path.join(rabHome,'settings.json');
    if (!await exists(settings)) await atomicJson(settings,{version:'0.8',created_at:new Date().toISOString(),note:'Delete .rab to reset Magic Box-owned memory. Project source files are not owned here.'});
    return rabHome;
  });
  const newProjectPath = name => path.join(rabHome,'projects',projectFolderName(name));
  const newWorldPath = name => path.join(rabHome,'worlds',recordFolderName(name,'World'));
  const ownedProjectKey = ({root}) => {
    const absolute=canonicalPath(root);
    return path.relative(canonicalPath(path.join(rabHome,'projects')),path.dirname(absolute))===''?path.basename(absolute):null;
  };
  const projectKey = meta => {
    const id=readRoots().roots[rootKey(meta)]??(Number.isSafeInteger(meta.id)?meta.id:null);
    assertNumericId(id);
    return String(id);
  };
  // Keep identity independent of the human-readable storage directory. Existing
  // numeric folders have no directories entry and remain at their original path.
  const directoryForId = (id,roots=readRoots()) => newProjectPath(roots.directories?.[String(assertNumericId(id))]??String(id));
  const projectDir = meta => {
    const roots=readRoots(),id=Number(projectKey(meta));
    // Read-only report inspection can precede registration for a project whose
    // source already is its app-owned memory folder. It must not initialize it.
    const owned=roots.roots[rootKey(meta)]===undefined&&!roots.directories?.[String(id)]?ownedProjectKey(meta):null;
    return owned?newProjectPath(owned):directoryForId(id,roots);
  };
  const readProjectSettings = async meta => {
    const saved=await jsonRead(path.join(projectDir(meta),'settings.json'));
    assertNode(saved);
    insist(saved.meta.kind==='project'&&saved.id===Number(projectKey(meta))&&rootKey({root:saved.meta.source_root})===rootKey(meta),'BAD_PROJECT','Saved project settings do not match the selected project.');
    return saved;
  };
  const failureDir = meta => path.join(projectDir(meta),'failures');

  const registerProject=async (meta,writeSource)=>{
    insist(meta&&typeof meta.root==='string'&&path.isAbsolute(meta.root),'BAD_PROJECT','Project needs an absolute source root.');
    await ensureHome();
    return withMemoryLock(path.join(rabHome,'.memory-locks','project-registration'),async()=>{
      const roots=readRoots(), sourceRoot=canonicalPath(meta.root), key=rootKey(meta);
      let id=roots.roots[key];
      if(id!==undefined){
        assertNumericId(id);
        insist(!writeSource,'EEXIST','Project is already registered. Load it or choose a different name.');
        return id;
      }
      // Source manifests are inputs, not saved-session compatibility. Register a
      // fresh numeric identity without rewriting an external source manifest.
      id=Number.isSafeInteger(meta.id)&&meta.id>0?meta.id:await allocateId();
      if(Number.isSafeInteger(meta.id)){await allocateId();await enrollId(id);}
      let source={};try{source=await jsonRead(path.join(sourceRoot,'settings.json'));}catch(error){if(error.code!=='ENOENT')throw error;}
      const name=projectFolderName(String(meta.name??source.name??path.basename(sourceRoot)));
      const owned=ownedProjectKey(meta);
      const directory=await containedPath(rabHome,path.join('projects',owned??name),{allowMissing:true}), file=path.join(directory,'settings.json');
      insist(!Object.entries(roots.roots).some(([otherRoot,otherId])=>otherId===id&&otherRoot!==key),'PROJECT_ID_CONFLICT','Project ID is already registered to another source.');
      const fold=value=>value.toLowerCase();
      const taken=(await readdir(path.join(rabHome,'projects'))).find(entry=>fold(entry)===fold(path.basename(directory)));
      const sameSource=rootKey({root:directory})===key;
      if(taken&&(!sameSource||taken!==path.basename(directory)))throw Object.assign(new Error(`Project folder already exists: ${newProjectPath(taken)}. Load that project or choose a different name.`),{code:'EEXIST',field:'name'});
      // A numeric ID can also be the literal project name. Do not let it alias
      // an older ID-addressed record, even if the directory is currently absent.
      insist(!Object.values(roots.roots).some(otherId=>otherId!==id&&fold(path.basename(directoryForId(otherId,roots)))===fold(path.basename(directory))),'PROJECT_NAME_CONFLICT','Project name is already reserved by another project.');
      if(await exists(file)){
        const prior=await jsonRead(file);
        insist((prior.id===undefined||prior.id===id)&&rootKey({root:prior.meta?.source_root??directory})===key,'PROJECT_ID_CONFLICT','Project ID is already registered to another source.');
      }
      // New project stamps hold this same registration lock through their write,
      // so two different source folders cannot both claim the same project name.
      let written;
      if(writeSource){written=await writeSource();source=await jsonRead(path.join(sourceRoot,'settings.json'));}
      if(writeSource&&sameSource){
        // The stamp already wrote and verified this descriptor. Preserve its
        // extension fields and exact bytes instead of replacing its own output.
        makeNode(source);
        insist(source.id===id&&source.name===name&&source.meta.kind==='project'&&rootKey({root:source.meta.source_root})===key,'BAD_PROJECT','Stamped project descriptor does not match its registration.');
      }else{
        const node=makeNode({id,name,title:String(source.title??meta.name??source.name??id),description:source.description??'Local project',settings:Array.isArray(source.settings)?source.settings:[],meta:{kind:'project',source_root:sourceRoot},type:source.type??'base',paths:source.paths??{}});
        await atomicJson(file,node);
      }
      roots.roots[key]=id;
      roots.directories??={};roots.directories[String(id)]=path.basename(directory);
      await atomicJson(rootsFile,roots);
      return writeSource?written:id;
    });
  };

  const openProject = async meta => {
    await ensureHome();
    const key=projectKey(meta), dir=projectDir(meta);
    for (const sub of ['', 'runs','receipts','sessions','indexes']) await mkdir(path.join(dir,sub),{recursive:true});
    await mkdir(failureDir(meta),{recursive:true});
    const projectFile=path.join(dir,'PROJECT.json');
    let priorProject={};
    if(await exists(projectFile))priorProject=await jsonRead(projectFile);
    const opened={...priorProject,version:'rab-project-state/v1',project_key:key,project_id:Number(key),project_name:meta.name??String(meta.id),project_root:path.resolve(meta.root),paths:priorProject.paths??{},last_opened:new Date().toISOString()};
    await atomicJson(projectFile,opened);
    const sourceSettings=path.join(meta.root,'settings.json');
    let projectSettings=null;
    if (await exists(sourceSettings)) {
      try {
        const stat=await lstat(sourceSettings);
        if (stat.isFile() && stat.size <= 1024*1024) {
          projectSettings=await jsonRead(sourceSettings);
          await atomicJson(path.join(dir,'PROJECT_SETTINGS.snapshot.json'),{copied_at:new Date().toISOString(),source:sourceSettings,value:projectSettings});
        }
      } catch (error) {
        await atomicJson(path.join(dir,'PROJECT_SETTINGS.error.json'),{at:new Date().toISOString(),source:sourceSettings,message:error.message});
      }
    }
    // Keep an inspectable Box-owned snapshot of the project's capability/path manifest too.
    // This is memory/provenance only: runtime authority still comes from re-reading the project.
    const sourcePaths=path.join(meta.root,'PATHS.json');
    if (await exists(sourcePaths)) {
      try {
        const stat=await lstat(sourcePaths);
        if (stat.isFile() && stat.size <= 1024*1024) {
          const projectPaths=await jsonRead(sourcePaths);
          await atomicJson(path.join(dir,'PROJECT_PATHS.snapshot.json'),{copied_at:new Date().toISOString(),source:sourcePaths,value:projectPaths});
        }
      } catch (error) {
        await atomicJson(path.join(dir,'PROJECT_PATHS.error.json'),{at:new Date().toISOString(),source:sourcePaths,message:error.message});
      }
    }
    const resourcesFile=path.join(dir,'RESOURCES.json');
    if (!await exists(resourcesFile)) await atomicJson(resourcesFile,{version:'0.8',components:{},atoms:{},pages:{},projects:{},other:{}});
    const factsFile=path.join(dir,'FACTS.json');
    if (!await exists(factsFile)) await atomicJson(factsFile,{version:'0.8.3-facts',facts:{}});
    const aliasesFile=path.join(dir,'ALIASES.json');
    if (!await exists(aliasesFile)) await atomicJson(aliasesFile,{version:'0.8',entries:[]});
    const memoryFile=path.join(dir,'MEMORY.txt');
    if (!await exists(memoryFile)) await writeFile(memoryFile,'RRAABBIITT Magic Box project memory.\nOnly reviewed durable facts belong here.\n','utf8');
    if(projectSettings?.type&&opened.project_type!==projectSettings.type){opened.project_type=projectSettings.type;await atomicJson(projectFile,opened);}
    return {key,dir,projectSettings:await readProjectSettings(meta),meta:opened};
  };

  const loadResources = async meta => {
    const p=await openProject(meta); return jsonRead(path.join(p.dir,'RESOURCES.json'));
  };
  const saveResources = async (meta,data) => {
    const p=await openProject(meta); await atomicJson(path.join(p.dir,'RESOURCES.json'),data); return data;
  };
  const addResource = async (meta,resource) => {
    const data=await loadResources(meta); const bucket=resource.type==='component'?'components':resource.type==='atom'?'atoms':resource.type==='page'?'pages':resource.type==='project'?'projects':'other';
    data[bucket] ??={}; data[bucket][resource.name]={...resource,updated_at:new Date().toISOString()}; await saveResources(meta,data); return data[bucket][resource.name];
  };
  const knownEntities = async meta => {
    const data=await loadResources(meta); return Object.entries(data).flatMap(([bucket,items])=>Object.values(items??{}).map(x=>({...x,bucket})));
  };
  const loadFacts = async meta => { const p=await openProject(meta); return jsonRead(path.join(p.dir,'FACTS.json')); };
  const saveFacts = async (meta,data) => { const p=await openProject(meta); await atomicJson(path.join(p.dir,'FACTS.json'),data); return data; };
  const setFact = async (meta,key,value,{source='tool'}={}) => {
    const data=await loadFacts(meta); data.facts??={}; data.facts[key]={value,source,updated_at:new Date().toISOString()}; await saveFacts(meta,data); return data.facts[key];
  };
  const getFact = async (meta,key) => (await loadFacts(meta)).facts?.[key]??null;
  const setProjectPath = async (meta,key,value,{source='tool',description,types,expected}={}) => {
    insist(typeof key==='string'&&/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(key)&&!['__proto__','prototype','constructor'].includes(key),'BAD_REQUEST','Invalid project path key.');
    insist(typeof value==='string'||typeof value==='boolean'||typeof value==='number','BAD_REQUEST','Project path value must be text, boolean or number.');
    if(description!==undefined)insist(typeof description==='string'&&description.length<=4000,'BAD_REQUEST','Path description must be short text.');
    if(types!==undefined)insist(Array.isArray(types)&&types.length<=50&&types.every(type=>typeof type==='string'&&type.trim()&&type.length<=100),'BAD_REQUEST','Path types must be short nonempty names.');
    const file=path.join(projectDir(meta),'settings.json'), data=await readProjectSettings(meta);
    data.paths??={};
    if(expected!==undefined)insist(JSON.stringify(data.paths[key]??null)===JSON.stringify(expected),'STALE_REVISION','This path changed. Refresh before saving.');
    const entry=withPathValue(data.paths[key],value);
    if(description!==undefined)entry.description=description;
    if(types!==undefined)entry.types=[...new Set(types.map(type=>type.trim()))];
    entry.source=source;entry.updated_at=new Date().toISOString();
    data.paths[key]=entry;assertNode(data);await atomicJson(file,data);
    return {value:entry.path,source:entry.source,updated_at:entry.updated_at,...entry};
  };
  const getProjectPath = async (meta,key) => {
    const data=await readProjectSettings(meta), entry=data.paths?.[key];
    if(entry===undefined)return null;
    const value=entry&&typeof entry==='object'&&!Array.isArray(entry)?entry.path:entry;
    return {value,source:entry?.source??'project-settings',updated_at:entry?.updated_at??null,...(entry&&typeof entry==='object'&&!Array.isArray(entry)?entry:{})};
  };
  const validateAuditFolder = async value => {
    if(typeof value!=='string'||!value.trim()||!path.isAbsolute(value))throw new Error('The audit path must be absolute.');
    const folder=await realpath(value);
    if(!(await stat(folder)).isDirectory())throw new Error('The audit path must name an existing directory.');
    const relative=path.relative(rabHome,folder);
    if(relative===''||(!relative.startsWith(`..${path.sep}`)&&relative!=='..'&&!path.isAbsolute(relative)))throw new Error('The audit input must be outside .rab storage.');
    return folder;
  };
  const requireAuditFolder = async meta => {
    try {
      await registerProject(meta);
      const settings=await readProjectSettings(meta);
      return await validateAuditFolder(pathValue(settings.paths?.folder));
    } catch(error) {
      throw Object.assign(new Error(`Audit project needs a valid settings.json paths.folder before tools can run: ${error.message}`),{code:'AUDIT_PATH_REQUIRED',field:'folder'});
    }
  };
  const removeProjectPath = async (meta,key,{source='tool'}={}) => {
    const file=path.join(projectDir(meta),'settings.json'),data=await readProjectSettings(meta),removed=Boolean(data.paths&&Object.hasOwn(data.paths,key));
    if(removed){delete data.paths[key];data.last_path_change={key,source,operation:'remove',updated_at:new Date().toISOString()};assertNode(data);await atomicJson(file,data);}return {removed};
  };

  const sessionFile = (meta,id) => path.join(projectDir(meta),'sessions',String(assertNumericId(id)),'state.json');
  const initialBag=async meta=>{
    const settings=await readProjectSettings(meta);
    const audit=settings.type==='audit'?{scanRoot:pathValue(settings.paths?.folder),projectName:meta.name??String(meta.id),workingRoot:await containedPath(projectDir(meta),pathValue(settings.paths?.results)??'audit-results',{allowMissing:true})}:{workingRoot:null,projectName:null};
    return {domain:settings.type==='audit'?'audit':null,project:{id:Number(projectKey(meta)),name:meta.name??String(meta.id),root:path.resolve(meta.root)},projectSettings:settings,audit,currentTarget:null,addressStack:[],paths:settings.paths??{}};
  };
  const sessionFields = options => {
    insist(options&&typeof options==='object'&&!Array.isArray(options),'BAD_REQUEST','Session fields are required.');
    insist(typeof options.name==='string'&&options.name.trim().length>0&&options.name.trim().length<=120,'SESSION_NAME_REQUIRED','Enter a session name (1–120 characters).');
    const name=options.name.trim(),title=options.title??name,description=options.description??'';
    insist(typeof title==='string'&&title.trim().length>0&&title.length<=240&&typeof description==='string'&&description.length<=20000,'BAD_REQUEST','Session title or description is invalid.');
    return {name,title:title.trim(),description};
  };
  const createSession = async (meta,options) => {
    // No-options is retained for internal integrations; user-facing entry points
    // must pass an options object, whose name is always required.
    const fields=options===undefined?null:sessionFields(options);
    const p=await openProject(meta); const id=await allocateId();
    const identity=fields??{name:`session-${id}`,title:'New session',description:'Saved project work'};
    const session={version:'rab-session/v1',id,...identity,revision:1,project_key:p.key,created_at:new Date().toISOString(),updated_at:new Date().toISOString(),bag:await initialBag(meta),groups:[],steps:[],turns:[],status:'open'};
    await atomicJson(path.join(path.dirname(sessionFile(meta,id)),'settings.json'),makeNode({id,...identity,meta:{kind:'session',parent:{kind:'project',id:Number(p.key)}}}));
    await atomicJson(sessionFile(meta,id),session);
    await writeSessionIndex(meta,session); return session;
  };
  const saveToolResult = async (meta,output,{sessionId=null,stepId=null}={}) => {
    if(String(output.authority??'read').toLowerCase()!=='read')return null;
    const p=await openProject(meta);
    if(p.projectSettings?.type!=='audit')return null;
    const relative=path.join(pathValue(p.projectSettings.paths?.results)??'audit-results',safe(sessionId??'tool-runs'),`${output.execution?.execution_id??await allocateId()}.json`);
    const file=await containedPath(p.dir,relative,{allowMissing:true});
    const {report,pointers}=packToolReport(output);
    await atomicJson(file,{version:'audit-result/v1',project_id:meta.id,session_id:sessionId,step_id:stepId,execution_id:output.execution?.execution_id??null,saved_at:new Date().toISOString(),...report});
    for(const task of output.tasks??[]){
      const pointer=pointers.get(task.execution.execution_id);
      task.execution.result_ref=pointer?resultReference(file,pointer):null;
    }
    output.stored_seats=Object.fromEntries(Object.entries(output.seats??{}).map(([key,value])=>[key,(value&&typeof value==='object')||jsonBytes(value)>2048?resultReference(file,`#/seats/${pointerKey(key)}`):value]));
    return file;
  };
  const saveToolExecution = async (meta,execution) => {
    const relative=path.join('runs',safe(execution.session_id??'tool-runs'),`${safe(execution.execution_id)}.json`);
    const file=await containedPath(projectDir(meta),relative,{allowMissing:true});
    await atomicJson(file,execution);
    return file;
  };
  // Read an existing report envelope without opening/initializing project memory.
  // Reports are immutable snapshots; do not discard failure/task metadata here.
  const loadToolReport = async (meta,file) => {
    insist(typeof file==='string'&&file.length>0,'INVALID_PATH','Report file is required.');
    const root=await realpath(projectDir(meta));
    const relative=path.isAbsolute(file)?path.relative(root,file):file;
    const candidate=await containedPath(root,relative);
    const resolved=await realpath(candidate);
    const inside=path.relative(root,resolved);
    insist(inside!==''&&inside!=='..'&&!inside.startsWith('..'+path.sep)&&!path.isAbsolute(inside),'INVALID_PATH','Report must stay inside the selected memory project.');
    const handle=await openFile(resolved,'r');
    try{
      const max=32*1024*1024,info=await handle.stat();
      insist(info.isFile(),'BAD_REPORT','Report must be a regular file.');
      insist(info.size<=max,'REPORT_TOO_LARGE','Report exceeds 32 MiB.');
      const chunks=[];let total=0;
      // Bound the actual read too, in case another process grows the file.
      while(true){
        const buffer=Buffer.alloc(Math.min(64*1024,max-total+1));
        const {bytesRead}=await handle.read(buffer,0,buffer.length,null);
        if(!bytesRead)break;
        total+=bytesRead;
        insist(total<=max,'REPORT_TOO_LARGE','Report exceeds 32 MiB.');
        chunks.push(buffer.subarray(0,bytesRead));
      }
      let envelope;
      try{envelope=JSON.parse(Buffer.concat(chunks,total).toString('utf8'));}
      catch(error){throw Object.assign(new Error('Report is not valid JSON.',{cause:error}),{code:'BAD_REPORT'});}
      insist(envelope&&typeof envelope==='object'&&!Array.isArray(envelope)&&envelope.version==='audit-result/v1','BAD_REPORT','Unsupported audit report envelope.');
      insist(envelope.project_id===meta.id,'WRONG_PROJECT','Report belongs to another project.');
      return envelope;
    }finally{await handle.close();}
  };
  const loadToolExecution = async (meta,sessionId,executionId) => {
    const file=await containedPath(projectDir(meta),path.join('runs',safe(sessionId??'tool-runs'),`${safe(executionId)}.json`));
    return jsonRead(file);
  };
  const resolveToolValue = async (meta,value) => {
    if(value?.version!=='tool-result-ref/v1')return value;
    const file=await containedPath(projectDir(meta),path.relative(projectDir(meta),value.file));
    const report=await jsonRead(file);
    const active=new Set();
    const at=pointer=>{
      if(typeof pointer!=='string'||!pointer.startsWith('#/'))throw new Error('Invalid tool result pointer.');
      if(active.has(pointer))throw new Error('Circular tool result reference.');
      active.add(pointer);
      let current=report;
      for(const token of pointer.slice(2).split('/')){
        const key=token.replaceAll('~1','/').replaceAll('~0','~');
        if(current===null||typeof current!=='object'||!Object.hasOwn(current,key))throw new Error('Tool result reference was not found.');
        current=current[key];
      }
      const resolved=unpack(current);
      active.delete(pointer);
      return resolved;
    };
    const unpack=item=>{
      if(!item||typeof item!=='object')return item;
      if(Object.keys(item).length===1&&typeof item.$ref==='string')return at(item.$ref);
      return Array.isArray(item)?item.map(unpack):Object.fromEntries(Object.entries(item).map(([key,child])=>[key,unpack(child)]));
    };
    return at(value.pointer);
  };
  const loadSession = async (meta,id) => { const session=await jsonRead(sessionFile(meta,id)); insist(session.version==='rab-session/v1'&&session.id===id&&session.project_key===projectKey(meta),'BAD_SESSION','Unsupported or mismatched saved session.');return session; };
  const saveSession = async (meta,session) => {
    const current=await loadSession(meta,session.id);
    insist(current.revision===session.revision,'SESSION_CONFLICT','This session changed in another window. Reload before continuing.');
    session.revision+=1;
    session.updated_at=new Date().toISOString();
    const stored={...session,steps:(session.steps??[]).map(step=>step.receipt?{...step,receipt:compactReceipt(step.receipt)}:step)};
    await atomicJson(sessionFile(meta,session.id),stored);
    await writeSessionIndex(meta,session); return session;
  };
  const sessionIndexFile=meta=>path.join(projectDir(meta),'sessions.json');
  const sessionSummary=async(meta,s)=>{
    let descriptor=null;
    if(typeof s.name!=='string'||!s.name.trim()){
      try{
        descriptor=await jsonRead(path.join(path.dirname(sessionFile(meta,s.id)),'settings.json'));
        insist(descriptor.version==='rab-node/v1'&&descriptor.id===s.id&&descriptor.meta?.kind==='session'&&descriptor.meta?.parent?.id===Number(projectKey(meta)),'BAD_SESSION','Mismatched session descriptor.');
      }catch(error){if(error.code!=='ENOENT')throw error;}
    }
    const identity=typeof s.name==='string'&&s.name.trim()?s:descriptor;
    return {id:s.id,name:identity?.name??`session-${s.id}`,title:identity?.title??identity?.name??`Session ${s.id}`,description:identity?.description??'',metadata_source:identity===s?'session-state':descriptor?'session-descriptor':'legacy-fallback',revision:s.revision,created_at:s.created_at??null,updated_at:s.updated_at??null,status:s.status??'unknown',turns:s.turns?.length??0,steps:s.steps?.length??0,groups:s.groups?.length??0,domain:s.bag?.domain??null};
  };
  const collectSessions = async (meta,{useCache=true}={}) => {
    const dir=path.join(projectDir(meta),'sessions');
    let cached=null;
    if(useCache)try{
      const index=await jsonRead(sessionIndexFile(meta));
      if(index.version==='rab-session-index/v1'&&index.project_id===Number(projectKey(meta))&&index.sessions&&typeof index.sessions==='object'&&!Array.isArray(index.sessions))cached=index;
    }catch(error){if(error.code!=='ENOENT'&&!(error instanceof SyntaxError))throw error;}
    const files=(await readdir(dir,{withFileTypes:true}).catch(error=>{if(error.code==='ENOENT')return [];throw error;})).filter(x=>x.isDirectory()&&!x.isSymbolicLink()&&/^\d+$/.test(x.name));
    const sessions={},fingerprints={};
    for(const f of files){
      const id=assertNumericId(Number(f.name));
      const file=await containedPath(projectDir(meta),path.relative(projectDir(meta),sessionFile(meta,id)));
      const info=await stat(file),fingerprint={mtime_ms:info.mtimeMs,size:info.size};
      const prior=cached?.fingerprints?.[f.name],summary=cached?.sessions?.[f.name];
      // Old, added, removed, or interrupted saves remain discoverable without
      // mutating storage during listing. Only state-backed metadata is cached.
      sessions[f.name]=summary?.id===id&&summary.metadata_source==='session-state'&&prior?.mtime_ms===fingerprint.mtime_ms&&prior?.size===fingerprint.size?summary:await sessionSummary(meta,await loadSession(meta,id));
      fingerprints[f.name]=fingerprint;
    }
    return {version:'rab-session-index/v1',project_id:Number(projectKey(meta)),sessions,fingerprints};
  };
  const writeSessionIndex=async(meta,session)=>{
    try{await atomicJson(sessionIndexFile(meta),{...await collectSessions(meta),updated_at:new Date().toISOString()});}
    catch(error){throw Object.assign(new Error('Session was saved, but its project session index could not be refreshed.',{cause:error}),{code:'SESSION_INDEX_WRITE_FAILED',session_saved:true,session_id:session.id});}
  };
  const listSessions = async meta => Object.values((await collectSessions(meta)).sessions).sort((a,b)=>(Date.parse(b.updated_at)||0)-(Date.parse(a.updated_at)||0)||b.id-a.id);
  const recordFailure = async (meta,payload) => {
    await openProject(meta); const id=await allocateId(); const file=path.join(failureDir(meta),`${id}.json`); const record={...payload,version:'rab-failure/v1',id,at:new Date().toISOString(),project_key:projectKey(meta)}; await atomicJson(file,record); return {id,file};
  };
  const resolveFailure = async (meta,id,resolution) => {
    const file=path.join(failureDir(meta),`${safe(id)}.json`); const record=await jsonRead(file); record.resolution={at:new Date().toISOString(),...resolution}; await atomicJson(file,record); return record;
  };
  const paths = meta => ({home:rabHome,project:projectDir(meta),failures:failureDir(meta),training:path.join(rabHome,'training')});
  const workbenchRunsDirectory = async (meta,{create=false}={}) => {
    if(create)await registerProject(meta);
    else if(readRoots().roots[rootKey(meta)]===undefined)return null;
    return containedPath(rabHome,path.relative(rabHome,path.join(projectDir(meta),'runs','workbench')),{allowMissing:true});
  };
  const readProject=async id=>{
    const directory=await containedPath(rabHome,path.relative(rabHome,directoryForId(id)));
    const project=await jsonRead(path.join(directory,'settings.json'));
    insist(project.version==='rab-node/v1'&&project.id===id&&project.meta?.kind==='project','BAD_PROJECT','Project is not a current-format record.');
    return project;
  };
  const projectManifestFile=path.join(rabHome,'projects','manifest.json');
  const readProjectManifest=async()=>{
    let manifest;
    try{manifest=await jsonRead(projectManifestFile);}catch(error){if(error.code!=='ENOENT')throw error;manifest={};}
    insist(manifest!==null&&typeof manifest==='object'&&!Array.isArray(manifest),'BAD_PROJECT_MANIFEST','Project manifest must be an ID-keyed object.');
    return manifest;
  };
  const addProjectToManifest=async meta=>{
    const id=Number(projectKey(meta));
    const project=await readProject(id);
    assertNode(project);
    const entry={id:project.id,name:project.name,title:project.title,description:project.description};
    return withMemoryLock(path.join(rabHome,'.memory-locks','projects-manifest'),async()=>{
      const manifest=await readProjectManifest();
      const key=String(id);
      if(Object.hasOwn(manifest,key)){
        insist(JSON.stringify(manifest[key])===JSON.stringify(entry),'PROJECT_MANIFEST_CONFLICT',`Project manifest entry ${key} differs from the saved project settings.`);
        return {file:projectManifestFile,entry,created:false};
      }
      manifest[key]=entry;
      await atomicJson(projectManifestFile,manifest);
      return {file:projectManifestFile,entry,created:true};
    });
  };
  const findProjectsInManifest=async query=>{
    const searched=String(query??'').trim(), q=searched.toLowerCase();
    if(!q)return {items:[],unavailable:[]};
    const manifest=await readProjectManifest();
    const values=entry=>[entry?.name,entry?.title,entry?.description].filter(value=>typeof value==='string').map(value=>value.toLowerCase());
    let selected;
    if(/^\d+$/.test(searched))selected=Object.hasOwn(manifest,searched)?[[searched,manifest[searched]]]:[];
    else{
      const entries=Object.entries(manifest);
      const exact=entries.filter(([,entry])=>values(entry).includes(q));
      selected=exact.length?exact:entries.filter(([,entry])=>values(entry).some(value=>value.includes(q)));
    }
    const items=[],unavailable=[];
    for(const [key,entry] of selected){
      const id=Number(key);
      insist(Number.isSafeInteger(id)&&id>0&&entry?.id===id&&typeof entry.name==='string'&&typeof entry.title==='string'&&typeof entry.description==='string','BAD_PROJECT_MANIFEST',`Invalid project manifest entry ${key}.`);
      try{
        const project=await readProject(id);
        items.push({id, key, name:project.name, title:project.title, description:project.description, type:project.type, root:project.meta.source_root});
      }catch(error){unavailable.push({key,message:error.message});}
    }
    return {items,unavailable};
  };
  const inspectProject=async id=>{
    const project=await readProject(id),meta={id:project.id,name:project.name,root:project.meta.source_root};
    const settings_path=path.join(projectDir(meta),'settings.json');
    const source_settings_path=path.join(meta.root,'settings.json');
    let source_settings=null,source_error=null;
    try{const info=await lstat(source_settings_path);insist(info.isFile()&&info.size<=1024*1024,'BAD_PROJECT','Source settings must be a regular file under 1 MiB.');source_settings=await jsonRead(source_settings_path);}catch(error){source_error=error.message;}
    return {project,source_settings,source_error,settings_path,source_settings_path,sessions:await listSessions(meta)};
  };
  const ensureApp=async()=>{
    await ensureHome();
    return withMemoryLock(path.join(rabHome,'.memory-locks','app'),async()=>{
      const file=path.join(rabHome,'settings.json'),home=await jsonRead(file);
      if(home.app_id){assertNumericId(home.app_id);return home.app_id;}
      const id=await allocateId();
      await atomicJson(path.join(rabHome,'apps',String(id),'settings.json'),makeNode({id,name:'magic-box',title:'Magic Box',description:'Local application requests and preferences',meta:{kind:'app'}}));
      await atomicJson(file,{...home,app_id:id});
      return id;
    });
  };
  const requestPath=async file=>await exists(rabHome)?containedPath(rabHome,path.relative(rabHome,file),{allowMissing:true}):file;
  const requestScope=async({scope='global',project_id}={})=>{
    insist(['global','project'].includes(scope),'BAD_REQUEST','Choose global or project request scope.');
    insist(scope==='project'||project_id===undefined,'BAD_REQUEST','Global requests must not specify a project.');
    let project=null;
    if(scope==='project')project=await readProject(assertNumericId(project_id));
    const directory=await requestPath(path.join(project?directoryForId(project.id):rabHome,'feature-requests'));
    return {scope,...(project?{project_id:project.id,project_name:project.name}:{}),directory};
  };
  // Compatibility reads only: new records never use this former destination.
  const legacyRequestHome=async()=>{
    try{const home=await jsonRead(path.join(rabHome,'settings.json'));return home.app_id?await requestPath(path.join(rabHome,'apps',String(assertNumericId(home.app_id)),'requests')):null;}
    catch(error){if(error.code==='ENOENT')return null;throw error;}
  };
  const readRequestFile=async(id,file,target,legacy=false)=>{
    const node=await jsonRead(await requestPath(file));
    insist(node.version==='rab-node/v1'&&node.meta?.kind==='request'&&node.id===id,'BAD_REQUEST','Invalid saved request.');
    insist(legacy||node.scope===target.scope&&node.project_id===target.project_id,'BAD_REQUEST','Request does not belong to this scope.');
    if(target.scope==='project')insist(node.meta.parent?.kind==='project'&&node.meta.parent.id===target.project_id,'BAD_REQUEST','Request project identity mismatch.');
    return {...node,scope:target.scope,settings_path:file,...(legacy?{legacy_storage:true}:{})};
  };
  const createRequest=async input=>{
    insist(input&&typeof input==='object'&&!Array.isArray(input),'BAD_REQUEST','Request fields are required.');
    for(const key of Object.keys(input))insist(['name','title','description','type','submission_key','scope','project_id'].includes(key),'BAD_REQUEST',`Unexpected request field: ${key}.`);
    const {name,title,description,type,submission_key}=input;
    insist(typeof name==='string'&&name.length<=120&&typeof title==='string'&&title.length<=240&&typeof description==='string'&&description.length<=20000,'BAD_REQUEST','Supply name, title and description within their length limits.');
    insist(submission_key===undefined||(typeof submission_key==='string'&&submission_key.length>=8&&submission_key.length<=160),'BAD_REQUEST','Invalid submission key.');
    const target=await requestScope(input);
    const appId=target.scope==='global'?await ensureApp():null;
    return withMemoryLock(path.join(rabHome,'.memory-locks',`requests-${target.scope}-${target.project_id??'shared'}`),async()=>{
      const fields={name,title,description,type};
      const fingerprint=createHash('sha256').update(JSON.stringify(fields)).digest('hex');
      const submissionHash=submission_key?createHash('sha256').update(submission_key).digest('hex'):null;
      const reservation=submissionHash?await requestPath(path.join(target.directory,'.submissions',`${submissionHash}.json`)):null;
      // An uncertain submission from the old UI must retrieve its original
      // record, not create a duplicate when retried after this update.
      if(target.scope==='global'&&submissionHash){
        const oldHome=await legacyRequestHome();
        const oldReservation=oldHome?await requestPath(path.join(path.dirname(oldHome),'submissions',`${submissionHash}.json`)):null;
        if(oldReservation&&await exists(oldReservation)){
          const prior=await jsonRead(oldReservation);
          insist(prior.fingerprint===fingerprint,'SUBMISSION_CONFLICT','This submission was already used with different fields.');
          const oldFile=path.join(oldHome,String(assertNumericId(prior.id)),'settings.json');
          if(await exists(await requestPath(oldFile)))return readRequestFile(prior.id,oldFile,target,true);
        }
      }
      let id;
      if(reservation&&await exists(reservation)){
        const prior=await jsonRead(reservation);
        insist(prior.fingerprint===fingerprint,'SUBMISSION_CONFLICT','This submission was already used with different fields.');
        id=assertNumericId(prior.id);
      }else{id=await allocateId();}
      const node=makeNode({...fields,id,scope:target.scope,...(target.scope==='project'?{project_id:target.project_id}:{}),meta:{kind:'request',parent:target.scope==='project'?{kind:'project',id:target.project_id}:{kind:'app',id:appId}},status:'open',created_at:new Date().toISOString()});
      if(reservation&&!await exists(reservation))await atomicJson(reservation,{id,fingerprint});
      const file=await requestPath(path.join(target.directory,String(id),'settings.json'));
      if(await exists(file))return readRequestFile(id,file,target);
      await atomicJson(file,node);
      return {...node,settings_path:file};
    });
  };
  const readRequest=async(id,options={})=>{
    assertNumericId(id);const target=await requestScope(options);
    const file=await requestPath(path.join(target.directory,String(id),'settings.json'));
    if(await exists(file))return readRequestFile(id,file,target);
    const legacy=target.scope==='global'?await legacyRequestHome():null;
    if(legacy)return readRequestFile(id,path.join(legacy,String(id),'settings.json'),target,true);
    throw Object.assign(new Error('No request found in this scope.'),{code:'ENOENT'});
  };
  const listRequests=async(options={})=>{
    const target=await requestScope(options),legacy=target.scope==='global'?await legacyRequestHome():null;
    const ids=new Set();
    for(const directory of [target.directory,legacy].filter(Boolean)){
      const entries=await readdir(directory,{withFileTypes:true}).catch(error=>{if(error.code==='ENOENT')return [];throw error;});
      for(const entry of entries)if(entry.isDirectory()&&!entry.isSymbolicLink()&&/^\d+$/.test(entry.name))ids.add(Number(entry.name));
    }
    const items=[];for(const id of [...ids].sort((a,b)=>b-a).slice(0,200)){const node=await readRequest(id,target);items.push({...node,description:node.description.slice(0,240)});}
    return {...target,items,limit:200};
  };
  const listProjects = async () => {
    const items=[],unavailable=[];
    for(const entry of await readdir(path.join(rabHome,'projects'),{withFileTypes:true}).catch(error=>{if(error.code==='ENOENT')return [];throw error;})){
      if(!entry.isDirectory()||entry.isSymbolicLink())continue;
      try{
        if(!await exists(path.join(rabHome,'projects',entry.name,'settings.json')))continue;
        const node=await jsonRead(path.join(rabHome,'projects',entry.name,'settings.json'));
        if(node.version!=='rab-node/v1'||node.meta?.kind!=='project')continue;
        const meta={id:node.id,name:node.name,title:node.title,type:node.type,root:node.meta.source_root};
        if(path.basename(directoryForId(meta.id))!==entry.name||typeof meta.root!=='string')throw new Error('Project record identity does not match its storage folder.');
        if(readRoots().roots[rootKey(meta)]!==node.id)continue;
        items.push({...meta,key:String(meta.id)});
      }catch(error){unavailable.push({key:entry.name,message:error.message});}
    }
    return {items:items.sort((a,b)=>a.name.localeCompare(b.name)),unavailable};
  };
  const findSession = async id => {
    assertNumericId(id);
    // An enrolled project's invalid source settings must remain inspectable.
    // The owner registry pins identity/root independently of the editable file.
    const items=Object.entries(readRoots().roots).map(([root,id])=>({id,name:String(id),root:canonicalPath(root)}));
    for(const meta of items){
      try{
        const session=await loadSession(meta,id);
        if(session.id!==id||session.project_key!==projectKey(meta))throw new Error('Saved session identity mismatch.');
        return {meta:{...meta,name:session.bag?.project?.name??meta.name},session};
      }catch(error){if(error.code!=='ENOENT')throw error;}
    }
    throw Object.assign(new Error('Saved session was not found.'),{code:'ENOENT'});
  };
  // Internal calls stay inside their caller's transaction. Public entry points
  // acquire one project lock across all reads and writes, including openProject.
  // Whole-document saves remain replacements, not implicit merges of snapshots.
  const projectOperation = fn => async (meta,...args) => {
    await registerProject(meta);
    const directory=projectDir(meta);
    const identity=process.platform==='win32'?directory.toLowerCase():directory;
    const key=createHash('sha256').update(identity).digest('hex');
    return withMemoryLock(path.join(rabHome,'.memory-locks',key),()=>fn(meta,...args));
  };
  const withSessionOperation=(id,fn)=>withMemoryLock(path.join(rabHome,'.memory-locks',`session-${assertNumericId(id)}`),fn);
  const folderRecords=createFolderRecords({rabHome,allocateId,allocateIds,projectDirectory:async id=>{
    const node=await readProject(id);
    return projectDir({id:node.id,root:node.meta.source_root});
  }});
  const serialized=Object.fromEntries(Object.entries({openProject,readProjectSettings,loadResources,saveResources,addResource,knownEntities,loadFacts,saveFacts,setFact,getFact,setProjectPath,getProjectPath,removeProjectPath,createSession,loadSession,saveSession,saveToolResult,saveToolExecution,loadToolExecution,resolveToolValue,listSessions,recordFailure,resolveFailure}).map(([name,fn])=>[name,projectOperation(fn)]));
  return Object.freeze({ensureHome,ensureApp,allocateId,allocateIds,enrollId,registerProject,newProjectPath,newWorldPath,initialBag,withSessionOperation,...serialized,...folderRecords,readProject,addProjectToManifest,findProjectsInManifest,inspectProject,createRequest,readRequest,listRequests,loadToolReport,validateAuditFolder,requireAuditFolder,listProjects,findSession,paths,workbenchRunsDirectory,projectKey,rabHome});
};
