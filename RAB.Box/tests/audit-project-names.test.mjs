import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { createToolHouse } from '../bridge/tool-house.mjs';
import { createRabMemory } from '../bridge/rab-memory.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
const json=async file=>JSON.parse(await readFile(file,'utf8'));
const fixture=async t=>{
  const temp=await realpath(await mkdtemp(path.join(os.tmpdir(),'rab-project-names-')));
  t.after(async()=>{
    assert.equal(path.dirname(temp),await realpath(os.tmpdir()));
    assert.ok(path.basename(temp).startsWith('rab-project-names-'));
    await rm(temp,{recursive:true,force:true});
  });
  const folder=path.join(temp,'source');await mkdir(folder);await writeFile(path.join(folder,'test.txt'),'source must stay unchanged');
  const memory=createRabMemory({rabHome:path.join(temp,'.rab')}),house=createToolHouse({root});
  const create=name=>house.runTool({key:'audit/stamp-new-project',options:{name,folder},context:{rab_home:memory.rabHome}});
  const load=name=>house.runTool({key:'base/load-project',options:{name},context:{rab_home:memory.rabHome}});
  return {temp,folder,memory,house,create,load};
};

test('Audit Stamp uses the project name and keeps numeric identity, sessions, tracking and results together',async t=>{
  const f=await fixture(t),out=await f.create('save-shit'),project=out.result.project;
  assert.ok(Number.isSafeInteger(project.id)&&project.id>0);
  const key=String(project.id),expected=path.join(f.memory.rabHome,'projects','save-shit');
  assert.equal(project.root,expected);assert.equal(out.result.box_memory,expected);
  assert.equal(f.memory.projectKey(project),key);assert.equal(f.memory.paths(project).project,expected);
  assert.equal((await json(path.join(expected,'PROJECT.json'))).project_key,key);
  assert.equal((await json(path.join(expected,'settings.json'))).name,'save-shit');
  assert.equal((await json(path.join(expected,'settings.json'))).paths.folder,await realpath(f.folder));
  assert.equal((await json(path.join(expected,'settings.json'))).custom_toolkit_path,null);
  for(const file of out.result.verification.files)assert.equal(createHash('sha256').update(await readFile(file.path)).digest('hex'),file.sha256);
  const session=await f.memory.createSession(project);
  const turnId=await f.memory.allocateId(),stepId=await f.memory.allocateId();
  session.turns.push({id:turnId,at:new Date().toISOString(),text:'count files',stepIds:[stepId]});
  session.steps.push({id:stepId,turnIds:[turnId],status:'ready'});
  await f.memory.saveSession(project,session);
  assert.ok(Number.isSafeInteger(session.id)&&session.id>0);
  assert.equal((await json(path.join(expected,'sessions',String(session.id),'state.json'))).id,session.id);
  assert.equal((await json(path.join(expected,'sessions',String(session.id),'settings.json'))).id,session.id);
  const result=await f.house.runTool({key:'audit/count/files',context:{rab_home:f.memory.rabHome,project,__rab_telemetry:{session_id:session.id,step_id:stepId}}});
  assert.equal(result.result.count,1);
  assert.equal(path.dirname(result.result_file),path.join(expected,'audit-results',String(session.id)));
  assert.equal(path.dirname(result.tracking_file),path.join(expected,'runs',String(session.id)));
  assert.equal((await json(result.tracking_file)).project_key,key);
  assert.equal((await f.memory.findSession(session.id)).meta.root,expected);
  const loaded=(await f.load('save-shit')).result;
  assert.equal(loaded.status,'loaded');assert.equal(loaded.project.root,expected);
  assert.deepEqual(loaded.chat_history,session.turns);assert.deepEqual(loaded.last_session.steps,session.steps);
  assert.equal((await f.load(key)).result.project.id,project.id);
  assert.deepEqual(await readdir(path.join(f.memory.rabHome,'projects')),['save-shit']);
  assert.deepEqual(await readdir(f.folder),['test.txt']);
  assert.equal(await readFile(path.join(f.folder,'test.txt'),'utf8'),'source must stay unchanged');
});

test('valid project names preserve their spelling without normalization or numeric suffixes',async t=>{
  const f=await fixture(t),out=await f.create('Review one UI');
  const project=out.result.project,before=await readFile(path.join(project.root,'settings.json'),'utf8');
  assert.equal(path.basename(project.root),'Review one UI');assert.equal(project.name,'Review one UI');
  const second=(await f.create('Review-one-UI')).result.project;
  assert.notEqual(second.id,project.id);
  assert.equal(await readFile(path.join(project.root,'settings.json'),'utf8'),before);
  assert.deepEqual((await readdir(path.join(f.memory.rabHome,'projects'))).sort(),[project.name,second.name].sort());
  assert.equal((await f.load(project.name)).result.project.id,project.id);
  assert.equal((await f.load(second.name)).result.project.id,second.id);
});

