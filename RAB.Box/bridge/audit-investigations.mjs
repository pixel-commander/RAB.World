import {pathValue} from './project-paths.mjs';
import path from 'node:path';
import { readdir } from 'node:fs/promises';
import { createToolHouse } from './tool-house.mjs';
import { createRabMemory } from './rab-memory.mjs';
import { withMemoryLock } from './rab-memory-lock.mjs';
import { containedPath, insist } from '../engine/src/core.mjs';
import { digest } from '../tools/audit/_evidence/records.mjs';
import { loadInvestigation, sourceFreshness, advanceInvestigation, writerFingerprint } from '../tools/audit/_evidence/workflow.mjs';

// A project/session facade over the existing runner and report owner; never an executor.
export const createAuditInvestigations = ({root,rabHome}) => {
  const memory=createRabMemory({rabHome}),house=createToolHouse({root});
  const handle=async body=>{
    insist(body&&typeof body==='object'&&!Array.isArray(body),'BAD_REQUEST','Supply an investigation request.');
    const allowed=['action','session_id','class_name','file','decision','reason','location','styles','plan_id','confirm'];
    insist(Object.keys(body).every(key=>allowed.includes(key)),'BAD_REQUEST','Unexpected investigation input.');
    insist(Number.isSafeInteger(body.session_id)&&body.session_id>0,'BAD_REQUEST','Select an audit project session first.');
    const {meta:project}=await memory.findSession(body.session_id);
    const opened=await memory.openProject(project);
    insist(opened.projectSettings?.type==='audit','AUDIT_PROJECT_REQUIRED','Start or load an audit project in Chat first.');
    const folder=await memory.requireAuditFolder(project);
    const context={project,rab_home:memory.rabHome,__rab_telemetry:{session_id:body.session_id}};
    const run=async options=>{
      const out=await house.runTool({key:'audit/inspect/class-impact',options,context});
      insist(out.result_file,'PERSISTENCE_REQUIRED','The investigation must be saved in its audit project.');
      return {file:out.result_file,result:out.result};
    };
    if(body.action==='list'){
      const directory=await containedPath(opened.dir,pathValue(opened.projectSettings.paths?.results)??'audit-results',{allowMissing:true});
      const stack=[directory],items=[],unavailable=[];
      while(stack.length){
        const dir=stack.pop();let entries;
        try{entries=await readdir(dir,{withFileTypes:true});}catch(error){if(error.code==='ENOENT')continue;throw error;}
        for(const entry of entries){
          if(entry.isSymbolicLink())continue;
          const file=path.join(dir,entry.name);
          if(entry.isDirectory()){stack.push(file);continue;}
          if(!entry.isFile()||!entry.name.endsWith('.json'))continue;
          try{const report=await memory.loadToolReport(project,file);if(report.tool?.key==='audit/inspect/class-impact')items.push({file,subject:report.result?.subject??'Failed investigation',revision:report.result?.revision??null,saved_at:report.saved_at,action:report.result?.action??'inspect',failed:Boolean(report.error)});}
          catch(error){unavailable.push({file,code:error.code??'ERROR',message:error.message});}
        }
      }
      return {items:items.sort((a,b)=>String(b.saved_at).localeCompare(String(a.saved_at))),unavailable};
    }
    if(body.action==='run')return run({folder,class_name:body.class_name});
    insist(typeof body.file==='string','BAD_REQUEST','Choose a saved investigation.');
    const {result}=await loadInvestigation(memory,project,body.file);
    insist(path.resolve(result.scan_root)===path.resolve(folder),'STALE_EVIDENCE','The project audit folder changed; run a new investigation.');
    if(body.action==='read')return {file:body.file,result,freshness:await sourceFreshness(result)};
    if(['declare','plan','handoff'].includes(body.action))return run({class_name:result.subject,action:body.action,previous_report:body.file,
      ...(body.action==='declare'?{decision:body.decision,reason:body.reason}:{}),
      ...(body.action==='plan'?{location:body.location,styles:body.styles}:{})});
    insist(body.action==='execute','BAD_REQUEST','Unknown investigation action.');
    insist(body.confirm===true,'DENIED','Approve the displayed plan before executing it.');
    const lock=path.join(memory.rabHome,'.investigation-locks',digest(path.resolve(folder)));
    return withMemoryLock(lock,async()=>{
      const plan=result.plans.find(x=>x.id===body.plan_id);
      insist(plan?.status==='prepared','BAD_REQUEST','Choose a prepared plan.');
      insist((await sourceFreshness(result)).status==='current','STALE_EVIDENCE','Source changed since investigation; prepare a new plan.');
      insist(await writerFingerprint(root)===plan.writer_fingerprint,'STALE_CONTRACT','The writer changed after this plan was prepared.');
      const recomputed=await advanceInvestigation({records:result,file:body.file,action:'plan',options:{location:plan.target.file,styles:plan.tool.options.styles},root});
      insist(digest(recomputed.plans[0])===digest(plan),'STALE_PLAN','The saved plan differs from its validated scope or expected output.');
      const writer=await house.runTool({key:plan.tool.key,options:plan.tool.options,context});
      return run({folder,class_name:result.subject,action:'verify',previous_report:body.file,plan_id:plan.id,writer_execution_id:writer.execution.execution_id});
    });
  };
  return {handle};
};
