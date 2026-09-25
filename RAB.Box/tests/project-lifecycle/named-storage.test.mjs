import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import { createRabMemory } from '../../bridge/rab-memory.mjs';
import { createToolHouse } from '../../bridge/tool-house.mjs';
import { makeNode } from '../../bridge/rab-node.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const json=async file=>JSON.parse(await readFile(file,'utf8'));
const fixture=async t=>{
  const temp=await realpath(await mkdtemp(path.join(os.tmpdir(),'rab-named-storage-')));
  t.after(async()=>{
    assert.equal(path.dirname(temp),await realpath(os.tmpdir()));
    assert.ok(path.basename(temp).startsWith('rab-named-storage-'));
    await rm(temp,{recursive:true,force:true});
  });
  const rabHome=path.join(temp,'.rab'),memory=createRabMemory({rabHome}),house=createToolHouse({root});
  const create=(name,folder)=>house.runTool({key:'base/stamp-new-project',options:{type:'html',name,folder},context:{rab_home:rabHome}});
  return {temp,rabHome,memory,house,create};
};

test('development projects save memory by name and reopen by numeric ID in a fresh owner',async t=>{
  const f=await fixture(t),out=await f.create('magic',path.join(f.temp,'apps'));
  const project=out.result.child.result.project;
  const expected=path.join(f.rabHome,'projects','magic');
  assert.equal(project.root,path.join(f.temp,'apps','magic'));
  assert.equal(out.result.child.result.box_memory,expected);
  assert.equal((await json(path.join(expected,'settings.json'))).id,project.id);
  const session=await f.memory.createSession(project);
  session.turns.push({id:await f.memory.allocateId(),text:'Saved named-project turn',stepIds:[]});
  await f.memory.saveSession(project,session);
  const restored=createRabMemory({rabHome:f.rabHome});
  assert.equal((await restored.readProject(project.id)).name,'magic');
  assert.equal((await restored.findSession(session.id)).session.turns[0].text,'Saved named-project turn');
  assert.equal(restored.paths({...project,name:'A changed display label'}).project,expected);
  for(const name of ['magic',String(project.id)]){
    const loaded=await f.house.runTool({key:'base/load-project',options:{name},context:{rab_home:f.rabHome}});
    assert.equal(loaded.result.status,'loaded');
    assert.equal(loaded.result.last_session.id,session.id);
  }
  assert.deepEqual(await readdir(path.join(f.rabHome,'projects')),['magic']);
});

test('concurrent development stamps cannot write two source projects for the same memory name',async t=>{
  const f=await fixture(t),parents=[path.join(f.temp,'first'),path.join(f.temp,'second')];
  const outcomes=await Promise.allSettled(parents.map(folder=>f.create('magic',folder)));
  assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(outcomes.find(x=>x.status==='rejected').reason.code,'EEXIST');
  const loser=outcomes.findIndex(x=>x.status==='rejected');
  await assert.rejects(readFile(path.join(parents[loser],'magic','settings.json')),{code:'ENOENT'});
  assert.equal((await f.memory.listProjects()).items.length,1);
});

test('registered numeric project directories and their sessions remain readable without moving',async t=>{
  const f=await fixture(t),id=await f.memory.allocateId(),source=path.join(f.temp,'old-source');
  const directory=path.join(f.rabHome,'projects',String(id));
  await mkdir(source);await mkdir(directory,{recursive:true});
  await writeFile(path.join(source,'settings.json'),JSON.stringify({name:'Old project',type:'html',paths:{}}));
  const node=makeNode({id,name:'Old project',title:'Old project',description:'Earlier numeric storage',settings:[],meta:{kind:'project',source_root:source},type:'html',paths:{}});
  await writeFile(path.join(directory,'settings.json'),JSON.stringify(node));
  const sourceKey=process.platform==='win32'?source.toLowerCase():source;
  await writeFile(path.join(f.rabHome,'project-roots.json'),JSON.stringify({version:'rab-project-roots/v1',roots:{[sourceKey]:id}}));
  const meta={id,name:node.name,root:source},session=await f.memory.createSession(meta);
  await f.create('magic',path.join(f.temp,'new-source'));
  const restored=createRabMemory({rabHome:f.rabHome});
  assert.equal(restored.paths(meta).project,directory);
  assert.equal((await restored.readProject(id)).id,id);
  assert.equal((await restored.findSession(session.id)).meta.id,id);
  assert.deepEqual((await restored.listProjects()).items.map(x=>x.name).sort(),['Old project','magic']);
  assert.deepEqual((await readdir(path.join(f.rabHome,'projects'))).sort(),[String(id),'magic'].sort());
});

test('existing named contents and junctions are refused before source artifacts are written',async t=>{
  const f=await fixture(t);await f.memory.ensureHome();
  const directory=path.join(f.rabHome,'projects','magic');await mkdir(directory);
  await writeFile(path.join(directory,'keep.txt'),'original');
  await assert.rejects(f.create('magic',path.join(f.temp,'apps')),{code:'EEXIST'});
  assert.equal(await readFile(path.join(directory,'keep.txt'),'utf8'),'original');
  await assert.rejects(readdir(path.join(f.temp,'apps')),{code:'ENOENT'});
  const outside=path.join(f.temp,'outside');await mkdir(outside);
  await symlink(outside,path.join(f.rabHome,'projects','linked'),process.platform==='win32'?'junction':'dir');
  await assert.rejects(f.create('linked',path.join(f.temp,'apps')),{code:'INVALID_PATH'});
  assert.deepEqual(await readdir(outside),[]);
});

test('named projects cannot reuse an identity or restart allocation after reservation state is lost',async t=>{
  const f=await fixture(t),out=await f.create('magic',path.join(f.temp,'apps')),project=out.result.child.result.project;
  const source=path.join(f.temp,'other');await mkdir(source);
  await assert.rejects(f.memory.registerProject({id:project.id,name:'other',root:source}),{code:'PROJECT_ID_CONFLICT'});
  assert.equal((await f.memory.readProject(project.id)).name,'magic');
  // Also cover a lost roots lookup: the current project descriptor itself must
  // prevent starting a fresh allocator and reusing identities.
  await unlink(path.join(f.rabHome,'id-state.json'));
  await unlink(path.join(f.rabHome,'project-roots.json'));
  await assert.rejects(f.memory.allocateId(),{code:'BAD_ID_STATE'});
});
