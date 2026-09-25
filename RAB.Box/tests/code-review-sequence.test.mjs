import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { run } from '../tools/code-review/code-review.mjs';
import { run as writeRun } from '../tools/code-review/write/write.mjs';
import { summarize } from '../tools/code-review/_review.mjs';

const names=['guards','grids','atoms','new-review'];
const ids=[1830000000730,1830000000732,1830000000734,Date.now()];
const leaves=names.map((name,index)=>({id:ids[index],key:`code-review/${name}`,name,meta:{group:name,authority:'read'}}));
const context=async()=>{
  const parent=path.join(os.homedir(),'.rab','temp','test');
  await mkdir(parent,{recursive:true});
  for(;;){
    const rab_home=path.join(parent,String(Date.now()));
    try { await mkdir(rab_home);return {rab_home}; }
    catch(error){if(error.code!=='EEXIST')throw error;}
  }
};
const helpers=({seen,corrupt=false})=>({
  listTools:async()=>({items:[...leaves].reverse()}),
  runTool:async({key,options})=>{
    const tool=leaves.find(item=>String(item.id)===key);
    assert.ok(tool);seen.push({name:tool.name,options});
    const status=tool.name==='grids'?'skipped':tool.name==='new-review'?'failed':'passed';
    const findings=status==='failed'?[{rule:'new-rule',file:options.file,line:1}]:[];
    const result=summarize(options,[{tool:tool.key,status}],findings);
    return {result:{...result,code_sha256:corrupt?'wrong':result.code_sha256,evidence:{report:`report/${tool.name}.json`}},
      execution:{execution_id:tool.id,duration_ms:tool.name==='new-review'?7:3}};
  }
});

test('existing Tool House runner can sequence all discovered reviews without settings changes',async()=>{
  const seen=[],input={file:'src/Card.tsx',code:'const Card = () => <div />;'};
  const result=await run({options:{...input,checks:['all']},context:await context(),
    tool:{meta:{group:'all'}},helpers:helpers({seen})});
  assert.deepEqual(seen.map(item=>item.name),names);
  assert.ok(seen.every(item=>item.options.file===input.file&&item.options.code===input.code));
  assert.equal(result.status,'failed');assert.equal(result.passed,false);
  assert.equal(result.children.length,4);assert.equal(result.findings[0].rule,'new-rule');
  assert.equal(result.totals.checks_run,3);assert.equal(result.totals.checks_skipped,1);
  assert.equal(result.children[3].duration_ms,7);
});

test('one review can run alone and a changed child result cannot be accepted',async()=>{
  const input={file:'src/Card.tsx',code:'const Card = () => <div />;'},seen=[];
  const result=await run({options:{...input,checks:['new-review']},context:await context(),
    tool:{meta:{group:'all'}},helpers:helpers({seen})});
  assert.deepEqual(seen.map(item=>item.name),['new-review']);
  assert.equal(result.children.length,1);assert.equal(result.passed,false);
  const badContext=await context();
  await assert.rejects(()=>run({options:{...input,checks:['guards']},context:badContext,
    tool:{meta:{group:'all'}},helpers:helpers({seen:[],corrupt:true})}),{code:'BAD_REVIEW_RESULT'});
});

test('reviewed writer requests all leaves and blocks a failed verdict',async()=>{
  const location=await context(),projectRoot=path.join(location.rab_home,'project');
  await mkdir(projectRoot);
  const calls=[];
  const output=await writeRun({options:{file:'src/Card.tsx',code:'const Card = () => <div />;',confirm:true},
    context:{...location,project:{id:Date.now(),name:'review-test',root:projectRoot}},
    helpers:{runTool:async request=>{calls.push(request);return{
      result:{passed:false,evidence:{report:'review-report.json'}},
      execution:{execution_id:Date.now()}
    };}}});
  assert.equal(output.wrote,false);assert.equal(output.status,'blocked');
  assert.deepEqual(calls[0].options.checks,['all']);
});
