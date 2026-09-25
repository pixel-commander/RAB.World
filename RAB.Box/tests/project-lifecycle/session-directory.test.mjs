import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, mkdir, readFile, writeFile, rm, realpath, unlink } from 'node:fs/promises';
import { createRabMemory } from '../../bridge/rab-memory.mjs';

const json=async file=>JSON.parse(await readFile(file,'utf8'));
const fixture=async t=>{
  const temp=await realpath(await mkdtemp(path.join(os.tmpdir(),'rab-session-directory-')));
  t.after(async()=>{
    assert.equal(path.dirname(temp),await realpath(os.tmpdir()));
    assert.ok(path.basename(temp).startsWith('rab-session-directory-'));
    await rm(temp,{recursive:true,force:true});
  });
  const root=path.join(temp,'source');await mkdir(root);
  await writeFile(path.join(root,'settings.json'),JSON.stringify({name:'Example',type:'react',paths:{}}));
  const memory=createRabMemory({rabHome:path.join(temp,'.rab')}),meta={root,name:'Example'};
  await memory.openProject(meta);
  return {temp,memory,meta,dir:memory.paths(meta).project};
};

test('named sessions persist their own metadata and map without changing project settings',async t=>{
  const f=await fixture(t),settings=await readFile(path.join(f.dir,'settings.json'),'utf8');
  const session=await f.memory.createSession(f.meta,{name:'  Component audit  '});
  assert.equal(session.name,'Component audit');assert.equal(session.title,session.name);assert.equal(session.description,'');
  const descriptor=await json(path.join(f.dir,'sessions',String(session.id),'settings.json'));
  assert.equal(descriptor.name,session.name);assert.equal(descriptor.meta.parent.id,Number(session.project_key));
  let index=await json(path.join(f.dir,'sessions.json'));
  assert.equal(index.sessions[session.id].name,session.name);
  session.turns.push({id:await f.memory.allocateId(),text:'Review'});session.groups.push({id:await f.memory.allocateId()});
  await f.memory.saveSession(f.meta,session);
  index=await json(path.join(f.dir,'sessions.json'));
  assert.equal(index.sessions[session.id].turns,1);assert.equal(index.sessions[session.id].groups,1);
  assert.equal(await readFile(path.join(f.dir,'settings.json'),'utf8'),settings);
  assert.deepEqual((await f.memory.loadSession(f.meta,session.id)).turns,session.turns);
});

test('explicit user options require name; internal no-options compatibility remains',async t=>{
  const f=await fixture(t);
  for(const options of [{},{name:''},{name:'  '},{name:42}])await assert.rejects(f.memory.createSession(f.meta,options),{code:'SESSION_NAME_REQUIRED'});
  assert.deepEqual(await f.memory.listSessions(f.meta),[]);
  const session=await f.memory.createSession(f.meta);
  assert.equal(session.name,`session-${session.id}`);
});

test('missing legacy map is read-only and first write retains older descriptor metadata',async t=>{
  const f=await fixture(t),old=await f.memory.createSession(f.meta,{name:'Earlier audit'});
  const stateFile=path.join(f.dir,'sessions',String(old.id),'state.json');
  const state=await json(stateFile);delete state.name;delete state.title;delete state.description;
  await writeFile(stateFile,JSON.stringify(state));await unlink(path.join(f.dir,'sessions.json'));
  const before=await readFile(stateFile,'utf8');
  const sessions=await f.memory.listSessions(f.meta);
  assert.equal(sessions[0].name,'Earlier audit');assert.equal(sessions[0].metadata_source,'session-descriptor');
  await assert.rejects(readFile(path.join(f.dir,'sessions.json')),{code:'ENOENT'});
  assert.equal(await readFile(stateFile,'utf8'),before);
  const next=await f.memory.createSession(f.meta,{name:'Next audit'});
  const index=await json(path.join(f.dir,'sessions.json'));
  assert.deepEqual(Object.keys(index.sessions).sort(),[String(old.id),String(next.id)].sort());
});

test('list detects stale map, sorts by updated time, and preserves older ID as most recent',async t=>{
  const f=await fixture(t),first=await f.memory.createSession(f.meta,{name:'First'}),second=await f.memory.createSession(f.meta,{name:'Second'});
  const file=path.join(f.dir,'sessions',String(first.id),'state.json'),state=await json(file);
  state.updated_at='2099-01-01T00:00:00.000Z';state.turns.push({text:'Interrupted after state write, before map write'});
  await writeFile(file,JSON.stringify(state));
  const mapBefore=await readFile(path.join(f.dir,'sessions.json'),'utf8');
  const list=await f.memory.listSessions(f.meta);
  assert.deepEqual(list.map(s=>s.id),[first.id,second.id]);assert.equal(list[0].turns,1);
  assert.equal(await readFile(path.join(f.dir,'sessions.json'),'utf8'),mapBefore);
});

test('malformed derived map falls back without overwriting it on read',async t=>{
  const f=await fixture(t),session=await f.memory.createSession(f.meta,{name:'Still here'}),file=path.join(f.dir,'sessions.json');
  await writeFile(file,'{broken');
  assert.equal((await f.memory.listSessions(f.meta))[0].id,session.id);
  assert.equal(await readFile(file,'utf8'),'{broken');
  await f.memory.saveSession(f.meta,session);
  assert.equal((await json(file)).sessions[session.id].revision,2);
});

test('index write failure reports canonical session persisted and filesystem read errors surface',async t=>{
  const f=await fixture(t),file=path.join(f.dir,'sessions.json');await mkdir(file);
  let failure;
  try{await f.memory.createSession(f.meta,{name:'Saved despite index failure'});}catch(error){failure=error;}
  assert.equal(failure.code,'SESSION_INDEX_WRITE_FAILED');assert.equal(failure.session_saved,true);
  assert.equal((await f.memory.loadSession(f.meta,failure.session_id)).name,'Saved despite index failure');
  // A filesystem error is surfaced, not disguised as an empty session list.
  await assert.rejects(f.memory.listSessions(f.meta));
});

test('all sessions remain selectable beyond 100 without list writes or map truncation',async t=>{
  const f=await fixture(t),seed=await f.memory.createSession(f.meta,{name:'First'});
  const settingsBefore=await readFile(path.join(f.dir,'settings.json'),'utf8');
  const mapBefore=await readFile(path.join(f.dir,'sessions.json'),'utf8');
  const ids=await f.memory.allocateIds(101);
  for(const id of ids){
    const dir=path.join(f.dir,'sessions',String(id));await mkdir(dir);
    await writeFile(path.join(dir,'state.json'),JSON.stringify({...seed,id,name:`Audit ${id}`,title:`Audit ${id}`}));
  }
  assert.equal((await f.memory.listSessions(f.meta)).length,102);
  assert.equal(await readFile(path.join(f.dir,'sessions.json'),'utf8'),mapBefore);
  assert.equal(await readFile(path.join(f.dir,'settings.json'),'utf8'),settingsBefore);
  await f.memory.saveSession(f.meta,seed);
  assert.equal(Object.keys((await json(path.join(f.dir,'sessions.json'))).sessions).length,102);
});
