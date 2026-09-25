import path from 'node:path';
import { appendFile, mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import { createRabMemory } from './rab-memory.mjs';

const hash = value => createHash('sha256').update(String(value)).digest('hex').slice(0,16);
const safeJson = value => {
  const seen=new WeakSet();
  return JSON.parse(JSON.stringify(value,(key,item)=>{
    if(typeof item==='bigint')return String(item);
    if(item && typeof item==='object'){
      if(seen.has(item))return '[Circular]';
      seen.add(item);
    }
    return item;
  }));
};
const nowIso = () => new Date().toISOString();
const readLines = async file => {
  try { return (await readFile(file,'utf8')).split(/\r?\n/).filter(Boolean).map(line=>{try{return JSON.parse(line);}catch{return null;}}).filter(Boolean); }
  catch(error){ if(error.code==='ENOENT')return []; throw error; }
};
const atomicJson = async (file,data) => {
  await mkdir(path.dirname(file),{recursive:true});
  const tmp=`${file}.${process.pid}.${randomBytes(3).toString('hex')}.tmp`;
  await writeFile(tmp,JSON.stringify(data,null,2)+'\n','utf8');
  await rename(tmp,file);
};
const ageMs=(at,now)=>Math.max(0,now-new Date(at).getTime());
const WINDOWS={h24:86400000,d7:7*86400000,d30:30*86400000};
const TERMINAL_STATES=new Set(['completed','failed','blocked','cancelled','user-opt-out','superseded','abandoned','interrupted']);
const incr=(obj,key,by=1)=>{obj[key]=(obj[key]??0)+by;};
const entityKey=subject=>subject?.id!==undefined&&subject?.id!==null?`${subject.type??'entity'}:${subject.id}`:`${subject?.type??'entity'}:${subject?.key??subject?.address??subject?.form??subject?.name??'unknown'}`;
const executionKey=event=>event.execution_id??JSON.stringify([event.session_id??null,event.step_id??null,event.task_id]);

export const wordId = form => `word-${hash(String(form).toLowerCase())}`;

export const createUsageLedger = ({rabHome}={}) => {
  const memory=createRabMemory({rabHome});
  const paths=async meta=>{
    const opened=await memory.openProject(meta);
    const dir=path.join(opened.dir,'telemetry');
    await mkdir(dir,{recursive:true});
    return {dir,events:path.join(dir,'events.jsonl'),rollup:path.join(dir,'HEALTH.json')};
  };

  const append = async (meta,event={}) => {
    const p=await paths(meta);
    const at=event.at??nowIso();
    const record=safeJson({
      version:'telemetry-event/v0.8.5',
      event_id:event.event_id??`${Date.now()}-${randomBytes(4).toString('hex')}`,
      at,
      project_key:memory.projectKey(meta),
      ...event,
      at
    });
    await appendFile(p.events,JSON.stringify(record)+'\n','utf8');
    return record;
  };
  const appendMany=async(meta,events=[])=>{const out=[];for(const event of events)out.push(await append(meta,event));return out;};
  const read=async(meta,{limit=5000}={})=>{const p=await paths(meta);const rows=await readLines(p.events);return limit>0?rows.slice(-limit):rows;};

  const summarize = async (meta,{limit=0,now=Date.now()}={}) => {
    const events=await read(meta,{limit});
    const entities={},losses={},questions={},words={},byType={},recent=[],resolutions={},terminals={},openTasks={};
    const ensure=(bucket,key,seed)=>bucket[key]??=(seed??{key,total:0,success:0,failure:0,direct:0,auto:0,first_used:null,last_used:null,uses_24h:0,uses_7d:0,uses_30d:0});
    for(const event of events){
      incr(byType,event.type??'unknown');
      if(ageMs(event.at,now)<=WINDOWS.h24)recent.push(event);
      if(event.type==='capability-start'&&event.task_id){ openTasks[executionKey(event)]={task_id:event.task_id,execution_id:event.execution_id??null,start_date:event.start_date??event.at,subject:event.subject??null,session_id:event.session_id??null,step_id:event.step_id??null,turn_id:event.turn_id??null,auto:Boolean(event.auto),last_stage:event.last_stage??'started'}; }
      if(event.type==='terminal'){
        if(event.task_id)delete openTasks[executionKey(event)];
        const state=TERMINAL_STATES.has(event.terminal_state)?event.terminal_state:'failed';
        const row=terminals[state]??=( {state,total:0,reasons:{},by_capability:{}} ); row.total++;
        if(event.reason?.code)incr(row.reasons,event.reason.code);
        if(event.subject?.address)incr(row.by_capability,event.subject.address);
      }
      if(event.subject){
        const key=entityKey(event.subject);const row=ensure(entities,key,{key,subject:event.subject,total:0,success:0,failure:0,direct:0,auto:0,first_used:null,last_used:null,uses_24h:0,uses_7d:0,uses_30d:0,questions:0,losses:0});
        if(event.type==='capability-use'){
          row.total++; if(event.auto)row.auto++;else row.direct++;
          if(Number.isFinite(event.duration_ms)&&event.duration_ms>=0){
            const timing=row.timing??={count:0,total_ms:0,min_ms:event.duration_ms,max_ms:event.duration_ms,average_ms:0};
            timing.count++;timing.total_ms+=event.duration_ms;timing.min_ms=Math.min(timing.min_ms,event.duration_ms);timing.max_ms=Math.max(timing.max_ms,event.duration_ms);timing.average_ms=timing.total_ms/timing.count;
          }
          if(event.outcome==='success'||event.status==='completed'||event.status==='verified')row.success++;
          if(event.outcome==='failure'||event.status==='failed'||event.status==='execution-failed')row.failure++;
          row.first_used=!row.first_used||event.at<row.first_used?event.at:row.first_used; row.last_used=!row.last_used||event.at>row.last_used?event.at:row.last_used;
          const age=ageMs(event.at,now); if(age<=WINDOWS.h24)row.uses_24h++;if(age<=WINDOWS.d7)row.uses_7d++;if(age<=WINDOWS.d30)row.uses_30d++;
        }
        if(event.type==='question')row.questions++; if(event.type==='loss')row.losses++;
      }
      if(event.type==='loss-resolved'){const key=event.kind??'unknown';incr(resolutions,key);}
      if(event.type==='loss'){
        const key=event.kind??'unknown';const row=ensure(losses,key,{kind:key,total:0,resolved:0,first_at:null,last_at:null,by_seat:{},by_capability:{}});row.total++;if(event.resolved)row.resolved++;row.first_at=!row.first_at||event.at<row.first_at?event.at:row.first_at;row.last_at=!row.last_at||event.at>row.last_at?event.at:row.last_at;if(event.seat)incr(row.by_seat,event.seat);if(event.subject?.address)incr(row.by_capability,event.subject.address);
      }
      if(event.type==='question'){
        const key=event.kind??'unknown';const row=ensure(questions,key,{kind:key,total:0,resolved:0,first_at:null,last_at:null,by_seat:{}});row.total++;if(event.resolved)row.resolved++;row.first_at=!row.first_at||event.at<row.first_at?event.at:row.first_at;row.last_at=!row.last_at||event.at>row.last_at?event.at:row.last_at;if(event.seat)incr(row.by_seat,event.seat);
      }
      if(event.type==='word-use'&&event.subject?.form){
        const key=event.subject.id??wordId(event.subject.form);const row=ensure(words,key,{id:key,form:event.subject.form,total:0,first_used:null,last_used:null,seats:{},successful_resolutions:0});row.total++;if(event.seat)incr(row.seats,event.seat);if(event.outcome==='success')row.successful_resolutions++;row.first_used=!row.first_used||event.at<row.first_used?event.at:row.first_used;row.last_used=!row.last_used||event.at>row.last_used?event.at:row.last_used;
      }
    }
    const entityRows=Object.values(entities).map(row=>{
      const age=row.last_used?ageMs(row.last_used,now):Infinity;
      const failureRate=row.total?row.failure/row.total:0;
      let temperature='unproven';
      if(row.uses_7d>=20)temperature='hot';
      else if(row.total>=20&&age>WINDOWS.d30)temperature='stale';
      else if(row.total>=10&&age>WINDOWS.d7)temperature='cold';
      else if(row.total>=10)temperature='core';
      if(row.total>=10&&failureRate>=0.2)temperature='noisy';
      if(row.auto>row.direct*4&&row.total>=10)temperature='workhorse';
      return {...row,failure_rate:+failureRate.toFixed(4),temperature};
    }).sort((a,b)=>b.uses_7d-a.uses_7d||b.total-a.total||String(a.key).localeCompare(String(b.key)));
    for(const row of Object.values(losses))row.resolved=(row.resolved??0)+(resolutions[row.kind]??0);
    const summary={
      version:'house-health/v0.8.5',generated_at:new Date(now).toISOString(),project:{id:meta.id,name:meta.name,root:meta.root},events:events.length,by_type:byType,
      entities:entityRows,words:Object.values(words).sort((a,b)=>b.total-a.total||a.form.localeCompare(b.form)),losses:Object.values(losses).sort((a,b)=>b.total-a.total),questions:Object.values(questions).sort((a,b)=>b.total-a.total),terminal_states:Object.values(terminals).sort((a,b)=>b.total-a.total||a.state.localeCompare(b.state)),open_tasks:Object.values(openTasks).sort((a,b)=>String(a.start_date).localeCompare(String(b.start_date))),recent:recent.slice(-100).reverse(),
      totals:{questions:Object.values(questions).reduce((n,x)=>n+x.total,0),losses:Object.values(losses).reduce((n,x)=>n+x.total,0),failures:entityRows.reduce((n,x)=>n+x.failure,0),tool_uses:entityRows.reduce((n,x)=>n+x.total,0),non_completed:Object.entries(terminals).filter(([k])=>k!=='completed').reduce((n,[,x])=>n+x.total,0),open_tasks:Object.keys(openTasks).length}
    };
    const p=await paths(meta);await atomicJson(p.rollup,summary);return summary;
  };
  const reconcileOpenTasks=async(meta,{reason='PROCESS_ENDED_BEFORE_TERMINAL_RECEIPT'}={})=>{
    const events=await read(meta,{limit:0}); const starts=new Map(),terminal=new Set();
    for(const event of events){ if(event.type==='capability-start'&&event.task_id)starts.set(executionKey(event),event); if(event.type==='terminal'&&event.task_id)terminal.add(executionKey(event)); }
    const repaired=[];
    for(const [taskId,start] of starts){
      if(terminal.has(taskId))continue;
      let execution=null;
      if(start.execution_id){
        try{execution=await memory.loadToolExecution(meta,start.session_id,start.execution_id);}catch(error){if(error.code!=='ENOENT')throw error;}
        if(execution?.status==='running'){
          execution.status='interrupted';
          execution.error={code:reason,message:'The process ended without a completed tracking record. End time and duration are unknown.'};
          await memory.saveToolExecution(meta,execution);
        }
      }
      const state=execution?.status??'interrupted';
      const completion={task_id:start.task_id,execution_id:start.execution_id??null,parent_execution_id:start.parent_execution_id??null,start_date:execution?.start_date??start.start_date??start.at,end_date:execution?.end_date??null,duration_ms:execution?.duration_ms??null,session_id:start.session_id??null,step_id:start.step_id??null,turn_id:start.turn_id??null,auto:Boolean(start.auto),subject:start.subject??null,status:state,outcome:state==='completed'?'success':state==='blocked'?'blocked':'failure'};
      if(execution&&!events.some(event=>event.type==='capability-use'&&event.execution_id===start.execution_id))await append(meta,{...completion,type:'capability-use',error:execution.error});
      repaired.push(await append(meta,{...completion,type:'terminal',terminal_state:state,last_stage:'reconciled',reason:{code:execution?.error?.code??(state==='completed'?'COMPLETED':reason)}}));
    }
    return repaired;
  };
  return Object.freeze({append,appendMany,read,summarize,reconcileOpenTasks,paths});
};
