import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyPlan, loadInvestigation } from '../../tools/audit/_evidence/workflow.mjs';
import { investigateClass } from '../../tools/audit/_evidence/class-investigation.mjs';
import { digest } from '../../tools/audit/_evidence/records.mjs';

const projectId = 1789940000100, scanExecutionId = 1789940000101, investigationExecutionId = 1789940000102;

const fixture=()=>{
  const before={scan_root:'C:/source',coverage:{source_snapshot:{consistent:true,files:[{file:'a.css',sha256:'before'}]},skipped:[],scope:{}},conclusions:[{consumers:['view.tsx']}]};
  const after=structuredClone(before);after.coverage.source_snapshot.files[0].sha256='after';
  const plan={id:'plan-1',target:{file:'a.css'},expected:{sha256:'after'},tool:{id:7,options:{location:'C:/source/a.css',class_name:'a',state:'active, is-active',styles:'--ink: var(--strong);'}}};
  const writer={execution_id:1789940000103,status:'completed',tool:{id:7},options:{...plan.tool.options},start_date:'2026-09-20T10:01:00Z'};
  return {before,after,plan,writer,preparedAt:'2026-09-20T10:00:00Z'};
};
test('verification refuses inconsistent post-scan and new read/traversal gaps even with matching target bytes',async()=>{
  for(const change of [value=>{value.coverage.source_snapshot.consistent=false;},value=>value.coverage.skipped.push({file:'.',reason:'directory-read-error'})]){
    const args=fixture();change(args.after);assert.equal((await verifyPlan(args)).status,'failed');
  }
  assert.equal((await verifyPlan(fixture())).status,'passed');
  const wrongRoot=fixture();wrongRoot.after.scan_root='C:/other';assert.equal((await verifyPlan(wrongRoot)).status,'failed');
});
test('verification binds actual writer options and execution time to the prepared operation',async()=>{
  for(const change of [writer=>{writer.options.location='C:/other.css';},writer=>{writer.options.styles='--ink: var(--wrong);';},writer=>{writer.start_date='2026-09-20T09:00:00Z';}]){
    const args=fixture();change(args.writer);assert.equal((await verifyPlan(args)).status,'failed');
  }
});
test('reopening fails on absent, altered, or incomplete source evidence and missing pointers',async()=>{
  const index={status:'ok',folder:'C:/source',count:0,unique:0,counts:[],unresolved:[],totals:{definitions:0,usages:0,dynamic_assignments:0}};
  const records=investigateClass({result:index,source:{execution_id:scanExecutionId},project:{id:projectId},className:'a'});
  records.source.report='old-report';
  const source={version:'audit-result/v1',project_id:projectId,result:index,tasks:[{execution_id:scanExecutionId,status:'completed',result_ref:{$ref:'#/result'}}]};
  const report={version:'audit-result/v1',project_id:projectId,execution_id:investigationExecutionId,tool:{key:'audit/inspect/class-impact'},result:records,tasks:[{execution_id:investigationExecutionId,status:'completed',result_ref:{$ref:'#/result'}}]};
  for(const group of ['entities','findings','investigations','conclusions'])for(const row of records[group])for(const ref of row.evidence){ref.file='old-report';ref.report_sha256=digest(source);}
  const memory={loadToolReport:async(_project,file)=>file==='new-report'?report:source,resolveToolValue:async(_project,ref)=>structuredClone(ref.file==='new-report'?records:index)};
  assert.equal((await loadInvestigation(memory,{id:projectId},'new-report')).result.subject,'a');
  await assert.rejects(loadInvestigation({...memory,loadToolReport:async(project,file)=>{if(file==='old-report')throw Object.assign(new Error('missing'),{code:'ENOENT'});return report;}},{id:projectId},'new-report'),{code:'ENOENT'});
  source.result.extra='tampered';await assert.rejects(loadInvestigation(memory,{id:projectId},'new-report'),{code:'STALE_EVIDENCE'});delete source.result.extra;
  const first=records.entities[0].evidence[0];first.pointer='#/missing';
  await assert.rejects(loadInvestigation(memory,{id:projectId},'new-report'),{code:'BAD_EVIDENCE'});
});
