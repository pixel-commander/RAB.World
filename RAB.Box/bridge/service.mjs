import { readFile, writeFile, mkdir, rename, readdir, lstat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { createToolWorkbench } from './tool-workbench.mjs';
import { containedPath, record, own, insist, hash } from '../engine/src/core.mjs';
import { loadProject } from '../engine/src/project.mjs';
import { createSessionPlanner } from './session-planner.mjs';
import { createSeatParser } from './seat-parser.mjs';
import { createRabMemory } from './rab-memory.mjs';
import { createProjectConversation } from './project-conversation.mjs';
import { createToolHouse } from './tool-house.mjs';
import { questionForFailure } from './human-resolver.mjs';
import { createUsageLedger } from './usage-ledger.mjs';
import { assertNumericId } from './rab-id.mjs';
import { presentSession } from './session-view.mjs';
import { getProjectWatcher } from '../tools/base/watch/watch.mjs';

const terminal = new Set(['completed', 'execution-interrupted', 'execution-failed']);
const jsonRead = async file => {
  const stat = await lstat(file);
  insist(stat.isFile() && stat.size < 8 * 1024 * 1024, 'BAD_FILE', 'Expected a JSON file smaller than 8 MiB.');
  return JSON.parse(await readFile(file, 'utf8'));
};
const cleanId = id => {
  insist(/^\d{1,16}$/.test(String(id)) && Number.isSafeInteger(Number(id)), 'BAD_REQUEST', 'Invalid run ID.');
  return String(id);
};
const checkKeys = (body, allowed) => {
  insist(record(body), 'BAD_REQUEST', 'Expected an object.');
  for (const key of Object.keys(body)) insist(allowed.includes(key), 'BAD_REQUEST', `Unexpected input field: ${key}.`);
};

export const createWorkbench = ({ root, rabHome }) => {
  const locks = new Set();
  const drafts = new Map();
  const memory = createRabMemory({ rabHome }), usageLedger=createUsageLedger({rabHome:memory.rabHome}), sessionPlanners = new Map(), reconciledTelemetryProjects=new Set();
  const toolHouse = createToolHouse({ root, usageLedger });
  const projectWatcher = getProjectWatcher({ rabHome: memory.rabHome });
  let conversationPromise = null;
  const normalizeId=value=>value===undefined||value===null?undefined:assertNumericId(typeof value==='string'&&/^[1-9]\d*$/.test(value)?Number(value):value);
  const plannerFor = async cfg => {
    const key = cfg.projectRoot;
    if (!sessionPlanners.has(key)) sessionPlanners.set(key, (async () => {
      const languageRoot = await containedPath(root, cfg.host.language);
      return createSessionPlanner({ root, projectRoot: cfg.projectRoot, project: cfg.project, languageRoot, rabHome: memory.rabHome, usageLedger });
    })());
    return sessionPlanners.get(key);
  };
  const sessions = async sessionId => plannerFor(await config(normalizeId(sessionId)));
  const config = async (sessionId,projectRootOverride,{reconcile=true}={}) => {
    sessionId=normalizeId(sessionId);
    const host = await jsonRead(await containedPath(root, 'HOST.json'));
    checkKeys(host, ['project', 'runs', 'interface', 'language', 'candidate_catalog', 'allow_executable_settings']);
    insist(host.allow_executable_settings === undefined || typeof host.allow_executable_settings === 'boolean', 'BAD_CONFIG', 'allow_executable_settings must be boolean.');
    const hostProjectRoot = host.project === undefined ? null : await containedPath(root, host.project);
    const projectRoot = projectRootOverride ?? (sessionId ? (await memory.findSession(sessionId)).meta.root : hostProjectRoot);
    insist(projectRoot, 'PROJECT_REQUIRED', 'Select an existing project or start a new project.');
    const legacyRunsRoot = await containedPath(root, host.runs, {allowMissing:true});
    const project = await loadProject(projectRoot);
    const telemetryKey=`${project.id}:${projectRoot}`;
    if(reconcile&&!reconciledTelemetryProjects.has(telemetryKey)){
      reconciledTelemetryProjects.add(telemetryKey);
      await usageLedger.reconcileOpenTasks({id:project.id,name:project.manifest?.project?.name??project.id,root:projectRoot});
    }
    const runsRoot=await memory.workbenchRunsDirectory({id:project.id,name:project.manifest.project.name,root:projectRoot});
    return { host, project, projectRoot, runsRoot, legacyRunsRoot, hostProjectRoot, sessionId };
  };
  const getRun = async (cfg, id) => {
    cleanId(id);
    for(const [directory,legacy] of [[cfg.runsRoot,false],[cfg.legacyRunsRoot,true]]){
      if(!directory)continue;
      try{
        const file=await containedPath(directory,`${id}/run.json`),run=await jsonRead(file);
        insist(String(run.id)===String(id)&&run.project_id===cfg.project.id,'WRONG_PROJECT','Saved run belongs to a different project.');
        return legacy?{...run,read_only:true,storage:'legacy',warning:'This historical run is read-only. Create a new request to perform work.'}:run;
      }catch(error){if(error.code!=='ENOENT')throw error;}
    }
    throw Object.assign(new Error('Saved run was not found in this project.'),{code:'ENOENT'});
  };
  const saveRun = async (cfg, run, initial = false) => {
    insist(!run.read_only,'LEGACY_RUN_READ_ONLY','Historical runs are read-only. Create a new request.');
    const runsRoot=await memory.workbenchRunsDirectory({id:cfg.project.id,name:cfg.project.manifest.project.name,root:cfg.projectRoot},{create:true});
    await mkdir(runsRoot,{recursive:true});
    const folder = await containedPath(runsRoot, cleanId(run.id), { allowMissing: initial });
    if (initial) await mkdir(folder);
    const file = await containedPath(runsRoot, `${run.id}/run.json`, { allowMissing: true });
    const temp = await containedPath(runsRoot, `${run.id}/run.json.tmp`, { allowMissing: true });
    await writeFile(temp, JSON.stringify(run, null, 2) + '\n');
    await rename(temp, file);
  };
  const boxFor = cfg => createToolWorkbench({ toolHouse, project:cfg.project, context:{rab_home:memory.rabHome,project:{id:cfg.project.id,name:cfg.project.manifest.project.name??cfg.project.id,root:cfg.projectRoot},__rab_telemetry:{session_id:cfg.sessionId??null}} });
  const inspect = async sessionId => {
    const cfg = await config(sessionId);
    const inspection = await boxFor(cfg).inspect();
    const storageId=await memory.registerProject({id:cfg.project.id,name:cfg.project.manifest.project.name,root:cfg.projectRoot});
    inspection.project={...inspection.project,id:storageId};
    const settingsPath=path.join(memory.paths({id:cfg.project.id,name:cfg.project.manifest.project.name,root:cfg.projectRoot}).project,'settings.json');
    let settings=null,settingsError=null;
    try{settings=await memory.readProjectSettings({id:cfg.project.id,name:cfg.project.manifest.project.name,root:cfg.projectRoot});insist(record(settings),'BAD_CONFIG','Project settings.json must contain an object.');}
    catch(error){settings=null;settingsError=error.message;}
    return { ...inspection, project_path: cfg.projectRoot, settings, settings_path:settingsPath, settings_error:settingsError, settings_read_at:new Date().toISOString(), rab:memory.paths({id:cfg.project.id,name:cfg.project.manifest.project.name,root:cfg.projectRoot}), is_host_project: cfg.projectRoot === cfg.hostProjectRoot, runs_path: await memory.workbenchRunsDirectory({id:cfg.project.id,name:cfg.project.manifest.project.name,root:cfg.projectRoot}), discovery: 'Tool House + project PATHS.json', version: '0.9.0', mode: 'local-trusted-workbench' };
  };
  const list = async sessionId => {
    const cfg = await config(sessionId,undefined,{reconcile:false}), items = [], unavailable = [];
    const ids=new Set();
    for(const directory of [cfg.runsRoot,cfg.legacyRunsRoot].filter(Boolean)){
      const entries=await readdir(directory,{withFileTypes:true}).catch(error=>{if(error.code==='ENOENT')return [];throw error;});
      for(const entry of entries)if(entry.isDirectory()&&!entry.isSymbolicLink()&&/^\d{1,16}$/.test(entry.name))ids.add(entry.name);
    }
    for (const id of [...ids].sort((a,b)=>Number(b)-Number(a)).slice(0,100)) {
      try {
        const run = await getRun(cfg, id);
        items.push({ id: run.id, revision: run.revision, status: run.status, original: run.original, updated_at: run.updated_at, ...(run.read_only?{read_only:true,storage:'legacy'}:{}) });
      } catch (error) { unavailable.push({ id, code: error.code ?? 'READ_FAILED', message: error.message }); }
    }
    return { items, unavailable, limit: 100 };
  };
  const read = async (id,sessionId) => {
    // Inspecting saved history must not enroll a copied source as a new project
    // or claim its name merely to initialize the usage ledger.
    const cfg = await config(sessionId,undefined,{reconcile:false}), run = await getRun(cfg, id);
    if (run.status === 'running' && !locks.has(String(id))) return { ...run, status: 'execution-interrupted', warning: 'Execution was started, but no final receipt was saved. Inspect the project before creating any replacement request. This run cannot be executed again.' };
    return run;
  };
  const prepare = async (body,sessionId) => {
    checkKeys(body, ['text', 'request']);
    insist((own(body, 'text') ? 1 : 0) + (own(body, 'request') ? 1 : 0) === 1, 'BAD_REQUEST', 'Supply text OR a canonical request.');
    if (own(body, 'text')) insist(typeof body.text === 'string' && body.text.trim() && body.text.length <= 16000, 'BAD_REQUEST', 'Supply request text, up to 16,000 characters.');
    const cfg = await config(sessionId), original = own(body, 'text') ? body.text : body.request;
    const result = await boxFor(cfg).prepare(original);
    const id = result.ticket?.id ?? await memory.allocateId();
    const run = { version: 'tool-house-run/v1', id, revision: 0, project_id: cfg.project.id, original, status: result.status, result, ticket: result.ticket ?? null, updated_at: new Date().toISOString(), history: [{ action: 'prepare', at: new Date().toISOString(), result }] };
    await saveRun(cfg, run, true);
    return run;
  };
  const act = async (id, action, body,sessionId) => {
    cleanId(id);
    insist(['answer', 'answer-text', 'resume', 'execute'].includes(action), 'BAD_REQUEST', 'Unknown run action.');
    checkKeys(body, ({ answer: ['revision','stamp','key','value'], 'answer-text': ['revision','stamp','key','text'], resume: ['revision'], execute: ['revision','confirm'] })[action]);
    insist(!locks.has(String(id)), 'BUSY', 'This run is already being updated. Refresh before continuing.');
    locks.add(String(id));
    try {
      const cfg = await config(sessionId,undefined,{reconcile:false}), run = await getRun(cfg, id);
      insist(!run.read_only,'LEGACY_RUN_READ_ONLY','Historical runs are read-only. Create a new request.');
      insist(Number.isInteger(body.revision) && body.revision === run.revision, 'STALE_REVISION', 'This run changed in another tab. Refresh the run before sending another action.');
      insist(!terminal.has(run.status) && run.status !== 'running', 'RUN_FINISHED', 'This run cannot be executed or modified again. Inspect its receipt.');
      insist(run.ticket, 'NO_TICKET', 'This request has no resumable ticket. Correct the original text and prepare again.');
      const box = boxFor(cfg);
      let result;
      if (action === 'execute') {
        insist(run.status === 'ready' && body.confirm === true, 'DENIED', 'Explicit confirmation is required for a ready request.');
        run.status = 'running'; run.revision++; run.updated_at = new Date().toISOString();
        run.history.push({ action: 'execution-started', at: run.updated_at });
        await saveRun(cfg, run);
        result = await box.execute(run.ticket);
      } else if (action === 'resume') result = await box.resume(run.ticket);
      else {
        insist(typeof body.stamp === 'string' && typeof body.key === 'string', 'BAD_REQUEST', 'Answer must identify stamp and key.');
        insist(run.ticket.questions?.some(q => q.stamp === body.stamp && q.key === body.key), 'BAD_REQUEST', 'Answer does not target a pending seat.');
        if (action === 'answer') {
          insist(own(body, 'value'), 'BAD_REQUEST', 'Answer needs a value.');
          result = await box.answer(run.ticket, { request_id: run.ticket.id, stamp: body.stamp, values: { [body.key]: body.value } });
        } else {
          insist(typeof body.text === 'string' && body.text.length <= 16000, 'BAD_REQUEST', 'Supply answer text.');
          result = await box.answerText(run.ticket, body.text, { stamp: body.stamp, key: body.key });
        }
      }
      const recoverableAnswer = action.startsWith('answer') && !result.ticket && ['invalid-input','unsupported-language','ambiguous','conflict'].includes(result.status);
      run.revision++;
      run.updated_at = new Date().toISOString();
      run.history.push({ action, input: body, at: run.updated_at, result });
      if (recoverableAnswer) run.last_error = result;
      else {
        delete run.last_error;
        run.result = result;
        run.status = action === 'execute' && result.status !== 'completed' && !result.ticket ? 'execution-failed' : result.status;
        if (result.ticket) run.ticket = result.ticket;
      }
      await saveRun(cfg, run);
      return run;
    } finally { locks.delete(String(id)); }
  };
  const file = async (id, relative,sessionId) => {
    const cfg = await config(sessionId,undefined,{reconcile:false}), run = await getRun(cfg, id);
    const approved = run.result.receipt?.steps?.flatMap(s => s.files ?? []) ?? [];
    const recorded = approved.find(f => f.path === relative);
    insist(recorded, 'DENIED', 'Only files listed in this run’s completed receipt can be inspected.');
    const resolved = await containedPath(cfg.projectRoot, path.isAbsolute(relative)?path.relative(cfg.projectRoot,relative):relative);
    const stat = await lstat(resolved);
    insist(stat.isFile() && stat.size <= 512 * 1024, 'FILE_LIMIT', 'Viewer supports regular files up to 512 KiB.');
    const bytes = await readFile(resolved);
    const evidence = { matches_receipt: hash(bytes) === recorded.sha256, recorded_sha256: recorded.sha256, actual_sha256: hash(bytes) };
    if (bytes.includes(0)) return { path: relative, ...evidence, binary: true, bytes: bytes.length, text: 'Binary file. Inspect it in the project folder.' };
    return { path: relative, ...evidence, binary: false, bytes: bytes.length, text: bytes.toString('utf8') };
  };
  const contract = async (name,sessionId) => {
    const cfg = await config(sessionId);
    return boxFor(cfg).contract(name);
  };
  const plan = async body => {
    checkKeys(body, ['text','context']);
    insist(typeof body.text === 'string' && body.text.trim(), 'BAD_REQUEST', 'Supply request text.');
    if (body.context !== undefined) insist(record(body.context), 'BAD_REQUEST', 'context must be an object.');
    throw Object.assign(new Error('The separate planner is retired. Use session Turns or the Tool House form.'),{code:'RETIRED_CONTRACT'});
  };
  const nameQuestion=()=>({status:'input-required',session_id:null,required_inputs:['name'],question:'What would you like to name this session?'});
  const sessionNew = async (body = {}) => {
    checkKeys(body,['session_id','project_id','name','title','description','draft']);
    if(body.draft===true){
      insist(!body.project_id&&!body.session_id&&!body.name,'BAD_REQUEST','A project draft cannot also create a session.');
      for(const [id,draft] of drafts)if(Date.now()-draft.touched>3600000)drafts.delete(id);
      insist(drafts.size<100,'BUSY','Too many open project drafts.');
      const draft_id=randomUUID(),meta={id:await memory.allocateId(),name:'Unsaved project draft',root:path.join(memory.rabHome,'drafts',draft_id)};
      const session={id:await memory.allocateId(),ephemeral:true,revision:0,bag:{domain:null,project:{id:meta.id,name:meta.name,root:meta.root},projectSettings:{type:'base',paths:{}},audit:{workingRoot:null,projectName:null},currentTarget:null,addressStack:[],paths:{}},groups:[],steps:[],turns:[],status:'open'};
      const adapter={...memory,saveSession:async(target,state)=>{if(state.id!==session.id)return memory.saveSession(target,state);state.revision++;state.updated_at=new Date().toISOString();}};
      const conversation=await createProjectConversation({root,memory:adapter,toolHouse});
      drafts.set(draft_id,{meta,session,conversation,touched:Date.now()});
      return {...presentSession(session,{memory,meta}),session_id:null,draft_id,note:'Temporary project setup. No session is saved.'};
    }
    if(typeof body.name!=='string'||!body.name.trim())return nameQuestion();
    if(body.project_id!==undefined)return projectActivate({...body,mode:'new-session',draft:undefined});
    return (await sessions(body.session_id)).newSession({name:body.name,title:body.title,description:body.description});
  };
  const sessionList = async () => (await sessions()).listSessions();
  const sessionRead = async id => {const found=await memory.findSession(normalizeId(id));return presentSession(found.session,{memory,meta:found.meta});};
  const projectsList=()=>memory.listProjects();
  const projectInspect=id=>memory.inspectProject(normalizeId(id));
  const projectActivate=async body=>{
    checkKeys(body,['project_id','mode','session_id','expected_revision','name','title','description','draft']);
    assertNumericId(body.project_id);
    insist(['select','view','resume','new-session','new-action'].includes(body.mode),'BAD_REQUEST','Choose select, view, resume, new-session or new-action.');
    const node=await memory.readProject(body.project_id);
    const meta={id:node.id,name:node.name,root:node.meta.source_root};
    const listed=await memory.listSessions(meta);
    const selection={status:'project-selected',project:{id:node.id,name:node.name,root:node.meta.source_root},sessions:listed,session_id:null,session:null};
    if(body.mode==='select')return selection;
    if(body.mode==='view'){
      const id=body.session_id??listed[0]?.id;if(id===undefined)return selection;
      return presentSession(await memory.loadSession(meta,assertNumericId(id)),{memory,meta});
    }
    const cfg=await config(undefined,node.meta.source_root),planner=await plannerFor(cfg);
    if(body.mode==='new-session'){
      if(typeof body.name!=='string'||!body.name.trim())return {...nameQuestion(),project:selection.project};
      return planner.newSession({name:body.name,title:body.title,description:body.description});
    }
    let id=body.session_id;
    if(id===undefined)id=listed[0]?.id;
    if(id===undefined)return selection;
    assertNumericId(id);
    return mutateSession({...body,session_id:id},async found=>{
      insist(found.session.project_key===String(node.id),'WRONG_PROJECT','Session belongs to another project.');
      return body.mode==='view'?presentSession(found.session,{memory,meta}):body.mode==='new-action'?planner.newAction(id):planner.resume(id);
    });
  };
  const requestScope=body=>{
    checkKeys(body,['scope','project_id']);
    return {scope:body.scope??'global',...(body.project_id===undefined?{}:{project_id:normalizeId(body.project_id)})};
  };
  const requestsList=async(options={})=>({...await memory.listRequests(requestScope(options)),fields:(await toolHouse.getTool('base/create/request')).settings.filter(field=>field.name!=='submission_key')});
  const requestCreate=async body=>{
    checkKeys(body,['name','title','description','type','submission_key','scope','project_id']);
    const output=await toolHouse.runTool({key:'base/create/request',options:body,context:{rab_home:memory.rabHome}});
    return output.result;
  };
  const requestRead=(id,options={})=>memory.readRequest(normalizeId(id),requestScope(options));
  const folderRecords=async({projectId,kind,id,page=false,cursor=null,limit})=>{
    const scope={projectId:normalizeId(projectId),kind,id:normalizeId(id)};
    if(!page)return memory.getFolderRecordStatus(scope);
    if(typeof cursor==='string'){
      insist(cursor.length<=2048,'BAD_CURSOR','Folder cursor exceeds its bound.');
      try{cursor=JSON.parse(cursor);}catch{throw Object.assign(new Error('Invalid folder cursor.'),{code:'BAD_CURSOR'});}
    }
    return memory.readFolderRecordPage({...scope,cursor,limit:limit===undefined?undefined:Number(limit)});
  };
  const initialize=async()=>{await memory.ensureHome();await memory.allocateId();const catalog=await toolHouse.listTools();const ids=catalog.items.map(item=>Number(item.id)).filter(id=>Number.isSafeInteger(id)&&id>0);if(ids.length)await memory.enrollId(ids);await memory.ensureApp();return projectWatcher.restore();};
  const close=()=>projectWatcher.close();
  const mutateSession=async(body,operation)=>memory.withSessionOperation(body.session_id,async()=>{
    const found=await memory.findSession(body.session_id);
    if(body.expected_revision!==undefined)insist(Number.isSafeInteger(body.expected_revision)&&found.session.revision===body.expected_revision,'SESSION_CONFLICT','This session changed in another window. Reload before continuing.');
    return operation(found);
  });
  const sessionTurn = async body => {
    checkKeys(body, ['session_id','draft_id','project_id','text','expected_revision']);
    if(body.session_id!==undefined)assertNumericId(body.session_id);
    insist(typeof body.text === 'string' && body.text.trim() && body.text.length <= 16000, 'BAD_REQUEST', 'Supply turn text, up to 16,000 characters.');
    if(body.draft_id!==undefined){
      insist(!body.session_id&&typeof body.draft_id==='string','BAD_REQUEST','Supply a draft or session, not both.');
      const draft=drafts.get(body.draft_id);
      insist(draft&&Date.now()-draft.touched<3600000,'NOT_FOUND','Project draft expired. Start project setup again.');
      const key=`draft:${body.draft_id}`;insist(!locks.has(key),'BUSY','Project draft is processing a turn.');locks.add(key);
      try{
        draft.touched=Date.now();
        const result=await draft.conversation.turn({...draft,text:body.text});
        insist(result,'BAD_REQUEST','Project setup only accepts project setup or selection messages.');
        if(result.status==='project-selected'||result.session_id!==draft.session.id){drafts.delete(body.draft_id);return {...result,draft_id:null};}
        return {...result,session_id:null,draft_id:body.draft_id,note:'Temporary project setup. No session is saved.'};
      }finally{locks.delete(key);}
    }
    const startSession=body.text.trim().match(/^(?:please\s+)?(?:start|create|begin|open)\s+(?:a\s+)?new\s+session(?:\s+(?:named|called)\s+(.+))?[.!]?$/i);
    if(startSession){return sessionNew({session_id:body.session_id,project_id:body.project_id,...(startSession[1]?{name:startSession[1].replace(/^["']|["']$/g,'')}: {})});}
    insist(body.session_id,'SESSION_REQUIRED','Select or create a named session before sending work.');
    const lock = `session:${body.session_id ?? 'new'}`;
    insist(!locks.has(lock), 'BUSY', 'This session is already processing a turn.');
    locks.add(lock);
    try {
      let id = body.session_id;
      return await mutateSession({...body,session_id:id},async found=>{
        conversationPromise ??= createProjectConversation({ root, memory, toolHouse });
        const result = await (await conversationPromise).turn({ ...found, text: body.text });
        return result ?? await (await sessions(id)).turn({ sessionId: id, text: body.text });
      });
    } finally { locks.delete(lock); }
  };
  const sessionYolo = async body => {
    checkKeys(body, ['session_id','enabled','expected_revision']);
    assertNumericId(body.session_id);insist(typeof body.enabled === 'boolean', 'BAD_REQUEST', 'Supply enabled Boolean.');
    return mutateSession(body,async()=> (await sessions(body.session_id)).setYolo(body.session_id, body.enabled));
  };
  const sessionAnswer = async body => {
    checkKeys(body,['session_id','expected_revision','answers']);
    assertNumericId(body.session_id);
    insist(Number.isSafeInteger(body?.expected_revision)&&body?.expected_revision>=0,'BAD_REQUEST','Supply the revision of the questions being answered.');
    const lock=`session:${body.session_id}`;
    insist(!locks.has(lock),'BUSY','This session is processing a turn.');
    locks.add(lock);
    try{return await mutateSession(body,async()=> (await sessions(body.session_id)).answer({sessionId:body.session_id,answers:body.answers}));}
    finally{locks.delete(lock);}
  };
  const sessionExecute = async body => {
    checkKeys(body, ['session_id','confirm','expected_revision']);
    assertNumericId(body.session_id);insist(typeof body.confirm === 'boolean', 'BAD_REQUEST', 'Supply confirm Boolean.');
    const lock = `session:${body.session_id}`;
    insist(!locks.has(lock), 'BUSY', 'This session is processing a turn.');
    locks.add(lock);
    try { return await mutateSession(body,async()=> (await sessions(body.session_id)).execute({ sessionId: body.session_id, confirm: body.confirm })); }
    finally { locks.delete(lock); }
  };
  const projectPath = async body => {
    checkKeys(body, ['key','value','session_id','description','types','expected']);
    if(body.session_id!==undefined)assertNumericId(body.session_id);
    insist(typeof body.key === 'string' && typeof body.value === 'string', 'BAD_REQUEST', 'Supply project path key and value.');
    return (await sessions(body.session_id)).setProjectPath(body);
  };
  const diagnostics = async () => (await sessions()).diagnostics();
  const languageTypes = async () => (await sessions()).languageTypes();
  const languageTypeUpdate = async body => {
    checkKeys(body, ['kind','lemma','forms','text','types','senses']);
    return (await sessions()).updateLanguageType(body);
  };
  const toolsList = async ({ domain, include_stamps, session_id } = {}) => {
    const context=session_id?{project:(await memory.findSession(normalizeId(session_id))).meta}:{};
    const catalog = await toolHouse.listTools({ domain: domain || undefined, includeStamps: include_stamps !== false, fresh:true,context });
    const savedReport = JSON.parse(await readFile(new URL('./rab-memory.contract.json', import.meta.url), 'utf8')).shape;
    const tracking = JSON.parse(await readFile(new URL('./tool-tracking.contract.json', import.meta.url), 'utf8')).shape;
    const addresses = await toolHouse.pathsRegistry.pack({projectRoot:context.project?.root});
    return { ...catalog, address_diagnostics:addresses.diagnostics, persistence:{ savedReport, tracking } };
  };
  const toolsFind = async body => {
    checkKeys(body, ['query','domain','include_stamps','function_prefix','session_id']);
    const context=body.session_id?{project:(await memory.findSession(normalizeId(body.session_id))).meta}:{};
    await toolHouse.scan({fresh:true,context});
    return toolHouse.findTools({ query: body.query, domain: body.domain || undefined, includeStamps: body.include_stamps !== false, functionPrefix: body.function_prefix || undefined,context });
  };
  const toolsRun = async body => {
    checkKeys(body, ['tool','options','context','session_id']);
    insist(typeof body.tool === 'string', 'BAD_REQUEST', 'Supply tool as domain/name.');
    if(body.session_id!==undefined)assertNumericId(body.session_id);
    const supplied=body.context??{}; checkKeys(supplied,['domain']);
    const cfg=await config(body.session_id);
    const project={id:cfg.project.id,name:cfg.project.manifest?.project?.name??cfg.project.id,root:cfg.projectRoot};
    const bag=body.session_id?(await memory.loadSession(project,body.session_id)).bag:undefined;
    return toolHouse.runTool({ key: body.tool, options: body.options ?? {}, context: { ...supplied, bag, rab_home:memory.rabHome, project, __rab_telemetry:{session_id:body.session_id??null} } });
  };

  const health = async ({session_id}={}) => {
    const cfg=await config(session_id);
    return usageLedger.summarize(projectMeta(cfg));
  };

  const projectMeta = cfg => ({ id:cfg.project.id, name:cfg.project.manifest?.project?.name ?? cfg.project.id, root:cfg.projectRoot });
  const safeTrainingWord = value => String(value??'word').toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80) || 'word';
  const readOptionalJson = async (file, fallback) => { try { return JSON.parse(await readFile(file,'utf8')); } catch (error) { if(error.code==='ENOENT') return fallback; throw error; } };

  const compileTurn = async ({text,check_id=randomUUID(),parser,bag={},projectRoot,project}) => {
    const parse=parser.parse(text,{context:{...bag,domain:bag.domain??null,currentTarget:bag.currentTarget?.name??null},knownEntities:[]});
    const packed=await toolHouse.pathsRegistry.pack({projectRoot});
    const addresses=[...Object.entries(packed.tools),...Object.entries(packed.stamps)];
    const frames=[];
    for(const frame of parse.frames){
      const explicitDomain=frame.evidence?.find(e=>e.seat==='domain'&&e.reason!=='Bag/context domain')?.value??null;
      const found=await toolHouse.findTools({query:frame.text,domain:explicitDomain??undefined,includeStamps:true,requestFrame:frame,context:{project:projectRoot?{root:projectRoot}:null}});
      const candidates=found.items.slice(0,8).map(item=>{
        const hit=addresses.find(([,entry])=>String(entry.id)===String(item.id)&&entry.path===item.path);
        return {address:hit?.[0]??null,id:item.id,path:item.path,kind:item.kind,title:item.title,operation:item.meta?.operation??item.inherited?.operation??null,target_type:item.meta?.target_type??item.inherited?.target_type??null,score:item.score,path_score:item.path_score,shape_score:item.shape_score,text_score:item.text_score,path_matches:item.path_matches,seat_matches:item.seat_matches,source:hit?.[1]?.source??item.source??'house'};
      });
      const top=candidates[0]??null;
      const typed=frame.typedUnknowns??[];
      const generic=frame.unknownTokens??[];
      const blockers=[
        ...generic.map(x=>({stage:'shape-1',blocker_type:'unknown-word',...x})),
        ...typed.map(x=>({stage:'shape-2',blocker_type:'typed-unknown',...x})),
        ...(frame.ambiguousSeats??[]).map(x=>({stage:'shape-2',blocker_type:'ambiguous-seat',...x})),
        ...(frame.conflicts??[]).map(x=>({stage:'shape-2',blocker_type:'conflict',...x})),
        ...(frame.negated?[{stage:'shape-2',blocker_type:'negation'}]:[]),
        ...(!top?[{stage:'shape-4',blocker_type:'capability-gap'}]:[])
      ];
      const executable=blockers.length===0&&Boolean(top);
      const failure=blockers[0]??null;
      const missingSeat=failure?.seat??(failure?.blocker_type==='capability-gap'?'capability':null);
      const knownSeats=Object.fromEntries(Object.entries(frame.seats??{}).filter(([,value])=>value!==null&&value!==undefined&&!(value&&typeof value==='object'&&value.known===false)));
      let legalFills=[];
      if(missingSeat&&missingSeat!=='capability'){
        const all=(await toolHouse.listTools({domain:explicitDomain??undefined,includeStamps:true,context:{project:projectRoot?{root:projectRoot}:null}})).items;
        const wantedTarget=knownSeats.target_type??null;
        const wantedDomain=knownSeats.domain??explicitDomain??null;
        legalFills=[...new Set(all.filter(item=>{
          const target=item.meta?.target_type??item.inherited?.target_type??null;
          const domain=item.meta?.domain??item.domain??null;
          if(wantedTarget&&target&&String(target)!==String(wantedTarget))return false;
          if(wantedDomain&&domain&&domain!=='base'&&String(domain)!==String(wantedDomain))return false;
          return true;
        }).map(item=>item.meta?.[missingSeat]??item.inherited?.[missingSeat]??null).filter(Boolean))].slice(0,8);
      }
      const question=failure?questionForFailure({failure,missingSeat,knownSeats,legalFills}):null;
      const recovery=failure?{status:'needs-input',missing_seat:missingSeat,known_seats:knownSeats,legal_fills:legalFills,question,actions:question?.actions??['fill-seat','rephrase']}:null;
      frames.push({
        id:frame.id,text:frame.text,
        shape1:parser.shape1(frame.text),
        shape2:{composition:frame.composition,typed_unknowns:typed,unknown_tokens:generic,complete:frame.completeLanguage},
        shape3:{seats:frame.seats,data_types:frame.data_types,evidence:frame.evidence},
        shape4:{candidates},
        shape5:{resolved:top,authority:executable?(top?.kind==='stamp'?'write':'read'):'none',executable},
        failure_boundary:failure,
        recovery,
        blockers
      });
    }
    return {version:'turn-check/v0.8.5',check_id,input:text,scope:project?'project':'input-only',...(project?{project}:{}),frames,complete:frames.every(f=>f.shape5.executable),authority:'diagnostic-only'};
  };

  const turnCheck = async body => {
    checkKeys(body,['text']);
    insist(typeof body.text==='string'&&body.text.trim()&&body.text.length<=16000,'BAD_REQUEST','Supply turn text, up to 16,000 characters.');
    const host=await jsonRead(await containedPath(root,'HOST.json'));
    const languageRoot=await containedPath(root,host.language);
    const parser=await createSeatParser({languageRoot});
    return compileTurn({text:body.text.trim(),parser});
  };

  const compileProjectTurn = async ({text,session_id,check_id}) => {
    const cfg=await config(session_id);
    const bag=session_id?(await memory.findSession(session_id)).session?.bag??{}:{};
    const parser=(await sessions(session_id)).seatParser;
    return compileTurn({text,check_id,parser,bag,projectRoot:cfg.projectRoot,project:{id:cfg.project.id,name:cfg.project.manifest?.project?.name??cfg.project.id}});
  };

  const teachLanguage = async body => {
    checkKeys(body,['check_id','text','token','sense','scope','session_id','lexical_type']);
    insist(typeof body.check_id==='string'&&body.check_id,'BAD_REQUEST','check_id is required.');
    insist(typeof body.text==='string'&&body.text.trim(),'BAD_REQUEST','text is required.');
    insist(typeof body.token==='string'&&body.token.trim(),'BAD_REQUEST','token is required.');
    insist(typeof body.sense==='string'&&body.sense.trim()&&body.sense.length<=100,'BAD_REQUEST','sense is required.');
    const scope=body.scope??'project-only'; insist(['project-only','house-proposed'].includes(scope),'BAD_REQUEST','scope must be project-only or house-proposed.');
    const before=await compileProjectTurn({text:body.text.trim(),session_id:body.session_id,check_id:body.check_id});
    const token=body.token.trim();
    const hole=before.frames.flatMap(f=>[...(f.shape2.typed_unknowns??[]),...(f.shape2.unknown_tokens??[])]).find(x=>String(x.value??x.token).toLowerCase()===token.toLowerCase());
    insist(hole,'BAD_REQUEST',`The current check does not contain unresolved token ${token}.`);
    const lexicalType=body.lexical_type??(hole.type==='predicate'?'adjective':hole.type==='operation-alias'?'verb':null);
    insist(typeof lexicalType==='string'&&lexicalType,'BAD_REQUEST','A lexical_type is required when the hole role cannot determine one.');
    const cfg=await config(body.session_id); const meta=projectMeta(cfg); await memory.openProject(meta);
    const entry={lemma:token.toLowerCase(),forms:[token.toLowerCase()],types:[lexicalType],senses:[body.sense.trim()],trained_from:{check_id:body.check_id,role:hole.type??null,seat:hole.seat??null}};
    let applied=false,proposal_file=null;
    if(scope==='project-only'){
      const file=path.join(memory.paths(meta).project,'language','type-overrides.json'); await mkdir(path.dirname(file),{recursive:true});
      const data=await readOptionalJson(file,{version:'rraabbiitt-project-type-overrides/v0.8.5',entries:[],phrases:[]}); data.entries??=[];
      const at=data.entries.findIndex(x=>x.lemma===entry.lemma); if(at>=0)data.entries[at]=entry;else data.entries.push(entry); data.updated_at=new Date().toISOString();
      await writeFile(file,JSON.stringify(data,null,2)+'\n','utf8'); sessionPlanners.delete(cfg.projectRoot); applied=true;
    }else{
      const dir=path.join(root,'language','proposed'); await mkdir(dir,{recursive:true}); proposal_file=path.join(dir,`${Date.now()}-${safeTrainingWord(token)}.json`);
      await writeFile(proposal_file,JSON.stringify({version:'rraabbiitt-language-proposal/v0.8.5',status:'proposed',scope,entry,source_turn:body.text,created_at:new Date().toISOString()},null,2)+'\n','utf8');
    }
    const after=await compileProjectTurn({text:body.text.trim(),session_id:body.session_id,check_id:body.check_id});
    const receiptId=randomUUID();
    const sessionRepair=applied&&body.session_id ? await (await sessions(body.session_id)).repairLanguageStep({sessionId:body.session_id,text:body.text.trim(),token,checkId:body.check_id,receiptId}) : null;
    const receipt={version:'turn-training-receipt/v0.8.5',id:receiptId,check_id:body.check_id,at:new Date().toISOString(),project:{id:meta.id,name:meta.name},scope,raw_input:body.text,token,typed_hole:hole,correction:{lexical_type:lexicalType,sense:body.sense.trim()},applied,proposal_file:proposal_file?path.relative(root,proposal_file).split(path.sep).join('/'):null,session_repair:sessionRepair,before:{frames:before.frames.map(f=>({id:f.id,seats:f.shape3.seats,blockers:f.blockers}))},after:{frames:after.frames.map(f=>({id:f.id,seats:f.shape3.seats,blockers:f.blockers,resolved:f.shape5.resolved}))},regression_cases:[{input:body.text,expected:after.frames.map(f=>f.shape3.seats),scope}]};
    const receiptDir=path.join(memory.paths(meta).training,'turn-checker'); await mkdir(receiptDir,{recursive:true}); await writeFile(path.join(receiptDir,`${receipt.id}.json`),JSON.stringify(receipt,null,2)+'\n','utf8');
    return {status:applied?'taught-and-rechecked':'proposed-not-applied',receipt,check:after,session_repair:sessionRepair};
  };

  return Object.freeze({ initialize, close, projectsList, projectInspect, projectActivate, requestsList, requestCreate, requestRead, folderRecords, inspect, list, read, prepare, act, file, contract, plan, sessionNew, sessionList, sessionRead, sessionTurn, sessionAnswer, sessionYolo, sessionExecute, projectPath, diagnostics, languageTypes, languageTypeUpdate, toolsList, toolsFind, toolsRun, health, turnCheck, teachLanguage });
};
