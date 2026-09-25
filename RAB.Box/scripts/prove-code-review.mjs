import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createRabMemory } from '../bridge/rab-memory.mjs';
import { createToolHouse } from '../bridge/tool-house.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const memory=createRabMemory(),id=await memory.allocateId();
const folder=path.join(memory.rabHome,'temp','test',String(id));
const projectRoot=path.join(folder,'project'),rabHome=path.join(folder,'test-home');
await mkdir(projectRoot,{recursive:true});
const testMemory=createRabMemory({rabHome}),projectId=await testMemory.allocateId();
await writeFile(path.join(projectRoot,'settings.json'),JSON.stringify({id:projectId,name:'code-review-proof',title:'Code review proof',description:'Disposable generated output; independent test memory.',settings:[],meta:{kind:'project'},type:'react'},null,2)+'\n');
const context={rab_home:rabHome,project:{id:projectId,name:'code-review-proof',root:projectRoot}},house=createToolHouse({root});
const file='src/labels.ts',bad='const labels = data.map(item => item.label);\n',good='const labels = data?.map(item => item?.label ?? "");\n';
const attempts=[];
for(const [name,code] of [['unguarded',bad],['guarded',good]]){
  const output=await house.runTool({key:'code-review/write',options:{file,code,confirm:true},context});
  attempts.push({name,input:{file,code,confirm:true},output});
  if(name==='unguarded'){assert.equal(output.result.wrote,false);await assert.rejects(()=>readFile(path.join(projectRoot,file)),{code:'ENOENT'});}
  else {assert.equal(output.result.wrote,true);assert.equal(await readFile(path.join(projectRoot,file),'utf8'),good);}
}
const proof={id,folder,projectRoot,artifact:path.join(projectRoot,file),attempts};
await writeFile(path.join(folder,'proof.json'),JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({proof:path.join(folder,'proof.json'),artifact:proof.artifact,attempts:attempts.map(item=>({name:item.name,status:item.output.result.status,wrote:item.output.result.wrote,findings:item.output.result.review.totals.findings}))},null,2));
