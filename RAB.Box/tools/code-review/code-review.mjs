import { createHash } from 'node:crypto';
import { insist } from '../../engine/src/core.mjs';
import { groups, normalizeInput, selectedGroups, reviewGroup, saveSummary, summarize } from './_review.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
const reviewLeaves=async helpers=>{
  const catalog=await helpers.listTools();
  const leaves=catalog.items.filter(item=>item.key?.startsWith('code-review/')&&item.meta?.group&&item.meta.group!=='all'&&item.meta.authority==='read');
  const order=Object.keys(groups);
  leaves.sort((a,b)=>{
    const ai=order.indexOf(a.meta.group),bi=order.indexOf(b.meta.group);
    return (ai<0?order.length:ai)-(bi<0?order.length:bi)||a.key.localeCompare(b.key);
  });
  insist(leaves.length>0,'NO_REVIEWS','No code-review leaves are available.');
  const names=leaves.map(item=>item.meta.group);
  insist(new Set(names).size===names.length,'BAD_REVIEW','Review group names must be unique.');
  return leaves;
};

const checkedResult=(child,input,tool)=>{
  const result=child?.result;
  insist(Array.isArray(result?.checks)&&Array.isArray(result?.findings),
    'BAD_REVIEW_RESULT',`${tool.key}: review must return checks and findings arrays.`);
  const expected=summarize(input,result.checks,result.findings);
  insist(result.version==='code-review/v1'&&result.file===input.file&&result.code_sha256===hash(input.code)&&
    result.css_sha256===(input.css===undefined?null:hash(input.css))&&
    result.passed===expected.passed&&result.status===expected.status&&
    (!result.passed||result.findings.length===0)&&
    result.totals?.checks_run===expected.totals.checks_run&&
    result.totals?.checks_skipped===expected.totals.checks_skipped&&
    result.totals?.findings===expected.totals.findings&&
    child.execution?.execution_id&&Number.isFinite(child.execution.duration_ms)&&child.execution.duration_ms>=0&&result.evidence?.report,
    'BAD_REVIEW_RESULT',`${tool.key}: incomplete or inconsistent review result.`);
  return result;
};

export const run=async({options,context,tool,helpers})=>{
  const input=normalizeInput(options);
  if(tool.meta.group!=='all')return reviewGroup({input,group:tool.meta.group,context,helpers});
  const leaves=await reviewLeaves(helpers),byName=new Map(leaves.map(item=>[item.meta.group,item]));
  const checks=[], findings=[], children=[];
  for(const group of selectedGroups(options.checks,[...byName.keys()])){
    const tool=byName.get(group);
    const child=await helpers.runTool({key:String(tool.id),options:input});
    const result=checkedResult(child,input,tool);
    checks.push(...result.checks);findings.push(...result.findings);
    children.push({tool:tool.key,execution_id:child.execution.execution_id,duration_ms:child.execution.duration_ms,status:result.status,passed:result.passed,report:result.evidence.report});
  }
  return saveSummary({input,context,result:{...summarize(input,checks,findings),children}});
};
