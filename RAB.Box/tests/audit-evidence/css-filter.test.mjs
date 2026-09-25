import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { mkdtemp, mkdir, writeFile, readFile, readdir, realpath, rm } from 'node:fs/promises';
import { createWorkbench } from '../../bridge/service.mjs';
import { createRabMemory } from '../../bridge/rab-memory.mjs';
import { createToolHouse } from '../../bridge/tool-house.mjs';
import { createSeatParser } from '../../bridge/seat-parser.mjs';

const root=fileURLToPath(new URL('../..',import.meta.url));
const fixture=async t=>{
  const temp=await realpath(await mkdtemp(path.join(os.tmpdir(),'rab-css-filter-')));
  t.after(async()=>{
    assert.equal(path.dirname(temp),await realpath(os.tmpdir()));
    assert.ok(path.basename(temp).startsWith('rab-css-filter-'));
    await rm(temp,{recursive:true,force:true});
  });
  const rabHome=path.join(temp,'.rab'),folder=path.join(temp,'source'),explicit=path.join(temp,'explicit');
  for(const directory of [folder,explicit]){
    await mkdir(directory);
    for(const name of ['a.css','b.CSS','c.js','d.txt'])await writeFile(path.join(directory,name),`fixture ${name}`);
  }
  const memory=createRabMemory({rabHome}),projectId=await memory.allocateId();
  const project={id:projectId,name:'CSS filter',root:memory.newProjectPath('CSS filter')};
  await mkdir(project.root,{recursive:true});
  await writeFile(path.join(project.root,'settings.json'),JSON.stringify({type:'audit',paths:{folder}}));
  await writeFile(path.join(project.root,'PATHS.json'),JSON.stringify({project:{id:project.id,name:project.name},stamps:{},tools:{},catalogs:{}}));
  const session=await memory.createSession(project);
  assert.ok(Number.isSafeInteger(session.id));
  return {temp,rabHome,folder,explicit,project,memory,session,box:createWorkbench({root,rabHome})};
};

test('exact Box text find all css files plans .css before execution and returns only CSS files',async t=>{
  const f=await fixture(t);
  const plan=await f.box.sessionTurn({session_id:f.session.id,text:'find all css files'});
  const step=plan.current_steps[0];
  assert.equal(step.capability.house.path,'audit/find-files');
  assert.equal(step.options.extension.value,'.css');
  assert.equal(step.options.extension.source,'request:extension');
  assert.equal(step.options.folder.value,f.folder);
  assert.equal(step.status,'ready');assert.equal(step.receipt,undefined);
  const done=await f.box.sessionExecute({session_id:f.session.id,confirm:true});
  const files=done.steps[0].receipt.steps[0].result.files;
  assert.deepEqual(files.map(file=>path.basename(file)).sort(),['a.css','b.CSS']);
  assert.ok(files.every(file=>path.dirname(file)===f.folder));
  assert.deepEqual((await readdir(f.folder)).sort(),['a.css','b.CSS','c.js','d.txt']);
  for(const name of await readdir(f.folder))assert.equal(await readFile(path.join(f.folder,name),'utf8'),`fixture ${name}`);
});

test('explicit folder and CSS modifier beat stale session seats and saved paths',async t=>{
  const f=await fixture(t);
  f.session.bag.seats={folder:f.folder,extension:'.js'};
  await f.memory.saveSession(f.project,f.session);
  await f.memory.setProjectPath(f.project,'folder',f.folder);
  await f.memory.setProjectPath(f.project,'extension','.txt');
  const plan=await f.box.sessionTurn({session_id:f.session.id,text:`find all css files in "${f.explicit}"`});
  const step=plan.current_steps[0];
  assert.equal(step.options.folder.value,f.explicit);
  assert.equal(step.options.folder.source,'request:path');
  assert.equal(step.options.extension.value,'.css');
  const done=await f.box.sessionExecute({session_id:f.session.id,confirm:true});
  const files=done.steps[0].receipt.steps[0].result.files;
  assert.deepEqual(files.map(file=>path.basename(file)).sort(),['a.css','b.CSS']);
  assert.ok(files.every(file=>path.dirname(file)===f.explicit));
  const house=createToolHouse({root});
  const direct=await house.runTool({key:'audit/find-files',options:{folder:f.explicit,extension:'.css'},context:{project:f.project,rab_home:f.rabHome,bag:{seats:{folder:f.folder,extension:'.js'}}}});
  assert.equal(direct.options.folder,f.explicit);assert.equal(direct.options.extension,'.css');
  assert.deepEqual(direct.result.files,files);
});

test('CSS modifier parsing is token-scoped and does not replace general file defaults',async t=>{
  const parser=await createSeatParser({languageRoot:path.join(root,'language')});
  for(const text of ['find all css files','find all CSS files','find all .css files']){
    const frame=parser.parse(text,{context:{domain:'audit'}}).frames[0];
    assert.equal(frame.completeLanguage,true,text);
    assert.equal(frame.evidence.find(item=>item.seat==='extension')?.value,'.css',text);
    assert.equal(frame.seats.domain,'audit');
  }
  for(const text of ['find all files','find all files in "C:/css files"']){
    assert.equal(parser.parse(text,{context:{domain:'audit'}}).frames[0].evidence.some(item=>item.seat==='extension'),false,text);
  }
  const f=await fixture(t);
  const plan=await f.box.sessionTurn({session_id:f.session.id,text:'find all files'});
  assert.equal(plan.current_steps[0].options.extension.value,'*');
});
