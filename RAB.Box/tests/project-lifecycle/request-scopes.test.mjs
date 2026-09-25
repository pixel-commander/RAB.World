import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm,symlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createRabMemory} from '../../bridge/rab-memory.mjs';
import {createToolHouse} from '../../bridge/tool-house.mjs';
import {createWorkbench} from '../../bridge/service.mjs';
import {makeNode} from '../../bridge/rab-node.mjs';
import {startServer} from '../../server.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const input={name:'feature',title:'A feature',description:'Proposed behavior',type:'feature',submission_key:'request-scopes-test'};
const fixture=async t=>{
  const folder=await mkdtemp(path.join(os.tmpdir(),'rab-request-scopes-'));
  t.after(async()=>{assert.equal(path.dirname(folder),os.tmpdir());assert.ok(path.basename(folder).startsWith('rab-request-scopes-'));await rm(folder,{recursive:true,force:true});});
  const rabHome=path.join(folder,'.rab'),memory=createRabMemory({rabHome});await memory.ensureHome();
  const project=async name=>{
    const source=path.join(folder,name);await mkdir(source);const id=await memory.allocateId();
    const contents=JSON.stringify({id,name,type:'react'});await writeFile(path.join(source,'settings.json'),contents);
    await memory.registerProject({id,name,root:source});return {id,name,root:source,contents};
  };
  return {folder,rabHome,memory,project,house:createToolHouse({root}),box:createWorkbench({root,rabHome})};
};
test('global and project records have exactly their intended home, with isolated listing and reads',async t=>{
  const f=await fixture(t),a=await f.project('Magic'),b=await f.project('Another');
  const global=await f.memory.createRequest(input);
  const scoped=await f.memory.createRequest({...input,scope:'project',project_id:a.id});
  assert.equal(global.settings_path,path.join(f.rabHome,'feature-requests',String(global.id),'settings.json'));
  assert.equal(scoped.settings_path,path.join(f.rabHome,'projects','Magic','feature-requests',String(scoped.id),'settings.json'));
  assert.equal(JSON.parse(await readFile(scoped.settings_path)).meta.parent.id,a.id);
  assert.deepEqual((await f.memory.listRequests()).items.map(x=>x.id),[global.id]);
  assert.deepEqual((await f.memory.listRequests({scope:'project',project_id:a.id})).items.map(x=>x.id),[scoped.id]);
  assert.deepEqual((await f.memory.listRequests({scope:'project',project_id:b.id})).items,[]);
  await assert.rejects(()=>f.memory.readRequest(scoped.id),{code:'ENOENT'});
  await assert.rejects(()=>f.memory.readRequest(scoped.id,{scope:'project',project_id:b.id}),{code:'ENOENT'});
  assert.equal(await readFile(path.join(a.root,'settings.json'),'utf8'),a.contents);
  assert.deepEqual(await readdir(a.root),['settings.json']);assert.deepEqual(await readdir(b.root),['settings.json']);
  const appId=JSON.parse(await readFile(path.join(f.rabHome,'settings.json'))).app_id;
  await assert.rejects(()=>readdir(path.join(f.rabHome,'apps',String(appId),'requests')),{code:'ENOENT'});
});
test('project scope rejects missing or invalid identity and arbitrary output paths',async t=>{
  const f=await fixture(t),project=await f.project('Magic');
  for(const options of [{scope:'project'},{scope:'project',project_id:'../Magic'},{scope:'shared'},{scope:'global',project_id:project.id},{scope:'project',project_id:9999},{save_path:f.folder},{folder:f.folder}])await assert.rejects(()=>f.memory.createRequest({...input,...options}));
  assert.deepEqual((await f.memory.listRequests()).items,[]);
});
test('scoped retries are atomic and changed payloads conflict',async t=>{
  const f=await fixture(t),project=await f.project('Magic');
  const options={...input,scope:'project',project_id:project.id};
  const created=await Promise.all([f.memory.createRequest(options),f.memory.createRequest(options)]);
  assert.equal(created[0].id,created[1].id);assert.equal(created[0].settings_path,created[1].settings_path);
  await assert.rejects(()=>f.memory.createRequest({...options,title:'Different'}),{code:'SUBMISSION_CONFLICT'});
  assert.equal((await f.memory.listRequests(options)).items.length,1);
});
test('old global records remain readable and an uncertain old submission is not duplicated',async t=>{
  const f=await fixture(t),appId=await f.memory.ensureApp(),id=await f.memory.allocateId();
  const {submission_key,...fields}=input;
  const app=path.join(f.rabHome,'apps',String(appId)),file=path.join(app,'requests',String(id),'settings.json');
  const node=makeNode({...fields,id,meta:{kind:'request',parent:{kind:'app',id:appId}},status:'open'});
  const bytes=JSON.stringify(node,null,2);await mkdir(path.dirname(file),{recursive:true});await writeFile(file,bytes);
  const sha=value=>createHash('sha256').update(value).digest('hex');await mkdir(path.join(app,'submissions'));
  await writeFile(path.join(app,'submissions',`${sha(submission_key)}.json`),JSON.stringify({id,fingerprint:sha(JSON.stringify(fields))}));
  const retried=await f.memory.createRequest(input);assert.equal(retried.id,id);assert.equal(retried.legacy_storage,true);
  const next=await f.memory.createRequest({...input,submission_key:'new-request-after-upgrade'});
  assert.equal(next.settings_path,path.join(f.rabHome,'feature-requests',String(next.id),'settings.json'));
  assert.equal((await f.memory.listRequests()).items.length,2);assert.equal(await readFile(file,'utf8'),bytes);
});
test('request readers do not initialize absent storage and symlinks cannot redirect writes',async t=>{
  const f=await fixture(t),empty=path.join(f.folder,'missing');
  assert.deepEqual((await createRabMemory({rabHome:empty}).listRequests()).items,[]);
  await assert.rejects(()=>readdir(empty),{code:'ENOENT'});
  const outside=path.join(f.folder,'outside');await mkdir(outside);
  await symlink(outside,path.join(f.rabHome,'feature-requests'),process.platform==='win32'?'junction':'dir');
  await assert.rejects(()=>f.memory.createRequest(input),{code:'INVALID_PATH'});
  assert.deepEqual(await readdir(outside),[]);
});
test('Toolbox request tools honor explicit scope and selected project binding',async t=>{
  const f=await fixture(t),project=await f.project('Magic'),context={rab_home:f.rabHome,project};
  const result=await f.house.runTool({key:'base/create/request',options:{...input,scope:'project'},context});
  assert.equal(result.result.project_id,project.id);
  const listed=await f.house.runTool({key:'base/list/requests',options:{scope:'project'},context});
  assert.equal(listed.result.items[0].id,result.result.id);
  const read=await f.house.runTool({key:'base/read/request',options:{scope:'project',id:result.result.id},context});
  assert.equal(read.result.settings_path,result.result.settings_path);
  assert.deepEqual(await readdir(project.root),['settings.json']);
});
test('HTTP requests require a valid project scope and return the exact saved path',async t=>{
  const f=await fixture(t),project=await f.project('Magic');
  const app=await startServer({root,port:0,rabHome:f.rabHome});t.after(()=>app.close());
  const {token}=await fetch(`${app.origin}/api/session`).then(r=>r.json());
  const headers={'X-Magic-Token':token,'Content-Type':'application/json'};
  const response=await fetch(`${app.origin}/api/requests`,{method:'POST',headers,body:JSON.stringify({...input,scope:'project',project_id:project.id})});
  assert.equal(response.status,200);const saved=await response.json();
  const query=`?scope=project&project_id=${project.id}`;
  const listed=await fetch(`${app.origin}/api/requests${query}`,{headers}).then(r=>r.json());assert.equal(listed.items[0].id,saved.id);
  assert.equal((await fetch(`${app.origin}/api/requests/${saved.id}${query}`,{headers})).status,200);
  assert.notEqual((await fetch(`${app.origin}/api/requests/${saved.id}`,{headers})).status,200);
  const global=await fetch(`${app.origin}/api/requests`,{headers}).then(r=>r.json());assert.deepEqual(global.items,[]);
  assert.notEqual((await fetch(`${app.origin}/api/requests?scope=project`,{headers})).status,200);
  assert.equal(saved.settings_path,path.join(f.rabHome,'projects','Magic','feature-requests',String(saved.id),'settings.json'));
});
