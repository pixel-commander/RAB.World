import { investigateClass } from '../../_evidence/class-investigation.mjs';
import { insistEvidence } from '../../_evidence/records.mjs';
import { advanceInvestigation, loadInvestigation, verifyPlan } from '../../_evidence/workflow.mjs';
import { createRabMemory } from '../../../../bridge/rab-memory.mjs';

export const run = async ({ options, context, helpers, root }) => {
  const action=options.action??'inspect';
  const memory=context?.project?createRabMemory({rabHome:context.rab_home}):null;
  let previous,previousEnvelope;
  if(action!=='inspect'){
    insistEvidence(memory&&typeof options.previous_report==='string','A saved audit investigation is required.');
    const loaded=await loadInvestigation(memory,context.project,options.previous_report);
    previous=loaded.result;previousEnvelope=loaded.report;
    insistEvidence(previous.subject===options.class_name,'Class token differs from the saved investigation.');
    insistEvidence(previous.scan_root.replaceAll('\\','/').toLowerCase()===(await memory.requireAuditFolder(context.project)).replaceAll('\\','/').toLowerCase(),'The project audit folder changed; run a new investigation.');
    if(action!=='verify')return advanceInvestigation({records:previous,file:options.previous_report,action,options,root});
  }
  const child = await helpers.runTool({ key:'audit/count/classes', options:options.folder === undefined ? {} : {folder:options.folder}, context });
  insistEvidence(child.execution?.status === 'completed', 'The class index did not complete.');
  const records=investigateClass({ result:child.result, className:options.class_name,
    project:context?.project ?? {id:`scan:${child.result.folder}`,root:null},
    source:{execution_id:child.execution.execution_id,tool:child.tool,project_id:context?.project?.id??null,
      session_id:child.session_id??null,observed_at:child.execution.end_date,report:null,report_pointer:null,scanner_revision:null}
  });
  records.action=action;
  if(action==='verify'){
    const plan=previous.plans.find(x=>x.id===options.plan_id);
    insistEvidence(plan,'Prepared plan was not found.');
    const writer=await memory.loadToolExecution(context.project,child.session_id,options.writer_execution_id);
    records.previous_report=options.previous_report;
    records.findings.push(...previous.findings.filter(item=>item.kind==='declared-intent').map(item=>({...item,state:{...item.state,freshness:'stale'}})));
    records.verification=await verifyPlan({before:previous,after:records,plan,writer,preparedAt:previousEnvelope.saved_at});
    records.plans=[{...plan,status:records.verification.status==='passed'?'verified':'verification-failed'}];
  }
  return records;
};
