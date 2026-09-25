import path from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { containedPath, insist } from '../../../engine/src/core.mjs';
import { walkFiles, rel } from '../_shared.mjs';
import { parseDeclarations } from '../../css/_stylesheet.mjs';
import { mergeSelector } from '../../css/add/add.mjs';
import { compactValue } from '../../../bridge/tool-tracking.mjs';
import { digest, identity, validateRecords, relativeSource, atPointer } from './records.mjs';
import { investigateClass } from './class-investigation.mjs';

const fileHash = async file => createHash('sha256').update(await readFile(file)).digest('hex');
export const writerFingerprint = async root => {
  const files = ['tools/css/add/add.mjs','tools/css/_stylesheet.mjs','tools/css/_states.mjs','tools/css/add/state/class/settings.json'];
  return digest(await Promise.all(files.map(async file => [file, await fileHash(path.join(root,file))])));
};
export const sourceFreshness = async records => {
  const snapshot=records.coverage?.source_snapshot;
  if(!snapshot?.files || snapshot.consistent!==true)return {status:'unknown',changed:[],reason:'A consistent captured source revision is unavailable.'};
  const changed=[],issues=[];
  const current=await walkFiles(records.scan_root,{onSkipped:item=>{if(item.reason!=='excluded-directory')issues.push(item);}});
  const known=new Set([...snapshot.files.map(x=>x.file),...(records.coverage.skipped??[]).map(x=>x.file)]);
  for(const file of current)if(!known.has(rel(records.scan_root,file)))changed.push({file:rel(records.scan_root,file),reason:'new-input'});
  for(const item of snapshot.files){
    try{const file=await containedPath(records.scan_root,relativeSource(item.file));if(await fileHash(file)!==item.sha256)changed.push({file:item.file,reason:'changed-bytes'});}
    catch(error){changed.push({file:item.file,reason:'unavailable',code:error.code});}
  }
  return {status:changed.length?'stale':issues.length?'unknown':'current',changed,issues,meaning:'Compared captured files and current inventory; not a filesystem transaction.'};
};

export const loadInvestigation = async (memory, project, file) => {
  const report=await memory.loadToolReport(project,file);
  insist(!report.error && report.tool?.key==='audit/inspect/class-impact','BAD_EVIDENCE','Choose a completed class investigation report.');
  const rootTask=report.tasks?.find(x=>x.execution_id===report.execution_id);
  insist(rootTask?.status==='completed','BAD_EVIDENCE','The investigation did not complete.');
  const result=await memory.resolveToolValue(project,{version:'tool-result-ref/v1',file,pointer:'#/result'});
  validateRecords(result);
  insist(result.project.id===project.id,'BAD_EVIDENCE','Investigation belongs to another project.');
  const reports=new Map([[file,{report,sha256:digest(report)}]]),resolved=new Map();
  for(const name of ['entities','relations','findings','investigations','conclusions','plans'])
    for(const row of result[name])for(const ref of row.evidence){
      ref.file??=file;
      if(!reports.has(ref.file)){const report=await memory.loadToolReport(project,ref.file);reports.set(ref.file,{report,sha256:digest(report)});}
      const {report:source,sha256:fingerprint}=reports.get(ref.file);
      insist(!source.error,'BAD_EVIDENCE','Referenced source report failed.');
      if(ref.report_sha256)insist(ref.report_sha256===fingerprint,'STALE_EVIDENCE','Referenced source report changed.');
      ref.report_sha256??=fingerprint;
      const task=source.tasks?.find(item=>item.execution_id===ref.execution_id);
      insist(task?.status==='completed'&&typeof task.result_ref?.$ref==='string','BAD_EVIDENCE','Referenced source execution is missing or incomplete.');
      const pointer=task.result_ref.$ref,key=`${ref.file}\0${pointer}`;
      if(!resolved.has(key))resolved.set(key,await memory.resolveToolValue(project,{version:'tool-result-ref/v1',file:ref.file,pointer}));
      atPointer(resolved.get(key),ref.pointer);
    }
  result.source.report??=file;
  const primary=reports.get(result.source.report)?.report??await memory.loadToolReport(project,result.source.report);
  const sourceTask=primary.tasks?.find(task=>task.execution_id===result.source.execution_id);
  insist(sourceTask?.status==='completed'&&sourceTask.result_ref?.$ref,'BAD_EVIDENCE','Primary source execution is unavailable.');
  const sourceKey=`${result.source.report}\0${sourceTask.result_ref.$ref}`;
  const index=resolved.get(sourceKey)??await memory.resolveToolValue(project,{version:'tool-result-ref/v1',file:result.source.report,pointer:sourceTask.result_ref.$ref});
  const derived=investigateClass({result:index,source:result.source,project:result.project,className:result.subject});
  const facts=value=>({revision:value.revision,scan_root:value.scan_root,
    entities:value.entities.map(({id,kind,name,location})=>({id,kind,name,location})),
    relations:value.relations.map(({id,kind,from,to})=>({id,kind,from,to})),
    impact:value.conclusions.map(({summary,definitions,consumers,possible_impact})=>({summary,definitions,consumers,possible_impact}))});
  insist(digest(facts(result))===digest(facts(derived)),'BAD_EVIDENCE','Saved class facts conflict with their source execution.');
  return {report,result};
};