test('concurrent duplicate names create one project and reject the other without overwriting',async t=>{
  const f=await fixture(t);
  const outcomes=await Promise.allSettled([f.create('same-name'),f.create('same-name')]);
  assert.equal(outcomes.filter(item=>item.status==='fulfilled').length,1);
  assert.equal(outcomes.find(item=>item.status==='rejected').reason.code,'EEXIST');
  const projects=outcomes.filter(item=>item.status==='fulfilled').map(item=>item.value.result.project);
  const loaded=(await f.load('same-name')).result;
  assert.equal(loaded.status,'loaded');
  assert.equal(loaded.project.id,projects[0].id);
  for(const project of projects){
    const exact=(await f.load(String(project.id))).result;
    assert.equal(exact.status,'loaded');assert.equal(exact.project.id,project.id);
    assert.equal(exact.project.root,project.root);
    assert.equal((await json(path.join(project.root,'settings.json'))).id,project.id);
  }
  assert.deepEqual(await readdir(path.join(f.memory.rabHome,'projects')),['same-name']);
  await assert.rejects(f.create('SAME-NAME'),{code:'EEXIST'});
});

test('legacy named directories are ignored without continuing, migrating or rewriting them',async t=>{
  const f=await fixture(t),id='project-123-abcdef',key=`${id}--0123456789ab`;
  await f.memory.allocateId();
  const project={id,name:'legacy-review',root:path.join(f.memory.rabHome,'projects',key)};
  await mkdir(project.root,{recursive:true});
  await writeFile(path.join(project.root,'settings.json'),JSON.stringify({...project,type:'audit',paths:{folder:f.folder,results:'audit-results'}}));
  await mkdir(path.join(project.root,'sessions'));
  const sessionFile=path.join(project.root,'sessions','legacy-session.json');
  await writeFile(sessionFile,JSON.stringify({id:'legacy-session',turns:[{id:'turn-1',text:'saved legacy turn'}]}));
  const beforeSettings=await readFile(path.join(project.root,'settings.json'),'utf8'),beforeSession=await readFile(sessionFile,'utf8');
  const loaded=(await f.load(project.name)).result;
  assert.equal(loaded.status,'not-found');assert.deepEqual(loaded.items,[]);
  assert.deepEqual((await f.memory.listProjects()).items,[]);
  assert.deepEqual(await readdir(path.join(f.memory.rabHome,'projects')),[key]);
  assert.equal(await readFile(path.join(project.root,'settings.json'),'utf8'),beforeSettings);
  assert.equal(await readFile(sessionFile,'utf8'),beforeSession);
  assert.deepEqual((await readdir(project.root)).sort(),['sessions','settings.json']);
});

test('unsafe project names fail before creating a project directory',async t=>{
  const f=await fixture(t);
  for(const name of ['.','..','CON','NUL.txt','trailing.','../outside','Review "one" / UI']){
    await assert.rejects(f.create(name),{code:'BAD_REQUEST',field:'name'});
  }
  assert.deepEqual(await readdir(path.join(f.memory.rabHome,'projects')).catch(error=>{if(error.code==='ENOENT')return [];throw error;}),[]);
  assert.deepEqual((await readdir(f.temp)).sort(),['.rab','source']);
});

test('base listing returns only names and a missing load returns the same choices, including an empty home',async t=>{
  const f=await fixture(t);
  const list=async()=> (await f.house.runTool({key:'base/list-projects',context:{rab_home:f.memory.rabHome}})).result;
  assert.deepEqual(await list(),{status:'ok',items:[]});
  assert.deepEqual((await f.load('missing')).result,{status:'not-found',query:'missing',matches:[],items:[]});
  await assert.rejects(readdir(path.join(f.memory.rabHome,'projects')),{code:'ENOENT'});
  await f.create('alpha');await f.create('beta');
  assert.deepEqual(await list(),{status:'ok',items:['alpha','beta']});
  const missing=(await f.load('missing')).result;
  assert.deepEqual(missing.items,['alpha','beta']);
  assert.doesNotMatch(JSON.stringify(missing),/"root"|"key"|"id"|[A-Za-z]:\\/);
  assert.equal((await f.load('BETA')).result.project.name,'beta');
});
