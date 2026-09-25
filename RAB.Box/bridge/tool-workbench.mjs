import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { hash, insist, fault } from '../engine/src/core.mjs';
import { renderTemplateTree } from '../tools/_artifact-plan.mjs';
import { createRabMemory } from './rab-memory.mjs';

// Workbench tickets are a confirmation UI over the SAME Tool House runner.
// No stamp-specific executor, legacy plan adapter, or fallback lives here.
export const createToolWorkbench = ({ toolHouse, project, context }) => {
  const memory=createRabMemory({rabHome:context?.rab_home});
  const fingerprint = async tool => {
    let assets=[];
    try { assets=await renderTemplateTree(path.join(tool.root,'assets')); }
    catch(error) { if(error.code!=='ENOENT')throw error; }
    const shared=await Promise.all(['../tools/_stamp-engines.mjs','../tools/_artifact-plan.mjs'].map(file=>readFile(new URL(file,import.meta.url),'utf8')));
    return hash([tool.id,await readFile(tool.settingsFile,'utf8'),await readFile(tool.scriptFile,'utf8'),tool.template?await renderTemplateTree(tool.template):[],assets,shared]);
  };
  const contract = async name => {
    const tool=await toolHouse.getTool(name,{context});
    return {settings:{name:tool.key,title:tool.title,description:tool.description,options:Object.fromEntries(tool.settings.map(f=>[f.name,f]))},binding:{id:tool.id,path:tool.path}};
  };
  const inspect=async()=>{
    const listing=await toolHouse.listTools({fresh:true,context});
    return {project:{id:project.id,name:project.manifest.project.name??project.id},capabilities:listing.items.filter(t=>t.kind==='stamp').map(t=>({name:t.key,title:t.title,description:t.description,options:Object.fromEntries(t.settings.map(f=>[f.name,f]))})),unavailable:listing.unavailable};
  };
  const resolve=async ticket=>{
    insist(ticket?.version==='tool-house-ticket/v1','RETIRED_CONTRACT','This saved run uses a retired contract. Create a new Tool House request.');
    insist(ticket.project_id===project.id,'WRONG_PROJECT','Ticket belongs to another project.');
    const tool=await toolHouse.getTool(ticket.capability,{context});
    insist(await fingerprint(tool)===ticket.fingerprint,'STALE_CONTRACT','Tool source, template, or settings changed. Prepare a new request.');
    const bound=toolHouse.bindSettings(tool,ticket.options);
    const runtimeMissing=(ticket.runtimeMissing??[]).filter(f=>bound.options[f.name]===undefined||bound.options[f.name]===null||bound.options[f.name]==='');
    const questions=[...bound.missing,...runtimeMissing.filter(f=>!bound.missing.some(m=>m.name===f.name))].map(f=>({request_id:ticket.id,stamp:tool.key,key:f.name,title:f.title,type:f.type,required:true,question:f.description||`What is ${f.title}?`,choices:tool.settings.find(x=>x.name===f.name)?.enum??null}));
    const next={...ticket,options:bound.options,questions};
    return {status:questions.length?'input-required':'ready',ticket:next,questions,frames:[{name:tool.key,capability:tool.key,options:bound.options,settings:tool.settingsFile,script:tool.scriptFile,seats:tool.settings.map(f=>({key:f.name,required:!!f.required,satisfied:bound.options[f.name]!==undefined&&bound.options[f.name]!==null}))}],authority:0};
  };
  const guarded=fn=>async(...args)=>{try{return await fn(...args);}catch(error){return fault(error);}};
  const prepare=guarded(async input=>{
    insist(input&&typeof input==='object'&&input.mode==='command','BAD_REQUEST','Use session Turns for text; manual runs require a canonical Tool House request.');
    insist(Object.keys(input).every(k=>['mode','capability','options'].includes(k)),'BAD_REQUEST','Unexpected canonical request field.');
    const tool=await toolHouse.getTool(input.capability,{context});
    return resolve({version:'tool-house-ticket/v1',id:await memory.allocateId(),project_id:project.id,capability:input.capability,options:input.options??{},fingerprint:await fingerprint(tool)});
  });
  const answer=guarded(async(ticket,reply)=>{
    const current=await resolve(ticket);
    insist(reply.request_id===ticket.id&&reply.stamp===ticket.capability,'INVALID_INPUT','Answer must identify this request and capability.');
    const values=reply.values??{};
    insist(Object.keys(values).length>0&&Object.keys(values).every(key=>current.questions.some(q=>q.key===key)),'INVALID_INPUT','Answer must target a pending seat.');
    return resolve({...ticket,options:{...ticket.options,...values}});
  });
  const execute=guarded(async ticket=>{
    const ready=await resolve(ticket);
    insist(ready.status==='ready','INPUT_REQUIRED','Complete the pending seats first.');
    let done;
    try{done=await toolHouse.runTool({key:ticket.capability,options:ready.ticket.options,context});}
    catch(error){
      if(error.code==='INPUT_REQUIRED'&&error.details?.safe_to_resume===true&&error.details.missing?.length){
        const tool=await toolHouse.getTool(ticket.capability,{context});
        insist(error.details.missing.every(f=>tool.settings.some(s=>s.name===f.name)),'BAD_TOOL','Runtime question must name a declared input.');
        return resolve({...ready.ticket,runtimeMissing:error.details.missing});
      }
      throw error;
    }
    return {status:'completed',receipt:{id:done.execution.execution_id,project_id:project.id,steps:[{capability:ticket.capability,options:done.execution.options,result:done.result,files:(done.result?.verification?.files??[]).map(f=>({...f,path:context.project.root&&f.path.startsWith(context.project.root)?f.path.slice(context.project.root.length+1).replaceAll('\\','/'):f.path})),execution:done.execution,tasks:done.tasks}]}};
  });
  const answerText=async(ticket,text,{stamp,key})=>{
    const q=ticket.questions?.find(q=>q.stamp===stamp&&q.key===key);
    let value=text;
    if(q?.type==='boolean'&&['true','false'].includes(text.trim()))value=text.trim()==='true';
    else if(q?.type==='number'&&text.trim()!=='')value=Number(text);
    return answer(ticket,{request_id:ticket.id,stamp,values:{[key]:value}});
  };
  return {inspect,contract,prepare,resume:guarded(resolve),answer,answerText,execute};
};