export const advanceInvestigation = async ({records,file,action,options,root}) => {
  const next=structuredClone(records);
  next.action=action; next.previous_report=file;
  if(action==='declare'){
    insist(['intentional','accidental','unknown'].includes(options.decision),'BAD_INPUT','Choose intentional, accidental, or unknown.');
    insist(typeof options.reason==='string'&&options.reason.trim()&&options.reason.length<=4000,'BAD_INPUT','Supply a scoped reason, up to 4,000 characters.');
    const now=new Date().toISOString();
    next.findings.push({id:identity('declaration',records.revision,options.decision,options.reason,now),kind:'declared-intent',summary:`Declared intent: ${options.decision}. ${options.reason.trim()}`,
      decision:options.decision,reason:options.reason.trim(),author:'local operator',declared_at:now,scope:{class_name:records.subject,scan_root:records.scan_root,revision:records.revision},
      invalidation:'Revisit when source revision or class purpose changes.',state:{origin:'human-declared',resolution:'declared',freshness:'revision-bound',disposition:'open'},evidence:records.entities[0].evidence});
  }else if(action==='plan'){
    insist((await sourceFreshness(records)).status==='current','STALE_EVIDENCE','Refresh the investigation before preparing a change.');
    const declaration=records.findings.filter(x=>x.kind==='declared-intent').at(-1);
    insist(declaration&&declaration.decision!=='unknown'&&declaration.scope?.revision===records.revision,'INTENT_REQUIRED','Record the intended change for this source revision before preparing a plan.');
    insist(/^[A-Za-z_][A-Za-z0-9_-]*$/.test(records.subject),'BAD_INPUT','The first writer supports one simple CSS class token.');
    const relative=relativeSource(options.location);
    insist(relative.endsWith('.css')&&records.conclusions[0].definitions.includes(relative),'BAD_INPUT','Choose an observed CSS definition file.');
    const target=await containedPath(records.scan_root,relative);
    insist((await stat(target)).size<=512*1024,'FILE_LIMIT','The first bounded plan supports CSS files up to 512 KiB.');
    const before=await readFile(target,'utf8');
    const declarations=parseDeclarations(options.styles);
    insist(declarations.every(([key,value])=>key.startsWith('--')&&/^var\(--[A-Za-z0-9_-]+\)$/.test(value)),'BAD_INPUT','This bounded plan accepts custom properties whose values reference one existing token: --action-ink: var(--ink).');
    const declaredTokens=new Set();
    for(const item of records.coverage.source_snapshot.files.filter(item=>item.file.endsWith('.css'))){
      const css=await readFile(await containedPath(records.scan_root,relativeSource(item.file)),'utf8');
      for(const match of css.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/(?:^|[;{])\s*(--[A-Za-z0-9_-]+)\s*:/g))declaredTokens.add(match[1]);
    }
    insist(declarations.every(([,value])=>declaredTokens.has(value.slice(4,-1))),'TOKEN_REQUIRED','The referenced token must have a declaration in the captured CSS scope.');
    const selectors=[`.${records.subject}:active`,`.${records.subject}.is-active`];
    const merged=mergeSelector(before,selectors.join(',\n'),declarations);
    insist(merged.changed,'NO_CHANGE','The proposed styles already match.');
    const targetHash=await fileHash(target);
    const styles=declarations.map(([key,value])=>`${key}: ${value};`).join('\n');
    const plan={id:identity('plan',records.revision,relative,styles),status:'prepared',target:{file:relative,sha256:targetHash},
      source_revision:records.revision,writer_fingerprint:await writerFingerprint(root),
      tool:{key:'css/add/state/class',id:JSON.parse(await readFile(path.join(root,'tools/css/add/state/class/settings.json'),'utf8')).id,options:{location:target,class_name:records.subject,state:'active, is-active',styles}},
      expected:{sha256:createHash('sha256').update(merged.source).digest('hex'),selectors},
      verification_requirements:['Exact expected target bytes','All other captured source files unchanged','Relevant class re-audit','Application build/tests and browser checks when applicable'],
      limits:['One explicit CSS file; no automatic general refactor.','Local byte and audit checks do not prove visual equivalence.','No transactional rollback; a partial failure requires inspection.'],
      recovery:{before_sha256:targetHash,before_text:before},evidence:records.entities[0].evidence};
    next.plans=[plan];
  }else if(action==='handoff'){
    next.handoff={objective:`Resolve the remaining class-impact questions for ${records.subject}.`,scope:records.conclusions[0].possible_impact,
      evidence:{report:file,revision:records.revision,source:records.source},gaps:records.findings.filter(x=>x.state?.resolution==='unresolved').map(x=>({kind:x.kind,summary:x.summary})),
      rules:['Components own structure; atoms own skin.','Preserve unresolved evidence and public contracts.','Use current canonical stamps and the shared runner.'],
      forbidden_actions:['No work outside an explicitly approved plan.','No changes to historical audit reports.','No automatic publication or cloud transmission.'],
      acceptance:['Verify intended targets and unchanged unrelated source.','Run applicable build/tests and relevant audits.','Report failures and unresolved gaps.'],
      stop_conditions:['A new owner, public contract, or write target is required.'],
      disclosure:'Prepared locally. Contains project paths, evidence references and gaps; review before sharing.'};
  }else insist(false,'BAD_REQUEST','Unsupported investigation action.');
  return validateRecords(next);
};

