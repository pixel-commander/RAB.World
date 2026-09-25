import path from 'node:path';
import { createSeatParser } from './seat-parser.mjs';
import { presentSession } from './session-view.mjs';
import { cancelFlowTurn } from './session-flow.mjs';
import { reservedExecutionMemory } from './tool-tracking.mjs';

const now=()=>new Date().toISOString();
const unquote=text=>String(text??'').trim().replace(/^(\"|')(.*)\1$/s,'$2');
const low=value=>String(value??'').trim().toLowerCase();
const isYes=text=>/^(?:yes|y|yeah|yep|correct|confirm|do it|go ahead|please do)$/i.test(String(text).trim());
const isNo=text=>/^(?:no|n|nope|cancel|stop|don't|do not)$/i.test(String(text).trim());
const absoluteFromParse=parse=>parse.frames.flatMap(f=>f.evidence??[]).find(e=>e.reason?.startsWith('path literal'))?.value??null;
const projectNameFromText=(text,parse)=>{
  const parsed=parse.frames.map(f=>f.seats.name).find(v=>v&&!['a','an','the','project'].includes(low(v))); if(parsed)return parsed;
  const quoted=String(text).match(/project(?:\s+(?:named|called))?\s+[\"']([^\"']+)[\"']/i); if(quoted)return quoted[1];
  const after=String(text).match(/(?:find|load|open|select|use)\s+(?:the\s+)?project\s+([A-Za-z0-9._-]+)/i); if(after)return after[1];
  const before=String(text).match(/(?:find|load|open|select|use)\s+([A-Za-z0-9._-]+)\s+project\b/i); return before&&!['a','an','the'].includes(low(before[1]))?before[1]:null;
};
const projectLookupName=(text,parse,{bare=false}={})=>{
  const raw=unquote(text);
  if(path.isAbsolute(raw))return raw;
  const command=String(text).match(/\b(?:find|load|open|select|use)\s+(?:the\s+)?project\s+(.+)$/i);
  if(command)return unquote(command[1]);
  if(/\b(?:find|load|open|select|use)\s+(?:(?:a|the)\s+)?project\s*$/i.test(text))return null;
  return bare?raw:projectNameFromText(text,parse);
};
const projectTypeFromText=(text,parse)=>{
  const t=low(text);
  if(/\bmagic[ -]?box\b/.test(t))return'magic-box';
  if(/\breact\b/.test(t))return'react'; if(/\b(?:html|vanilla)\b/.test(t))return'html'; if(/\baudit\b/.test(t))return'audit';
  return null;
};
const summarizeProjects=items=>[...new Set(items.map(item=>typeof item==='string'?item:item.name))].join('\n');
const optionsObject=step=>Object.fromEntries(Object.entries(step.options??{}).filter(([,v])=>v?.value!==null&&v?.value!==undefined&&v?.value!=='').map(([k,v])=>[k,v.value]));
const setOption=(step,name,value,source='user-turn')=>{step.options[name]={value:value??null,status:value===null?'unknown':'resolved',required:true,source};};

export const createProjectConversation=async({root,memory,toolHouse})=>{
  const languageRoot=path.join(root,'language');
  const parser=await createSeatParser({languageRoot});
  const createTool=await toolHouse.getTool('base/stamp-new-project');
  const loadTool=await toolHouse.getTool('base/load-project');

  const startGroup=async(session,turn,action)=>{
    const group={id:await memory.allocateId(),created_at:now(),reason:`project-${action}`,stepIds:[],status:'open'};
    const step={id:await memory.allocateId(),groupId:group.id,created_at:now(),turnIds:[turn.id],projectAction:action,status:'input-required',capability:null,options:{},gaps:{},frame:{text:turn.text,seats:{},evidence:[]}};
    group.stepIds.push(step.id);group.currentStepId=step.id;session.groups.push(group);session.steps.push(step);session.bag.currentGroupId=group.id;session.bag.currentStepId=step.id;turn.stepIds=[step.id];return step;
  };
  const refreshGaps=step=>{
    step.gaps={language:[],capability:[],requiredInputs:[],configuration:[],conflicts:[]};
    if(step.projectAction==='create'){
      for(const field of createTool.settings){if(field.required&&!step.options[field.name]?.value)step.gaps.requiredInputs.push({field:field.name,question:field.description||field.title||field.name});}
      if(step.options.type?.value==='react'){
        if(typeof step.options.add_ui_kit?.value!=='boolean')step.gaps.requiredInputs.push({field:'add_ui_kit',question:'Add a UI kit? Please answer yes or no.'});
      }
      if(!step.options.confirm?.value)step.gaps.requiredInputs.push({field:'confirm',question:'Start this project? Please answer yes or no.'});
    } else if(step.projectAction==='load'&&!step.options.name?.value) step.gaps.requiredInputs.push({field:'name',question:'Which project would you like to load?'});
    step.status=step.gaps.requiredInputs.length?'input-required':'ready';
    return step.gaps;
  };
  const nextQuestion=step=>{
    refreshGaps(step);
    const missing=step.gaps.requiredInputs[0]; if(!missing)return null;
    if(missing.field==='type')return'What kind of project? Magic Box, React, HTML, or Audit?';
    if(missing.field==='name')return step.projectAction==='load'?'Which project would you like to load?':'What is the project name?';
    if(missing.field==='folder')return step.options.type?.value==='audit'?'Which folder should I audit? I’ll keep settings, sessions, and results in the .rab project folder.':'What root path should the project use? Box will install it at root path/name.';
    if(missing.field==='add_ui_kit')return missing.question;
    if(missing.field==='confirm'){
      const o=optionsObject(step);
      if(o.type==='audit')return `Start the audit project “${o.name}” for ${o.folder}? Settings, sessions, and results will save together in .rab/projects/. Source files are read-only; .rab is excluded from the scan. Start it? Please answer yes or no.`;
      const local=memory.newProjectPath(o.name);
      if(o.type==='magic-box')return `Create the Magic Box project “${o.name}” in ${path.join(o.folder,o.name)} and save Box work in ${local}? Start it? Please answer yes or no.`;
      if(o.type==='react')return `Start the React project “${o.name}” in ${path.join(o.folder,o.name)} ${o.add_ui_kit?'with':'without'} a UI kit, and save Box work in ${local}? Start it? Please answer yes or no.`;
      return `Start the ${o.type} project “${o.name}” with Box work saved in ${local}? Start it? Please answer yes or no.`;
    }
    return missing.question;
  };
  const save=async(meta,session,turn,reply,parse)=>{turn.reply=reply;await memory.saveSession(meta,session);return presentSession(session,{memory,meta,turn,parse});};
  const complete=(session,step,result)=>{step.status='completed';step.result=result;step.gaps={};const group=session.groups.find(g=>g.id===step.groupId);if(group)group.status='completed';};

  const turn=async({meta,session,text})=>{
    const cancelled=await cancelFlowTurn(session,text,{allocateId:memory.allocateId});
    if(cancelled)return save(meta,session,cancelled,cancelled.reply,null);
    const parse=parser.parse(text,{context:{domain:session.bag?.domain??null},knownEntities:[]});
    let open=session.steps.find(s=>s.id===session.bag.currentStepId&&s.projectAction&&s.status==='input-required');
    // Older saved misses asked whether to create a project. Resume them as lookups.
    if(open?.projectAction==='load'&&open?.missingProject){delete open.missingProject;setOption(open,'name',null);}
    const trimmed=String(text).trim();

    // Project chat history is itself a base Tool and uses the currently loaded project by default.
    if(/\b(?:view|show|load|list)\b[\s\S]*\bchat history\b|^\s*chat history\s*$/i.test(trimmed)){
      const currentTurn={id:await memory.allocateId(),at:now(),text:trimmed,mode:'tool',stepIds:[]};session.turns.push(currentTurn);
      const result=await toolHouse.runTool({key:'base/view-chat-history',options:{project:meta.name},context:{rab_home:memory.rabHome,project:meta}});
      const sessions=result.result.history??[];const count=sessions.reduce((n,s)=>n+(s.turns?.length??0),0);
      const lines=sessions.flatMap(s=>s.turns??[]).slice(-40).map(t=>`${t.text}${t.reply?`\n  Box: ${t.reply}`:''}`);
      return save(meta,session,currentTurn,lines.length?`Loaded ${count} saved turn${count===1?'':'s'} for “${meta.name}”.\n${lines.join('\n')}`:`No saved chat turns yet for “${meta.name}”.`,parse);
    }

    const frame=parse.frames[0];
    const targetProject=parse.frames.some(f=>f.seats.target_type==='project')||(!parse.frames.some(f=>f.seats.target_type)&&/\bproject(?:s)?\b/i.test(trimmed));
    const listIntent=targetProject&&(/\blist\b/i.test(trimmed)||/\b(?:show|view)\s+(?:me\s+)?(?:all\s+|our\s+)?projects\b/i.test(trimmed));
    const createIntent=targetProject&&(/\b(?:start|create|make|build|new)\b/i.test(trimmed)||frame?.seats.operation==='create');
    const loadIntent=targetProject&&(/\b(?:find|load|open|select|use)\b/i.test(trimmed)||['find','select','continue','display'].includes(frame?.seats.operation));
    if(!open&&!listIntent&&!createIntent&&!loadIntent)return null;

    const currentTurn={id:await memory.allocateId(),at:now(),text:trimmed,mode:'project',stepIds:[]};session.turns.push(currentTurn);

    if(open?.projectAction==='load'&&createIntent&&!loadIntent){
      open.status='superseded';open.gaps={};
      const group=session.groups.find(g=>g.id===open.groupId);if(group)group.status='superseded';
      open=null;
    }

    if(listIntent&&open?.projectAction==='load'){
      currentTurn.stepIds=[open.id];open.turnIds.push(currentTurn.id);
      const out=await toolHouse.runTool({key:'base/list-projects',options:{},context:{rab_home:memory.rabHome}});
      const available=out.result.items.length?`These are the available projects:\n${summarizeProjects(out.result.items)}`:'No projects are available.';
      return save(meta,session,currentTurn,`${available}\nTry again with a project name.`,parse);
    }

    if(listIntent&&!open){
      const step=await startGroup(session,currentTurn,'list');step.capability={key:'base/list-projects',kind:'tool'};
      const out=await toolHouse.runTool({key:'base/list-projects',options:{},context:{rab_home:memory.rabHome}});complete(session,step,out.result);
      return save(meta,session,currentTurn,out.result.items.length?summarizeProjects(out.result.items):'There are no known projects yet.',parse);
    }

    if((createIntent||loadIntent)&&!open){
      const action=loadIntent?'load':'create';
      open=await startGroup(session,currentTurn,action);
      open.capability={key:action==='create'?'base/stamp-new-project':'base/load-project',kind:action==='create'?'stamp':'tool'};
      open.frame={text:trimmed,seats:frame?.seats??{},evidence:frame?.evidence??[]};
      setOption(open,'name',action==='load'?projectLookupName(trimmed,parse):projectNameFromText(trimmed,parse),'parsed');
      if(action==='create'){setOption(open,'type',projectTypeFromText(trimmed,parse),'parsed');setOption(open,'folder',absoluteFromParse(parse),'parsed');setOption(open,'confirm',null,'box');}
    } else if(open){
      currentTurn.stepIds=[open.id]; if(!open.turnIds.includes(currentTurn.id))open.turnIds.push(currentTurn.id);
      const choosingUiKit=open.projectAction==='create'&&open.options.type?.value==='react'&&open.options.name?.value&&open.options.folder?.value&&typeof open.options.add_ui_kit?.value!=='boolean';
      if(isNo(trimmed)&&!choosingUiKit){open.status='cancelled';open.gaps={};const group=session.groups.find(g=>g.id===open.groupId);if(group)group.status='cancelled';return save(meta,session,currentTurn,'Cancelled. Your current project is unchanged.',parse);}
      if(open.projectAction==='create'){
        if(!open.options.type?.value){const type=projectTypeFromText(trimmed,parse)||(['react','html','audit'].includes(low(trimmed))?low(trimmed):null);if(type)setOption(open,'type',type);}
        if(!open.options.name?.value){const name=projectNameFromText(trimmed,parse);if(name)setOption(open,'name',name);else if(!path.isAbsolute(unquote(trimmed))&&!isYes(trimmed)&&!isNo(trimmed)&&!['react','html','audit','magic box','magic-box','magicbox'].includes(low(trimmed)))setOption(open,'name',unquote(trimmed));}
        if(!open.options.folder?.value){const folder=path.isAbsolute(unquote(trimmed))?unquote(trimmed):absoluteFromParse(parse);if(folder)setOption(open,'folder',folder);}
        if(open.options.type?.value&&open.options.name?.value&&open.options.folder?.value){
          if(open.options.type.value==='react'&&typeof open.options.add_ui_kit?.value!=='boolean'){
            if(isYes(trimmed))setOption(open,'add_ui_kit',true);
            if(isNo(trimmed))setOption(open,'add_ui_kit',false);
          }else if(isYes(trimmed))setOption(open,'confirm',true);
        }
      }else if(open.projectAction==='load'&&!open.options.name?.value){setOption(open,'name',projectLookupName(trimmed,parse,{bare:true}));}
    }

    if(open.projectAction==='load'){
      const q=nextQuestion(open);if(q)return save(meta,session,currentTurn,q,parse);
      const name=open.options.name.value;
      const out=await toolHouse.runTool({key:'base/load-project',options:{name},context:{rab_home:memory.rabHome}});
      if(['not-found','ambiguous'].includes(out.result.status)){
        setOption(open,'name',null);refreshGaps(open);
        const heading=out.result.status==='not-found'?`No project found for “${name}”.`:'More than one project matched.';
        const choices=out.result.status==='not-found'?out.result.items:out.result.matches;
        const available=choices?.length?`These are the available projects:\n${summarizeProjects(choices)}`:'No projects are available.';
        return save(meta,session,currentTurn,`${heading}\n${available}\nTry again with a project name.`,parse);
      }
      const selected=out.result.project;complete(session,open,{type:'project',name:selected.name,path:selected.root});
      const loaded=out.result.last_session;
      const reply=`Loaded “${selected.name}” with its saved settings and chat history.`;
      if(!loaded){await save(meta,session,currentTurn,reply,parse);return {status:'project-selected',project:selected,sessions:[],session_id:null,switch_message:`Loaded “${selected.name}”. Start a named session to begin.`};}
      if(loaded.id===session.id)return save(meta,session,currentTurn,reply,parse);
      await save(meta,session,currentTurn,reply,parse);
      return {...presentSession(loaded,{memory,meta:selected,parse}),switch_message:reply};
    }

    const q=nextQuestion(open);if(q)return save(meta,session,currentTurn,q,parse);
    if(open.projectAction==='create'&&open.options.confirm?.value===true){
      open.status='running';open.execution_id=await memory.allocateId();open.started_at=now();
      await memory.saveSession(meta,session);
      const supplied={type:open.options.type.value,name:open.options.name.value,folder:open.options.folder.value};
      if(supplied.type==='react')supplied.add_ui_kit=open.options.add_ui_kit.value;
      try{
        const out=await toolHouse.runTool({key:'base/stamp-new-project',options:supplied,context:{project:meta,rab_home:memory.rabHome,__rab_run:{memory:reservedExecutionMemory(memory,open.execution_id),sessionId:session.id}}});
        const project=out.result.child?.result?.project??out.result.project;if(!project)throw new Error('Project Stamp did not return a project.');
        complete(session,open,project);const reply=`Started “${project.name}”.\nFolder: ${project.root}\nType: ${project.type}\nWhat would you like to work on?`;
        await save(meta,session,currentTurn,reply,parse);
        const fresh=await memory.createSession(project,{name:'project start',title:'project start',description:'Initial project creation session.'});
        fresh.groups=structuredClone(session.groups.filter(group=>group.id===open.groupId));
        fresh.steps=structuredClone(session.steps.filter(step=>step.groupId===open.groupId));
        const turnIds=new Set(fresh.steps.flatMap(step=>step.turnIds??[]));
        fresh.turns=structuredClone(session.turns.filter(turn=>turnIds.has(turn.id)));
        fresh.bag.currentGroupId=open.groupId;fresh.bag.currentStepId=open.id;
        fresh.origin={kind:'project-creation',source_project:meta.root,source_session_id:session.id,source_session_persisted:session.ephemeral!==true,source_group_id:open.groupId};
        await memory.saveSession(project,fresh);
        return {...presentSession(fresh,{memory,meta:project,parse}),switch_message:reply};
      }catch(error){
        if(error.project_created){
          open.status='execution-failed';open.gaps={conflicts:[{message:error.message}]};
          return save(meta,session,currentTurn,`The project folder was created at ${error.project_created.root}, but UI-kit setup or finalization failed: ${error.message} Do not repeat project creation; inspect or load that project.`,parse);
        }
        if(open.status==='completed'){
          error.project_created=true;
          error.message=`The project was created, but its session handoff could not finish. Reload the project; do not repeat project creation. ${error.message}`;
          throw error;
        }
        open.status='input-required';open.gaps={conflicts:[{message:error.message}]};setOption(open,'confirm',null);
        if(['UI_KIT_TEMPLATE_EMPTY','UI_KIT_CONFLICT','UI_KIT_UNAVAILABLE'].includes(error.code))setOption(open,'add_ui_kit',null);
        if(error.field)setOption(open,error.field,null);
        return save(meta,session,currentTurn,`The project was not completed: ${error.message}`,parse);
      }
    }
    return save(meta,session,currentTurn,nextQuestion(open)??'Project step is ready.',parse);
  };
  return {turn};
};
