import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { insist } from '../../../engine/src/core.mjs';
import { checkedAbsolutePath } from '../../_artifact-plan.mjs';
import { normalizeInput } from '../_review.mjs';

export const run=async({options,context,helpers})=>{
  insist(options.confirm===true,'CONFIRM_REQUIRED','Set confirm to true to review and create a new file.');
  insist(context?.project?.root,'PROJECT_CONTEXT_REQUIRED','Select the destination project before writing.');
  const input=normalizeInput(options);
  const root=await checkedAbsolutePath(context.project.root);
  // Pin the installed reviewer by identity; a flat project alias cannot replace
  // the check underneath this writer. Never trust a browser-supplied pass flag.
  const reviewer=JSON.parse(await readFile(new URL('../settings.json',import.meta.url),'utf8'));
  const reviewed=await helpers.runTool({key:String(reviewer.id),options:{...input,checks:['all']}});
  const review=reviewed.result;
  const result={status:'blocked',wrote:false,file:input.file,review_execution_id:reviewed.execution.execution_id,review_report:review.evidence.report,review};
  if(!review.passed)return result;
  const hash=createHash('sha256').update(input.code).digest('hex');
  insist(review.file===input.file&&review.code_sha256===hash,'STALE_REVIEW','The reviewed code does not match the requested file and bytes.');
  const output=await helpers.writeArtifactPlan({destination:root,allowedRoot:root,uniqueDirectory:false,files:[{path:input.file,text:input.code}]});
  return {...result,status:'written',wrote:true,destination:path.join(root,input.file),verification:output};
};