export const verifyPlan = async ({before,after,plan,writer,preparedAt}) => {
  const checks=[];
  const actual=new Map((after.coverage.source_snapshot?.files??[]).map(x=>[x.file,x.sha256]));
  checks.push({name:'Re-audit uses the approved source root',passed:typeof before.scan_root==='string'&&typeof after.scan_root==='string'&&path.resolve(before.scan_root)===path.resolve(after.scan_root)});
  checks.push({name:'Post-scan source and coverage are consistent',passed:after.coverage.source_snapshot?.consistent===true&&
    !(after.coverage.skipped??[]).some(item=>['read-error','directory-read-error','symbolic-link','unsupported-entry'].includes(item.reason))&&
    digest(before.coverage.skipped??[])===digest(after.coverage.skipped??[])&&digest(before.coverage.scope)===digest(after.coverage.scope)});
  checks.push({name:'Target bytes match prepared plan',passed:actual.get(plan.target.file)===plan.expected.sha256});
  const unrelated=(before.coverage.source_snapshot?.files??[]).filter(x=>x.file!==plan.target.file&&actual.get(x.file)!==x.sha256).map(x=>x.file);
  const prior=new Set((before.coverage.source_snapshot?.files??[]).map(x=>x.file));
  const added=[...actual.keys()].filter(file=>!prior.has(file));
  checks.push({name:'Other captured source unchanged',passed:unrelated.length===0&&added.length===0,detail:{changed:unrelated,added}});
  checks.push({name:'Class re-audit retained consumers',passed:digest(before.conclusions[0].consumers)===digest(after.conclusions[0].consumers)});
  checks.push({name:'Writer completed the prepared operation',passed:writer?.status==='completed'&&writer?.tool?.id===plan.tool.id&&
    digest(writer.options)===digest(compactValue(plan.tool.options))&&Number.isFinite(Date.parse(preparedAt))&&Date.parse(writer.start_date)>=Date.parse(preparedAt)});
  return {status:checks.every(x=>x.passed)?'passed':'failed',checks,writer_execution_id:writer?.execution_id??null,
    plan_id:plan.id,scope:'Exact file bytes, source manifest, and class re-audit only.',remaining:['Application build/tests and visual behavior require their own recorded verification.']};
};
