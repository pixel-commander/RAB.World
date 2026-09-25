// Repeatable isolated demonstration. Evidence persists in its own .rab project.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createToolHouse } from '../../bridge/tool-house.mjs';
import { createRabMemory } from '../../bridge/rab-memory.mjs';
import { createAuditInvestigations } from '../../bridge/audit-investigations.mjs';

const root=fileURLToPath(new URL('../..',import.meta.url));
const demoRoot=path.join(root,'verification',`audit-factory-${new Date().toISOString().replaceAll(':','-').replaceAll('.','-')}`);
await mkdir(demoRoot,{recursive:true});
const rabHome=path.join(demoRoot,'.rab'),house=createToolHouse({root});
const app=await house.runTool({key:'react/stamp-new-project',options:{name:'evidence-demo',folder:demoRoot,starter:'style-guide',add_database:false},context:{rab_home:rabHome}});
const folder=path.join(demoRoot,'evidence-demo');
const audit=await house.runTool({key:'audit/stamp-new-project',options:{name:'evidence-demo-audit',folder},context:{rab_home:rabHome}});
const project=audit.result.project,memory=createRabMemory({rabHome}),session=await memory.createSession(project);
const api=createAuditInvestigations({root,rabHome}),turns=[];
const call=async(action,values)=>{
  const input={action,session_id:session.id,...values};
  try{const output=await api.handle(input);turns.push({input,pass:true,file:output.file??null,verification:output.result?.verification??null});return output;}
  catch(error){turns.push({input,pass:false,error:{code:error.code,message:error.message}});throw error;}
};
const before=await call('run',{class_name:'action-main'});
assert.ok(before.result.conclusions[0].consumers.includes('src/components/Button/Button.tsx'));
const declared=await call('declare',{file:before.file,decision:'intentional',reason:'Demonstrate one bounded action-atom change in the generated disposable application, using the existing shared tokens.'});
const plan=await call('plan',{file:declared.file,location:'src/atoms/action-main.css',styles:'--action-main-background: var(--surface-inset);\n--action-main-color: var(--content-main);'});
const verified=await call('execute',{file:plan.file,plan_id:plan.result.plans[0].id,confirm:true});
assert.equal(verified.result.verification.status,'passed',JSON.stringify(verified.result.verification));
const handoff=await call('handoff',{file:verified.file});
await writeFile(path.join(project.root,'demo-interactions.json'),JSON.stringify({version:'demo-interactions/v1',kind:'structured investigation actions; not claimed as chat turns',turns},null,2));
await writeFile(path.join(project.root,'scaffold-receipts.json'),JSON.stringify({app,audit},null,2));
const summary={demoRoot,folder,rabHome,project,session_id:session.id,stages:{before:before.file,declared:declared.file,plan:plan.file,verified:verified.file,handoff:handoff.file},verification:verified.result.verification,source_rules:await readFile(path.join(folder,'RULES.txt'),'utf8')};
await writeFile(path.join(demoRoot,'demo.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
