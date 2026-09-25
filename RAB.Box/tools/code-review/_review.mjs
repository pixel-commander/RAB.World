import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRabMemory } from '../../bridge/rab-memory.mjs';
import { insist, relativePath } from '../../engine/src/core.mjs';
import { writeArtifactPlan } from '../_artifact-plan.mjs';

export const groups=Object.freeze({
  guards:{accept:/\.(?:[cm]?[jt]s|jsx|tsx)$/i,tools:['bag-guards','prop-renames']},
  grids:{accept:/\.(?:jsx|tsx)$/i,tools:['grid-continuity']},
  atoms:{accept:/\.css$/i,tools:['css-tokens','css-states']},
  conventions:{accept:/\.(?:[cm]?[jt]s|jsx|tsx)$/i,tools:['conventions']}
});
const digest=value=>createHash('sha256').update(value).digest('hex');
const scope='Selected static pattern checks only; no syntax/type/build/runtime validation or whole-project review.';
const supportName='.code-review-context.css';

export const normalizeInput=options=>{
  const file=relativePath(options.file);
  insist(file!=='.'&&file!==supportName,'INVALID_PATH','Supply an intended source filename.');
  insist(typeof options.code==='string'&&options.code.trim().length>0,'INVALID_INPUT','Supply nonempty proposed code.');
  insist(options.css===undefined||typeof options.css==='string','INVALID_INPUT','Supporting CSS must be text.');
  insist(Buffer.byteLength(options.code)+Buffer.byteLength(options.css??'')<=256*1024,'INPUT_TOO_LARGE','Code and supporting CSS must fit within 256 KiB.');
  return {file,code:options.code,...(options.css===undefined?{}:{css:options.css})};
};
export const selectedGroups=(value,available=Object.keys(groups))=>{
  if(Array.isArray(value)&&value.length===1&&value[0]==='all')return [...available];
  const selected=value===undefined?available:value;
  insist(Array.isArray(selected)&&selected.length>0&&selected.length<=100,'INVALID_INPUT','checks must contain one to 100 review names.');
  const allowed=new Set(available);
  insist(selected.every(group=>typeof group==='string'&&allowed.has(group))&&new Set(selected).size===selected.length,'INVALID_INPUT',`Use unique available reviews: ${available.join(', ')}.`);
  return [...selected];
};
export const summarize=(input,checks,findings)=>{
  const checksRun=checks.filter(check=>check.status!=='skipped').length;
  const passed=checksRun>0&&checks.every(check=>['passed','skipped'].includes(check.status));
  return {version:'code-review/v1',status:passed?'passed':checksRun?'failed':'skipped',passed,file:input.file,code_sha256:digest(input.code),css_sha256:input.css===undefined?null:digest(input.css),scope,checks,findings,totals:{checks_run:checksRun,checks_skipped:checks.length-checksRun,findings:findings.length}};
};
const allocateEvidence=async context=>{
  const memory=createRabMemory({rabHome:context?.rab_home}),id=await memory.allocateId();
  const directory=path.join(memory.rabHome,'temp','test',String(id));
  return {id,directory,report:path.join(directory,'result.json')};
};
const settings=(evidence,input)=>JSON.stringify({id:evidence.id,name:'code-review',title:'Proposed code review',description:scope,settings:[],meta:{kind:'code-review',file:input.file,code_sha256:digest(input.code)}},null,2)+'\n';
const writeResult=async(evidence,result)=>{
  const output={...result,evidence};
  await writeArtifactPlan({destination:evidence.directory,allowedRoot:evidence.directory,uniqueDirectory:false,files:[{path:'result.json',text:JSON.stringify(output,null,2)+'\n'}]});
  return output;
};
export const saveSummary=async({input,context,result})=>{
  const evidence=await allocateEvidence(context);
  await writeArtifactPlan({destination:evidence.directory,files:[{path:'settings.json',text:settings(evidence,input)}]});
  return writeResult(evidence,result);
};

export const reviewGroup=async({input,group,context,helpers})=>{
  const definition=groups[group];insist(definition,'BAD_TOOL','Unknown code review group.');
  const evidence=await allocateEvidence(context),sourceRoot=path.join(evidence.directory,'source');
  const files=[{path:'settings.json',text:settings(evidence,input)},{path:`source/${input.file}`,text:input.code}];
  if(group==='grids'&&input.css)files.push({path:`source/${supportName}`,text:input.css});
  const staged=await writeArtifactPlan({destination:evidence.directory,files});
  const checks=[],findings=[];
  for(const name of definition.tools){
    const key=`audit/code-review/${name}`;
    if(!definition.accept.test(input.file)){
      checks.push({tool:key,group,status:'skipped',execution_id:null,duration_ms:0,findings:0,reason:'File extension is not supported by this checker.'});continue;
    }
    // Existing auditors run as tracked children. The selected project remains
    // the receipt owner; only the explicitly supplied scan folder changes.
    insist(typeof helpers.runScratchTool==='function','RUNNER_UPDATE_REQUIRED','Restart the Box backend to load the shared scratch-review runner helper.');
    const child=await helpers.runScratchTool({key,options:{folder:sourceRoot}});
    const result=child.result;
    insist(result?.totals?.files_scanned===1&&Array.isArray(result.rows)&&result.totals.matches===result.rows.length,'INCOMPLETE_REVIEW',`${key} did not completely review the staged source file.`);
    // A legacy audit's status:"ok" means it ran, not that there were no findings.
    const rows=result.rows.map(row=>({...row,checker:key,group,severity:'error'}));
    findings.push(...rows);
    checks.push({tool:key,group,status:rows.length?'failed':'passed',execution_id:child.execution.execution_id,duration_ms:child.execution.duration_ms,findings:rows.length});
  }
  for(const file of staged.files)insist(digest(await readFile(file.path))===file.sha256,'STALE_REVIEW','Staged source changed during review.');
  return writeResult({...evidence,source:path.join(sourceRoot,input.file)},{...summarize(input,checks,findings),children:[]});
};
