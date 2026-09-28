import {readFile} from 'node:fs/promises';
import {appendHistory} from '../../RAB.Toolkits/world-audit/audit-runner/history.mjs';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import path from 'node:path';
import {run,runBatch} from '../../RAB.Toolkits/world-audit/audit-runner/audit-runner.mjs';
import {learnAll,saveFolderScan,ignoredPaths} from '../../RAB.Toolkits/world-audit/audit-runner/audit-store.mjs';
export const createAuditQueue=(file,execute,saveRun=async()=>{})=>{
 const jobs=[];let running=false;let summary=null;
 const snapshot=()=>({running,summary,jobs:jobs.map(job=>({...job,duration_ms:job.status==='running'?Date.now()-job.date_start:job.duration_ms}))});
 const enqueue=(paths,action)=>{
  if(!['details','learn-all'].includes(action)||!Array.isArray(paths)||!paths.length||paths.length>1000||!paths.every(value=>typeof value==='string'&&value.length>0))throw new Error('Invalid jobs.');
  const db=new DatabaseSync(file,{readOnly:true});let rows;
  try{rows=[...new Set(paths)].map(id=>db.prepare('SELECT path FROM folders WHERE path=?').get(id));}finally{db.close();}
  if(rows.some(row=>!row))throw new Error('Unknown folder.');
  for(const row of rows){if(jobs.some(job=>job.folder===row.path&&job.action===action&&['pending','running'].includes(job.status)))continue;
   jobs.push({id:randomUUID(),folder:row.path,path:row.path,action,status:'pending',date_start:null,date_end:null,error_count:0,duration_ms:0,stats:{}});
  }return snapshot();
 };
 const drain=async()=>{try{await runBatch({jobs:jobs.filter(job=>job.status==='pending'),execute,saveRun,onSummary:value=>{summary=value;}});}finally{running=false;}};
 return {snapshot,enqueue,scan:options=>{if(typeof options.path!=='string'||!options.path.trim())throw new Error('Path required.');if(options.depth!=='all'&&(!Number.isInteger(Number(options.depth))||Number(options.depth)<0))throw new Error('Invalid depth.');jobs.push({id:randomUUID(),folder:options.path,path:options.path,action:'scan',inputs:options,status:'pending',date_start:null,date_end:null,error_count:0,duration_ms:0,stats:{}});return snapshot();},supply:(id,inputs)=>{const job=jobs.find(job=>job.id===id&&job.status==='input-required');if(!job||!inputs||typeof inputs!=='object'||Array.isArray(inputs))throw new Error('Invalid job inputs.');job.inputs={...job.inputs,...inputs};job.status='pending';job.missing=[];return snapshot();},start:()=>{if(!running && jobs.some(job=>job.status==='pending')){running=true;void drain();}return snapshot();},remove:id=>{const index=jobs.findIndex(job=>job.id===id&&job.status==='pending');if(index>=0)jobs.splice(index,1);return snapshot();}};
};
export const auditJobQueue=file=>createAuditQueue(file,async(job,onProgress,onExecution)=>{
 const defaults=JSON.parse(await readFile(new URL('../../RAB.Toolkits/world-audit/find-and-list/folder-list/settings.json',import.meta.url),'utf8')).settings.find(field=>field.name==='exclude').default;
 const inputs={path:job.path,depth:job.action==='learn-all'?'all':0,scan_files:true,...job.inputs,exclude:[...defaults,...ignoredPaths(file)]};
 const result=await run({options:{world:'laptop',audit_type:'folder-scan',options:inputs},context:{rab_home:path.resolve(path.dirname(file),'../../..'),onProgress,onExecution}});
 if(result.status==='input-required')return result;
 if(result.status!=='completed')throw new Error(result.execution?.error?.message??'Audit failed.');
 saveFolderScan(file,JSON.parse(await readFile(result.report_file,'utf8')));
 return result.result;
},summary=>appendHistory(path.join(path.dirname(file),'history.jsonl'),summary));
