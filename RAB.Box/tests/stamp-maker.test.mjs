import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, cp, mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { plan as makeStampPlan } from './fixtures/stamp-contracts/stamps/StampMaker/stamp.mjs';
import { createToolHouse } from '../bridge/tool-house.mjs';

const ROOT=path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const materialize=async(root,plan)=>{
  const dest=path.join(root,...String(plan.destination).split('/'));
  for(const file of plan.files){const full=path.join(dest,...file.path.split('/'));await mkdir(path.dirname(full),{recursive:true});await writeFile(full,file.text,'utf8');}
  return dest;
};
const findFile=async(dir,name)=>{
  for(const e of await readdir(dir,{withFileTypes:true})){
    const full=path.join(dir,e.name);
    if(e.isDirectory()){const hit=await findFile(full,name);if(hit)return hit;}
    else if(e.name===name)return full;
  }
  return null;
};

test('stamp-maker emits a reviewable unregistered skeleton and visibility checker sees it',async()=>{
  const temp=await mkdtemp(path.join(os.tmpdir(),'rab-stamp-maker-'));
  const projectRoot=path.join(temp,'project');
  const outputRoot=path.join(temp,'audit');
  await cp(path.join(ROOT,'tests/fixtures/stamp-contracts'),projectRoot,{recursive:true});
  const built=makeStampPlan({options:{name:'audit-orphan-demo',description:'find all orphaned files in the current project and return a report',data_types:'file,orphan-file',location:'generated-stamps'}});
  const dest=await materialize(projectRoot,built);
  const registration=JSON.parse(await readFile(path.join(dest,'registration.json'),'utf8'));
  assert.equal(registration.name,'audit-orphan-demo');
  assert.match(await readFile(path.join(dest,'CHECK_ME.txt'),'utf8'),/visibility checker/i);
  const house=createToolHouse({root:ROOT});
  const checked=await house.runTool({key:'check-stamp-visibility',options:{folder:projectRoot},context:{project:{id:'fixture',name:'fixture',root:projectRoot}}});
  const report=checked.result.report;
  assert.ok(report.summary.generated_unregistered>=1);
  const row=report.generated.find(x=>x.name==='audit-orphan-demo');
  assert.ok(row,'generated stamp should be listed');
  assert.equal(row.registered,false,'generated skeleton must not silently become authority');
});
