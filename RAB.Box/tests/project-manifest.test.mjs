import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { createRabMemory } from '../bridge/rab-memory.mjs';
import { runProjectStamp } from '../tools/_stamp-engines.mjs';
import { run as findProject } from '../tools/base/find-project/find-project.mjs';

const boxRoot=fileURLToPath(new URL('..',import.meta.url));
const readJson=async file=>JSON.parse(await readFile(file,'utf8'));

test('project creation adds ID-keyed high-level entries and find-project searches them',async t=>{
  const fixtureParent=path.join(os.homedir(),'.rab','temp');
  await mkdir(fixtureParent,{recursive:true});
  const fixture=await realpath(await mkdtemp(path.join(fixtureParent,'project-manifest-')));
  t.after(async()=>{
    assert.equal(path.dirname(fixture),await realpath(fixtureParent));
    assert.ok(path.basename(fixture).startsWith('project-manifest-'));
    await rm(fixture,{recursive:true});
  });

  const rabHome=path.join(fixture,'.rab');
  const memory=createRabMemory({rabHome});
  const tool={root:path.join(boxRoot,'tools','html','stamp-new-project')};
  const context={rab_home:rabHome};
  const first=await runProjectStamp({options:{name:'Maple',folder:fixture},context,tool});
  const second=await runProjectStamp({options:{name:'Cedar',folder:fixture},context,tool});
  const manifestFile=path.join(rabHome,'projects','manifest.json');
  const manifest=await readJson(manifestFile);

  for(const created of [first,second]){
    const saved=await memory.readProject(created.project.id);
    assert.deepEqual(manifest[String(created.project.id)],{
      id:saved.id,name:saved.name,title:saved.title,description:saved.description
    });
    assert.equal(created.project_manifest.file,manifestFile);
  }
  assert.equal(Object.keys(manifest).length,2);

  const byId=await findProject({options:{name:String(second.project.id)},context});
  assert.deepEqual(byId.matches.map(item=>item.id),[second.project.id]);
  const byName=await findProject({options:{name:'map'},context});
  assert.deepEqual(byName.matches.map(item=>item.id),[first.project.id]);
  const byDescription=await findProject({options:{name:'Local project'},context});
  assert.equal(byDescription.matches.length,2);
  assert.equal((await memory.listProjects()).items.length,2);
});
