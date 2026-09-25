import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, realpath } from 'node:fs/promises';
import { startServer } from '../../server.mjs';
import { createToolHouse } from '../../bridge/tool-house.mjs';
import { createRabMemory } from '../../bridge/rab-memory.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const conforms=(value,shape)=>{
  if(typeof shape==='string')return;
  if(Array.isArray(shape)){assert.ok(Array.isArray(value));return;}
  for(const key of Object.keys(value))assert.ok(Object.hasOwn(shape,key),`Undocumented ${key}`);
  for(const [key,child]of Object.entries(shape)){
    if(key.startsWith('['))continue;
    assert.ok(Object.hasOwn(value,key),`Missing ${key}`);
    if(child&&typeof child==='object'&&!Object.keys(child).some(k=>k.startsWith('[')))conforms(value[key],child);
  }
};

test('public folder tools persist small references, direct counts and bounded HTTP pages',async t=>{
  const temp=await realpath(await mkdtemp(path.join(os.tmpdir(),'rab-folder-public-')));
  t.after(()=>rm(temp,{recursive:true,force:true}));
  const rabHome=path.join(temp,'.rab'),folder=path.join(temp,'source');
  await mkdir(path.join(folder,'nested','empty'),{recursive:true});
  await mkdir(path.join(folder,'.rab'));
  await writeFile(path.join(folder,'one.txt'),'one');
  await writeFile(path.join(folder,'nested','two.txt'),'two');
  const app=await startServer({root,port:0,rabHome});t.after(()=>app.close());
  const house=createToolHouse({root}),memory=createRabMemory({rabHome});
  const project=(await house.runTool({key:'audit/stamp-new-project',options:{name:'Folder runner fixture',folder},context:{rab_home:rabHome}})).result.project;
  const session=await app.workbench.projectActivate({project_id:project.id,mode:'new-session',name:'Test session'});
  const index=await app.workbench.toolsRun({session_id:session.session_id,tool:'audit/index/folders',options:{}});
  assert.equal(index.result.state.status,'completed');
  assert.equal(index.result.state.counts.scanned,3);assert.equal(index.result.state.counts.empty,1);assert.equal(index.result.state.counts.skipped,1);
  assert.equal(index.result.reference.project_id,project.id);
  const batch=await app.workbench.toolsRun({session_id:session.session_id,tool:'audit/run/folder-index',options:{index_id:index.result.reference.id}});
  assert.equal(batch.result.state.counts.completed,3);assert.equal(batch.result.state.counts.skipped,1);
  assert.equal(batch.result.state.status,'partial');
  const selected=await app.workbench.toolsRun({session_id:session.session_id,tool:'audit/run/folder-index',options:{index_id:index.result.reference.id,folder_paths:['nested']}});
  assert.equal(selected.result.state.counts.completed,1);
  const selectedPage=await memory.readFolderRecordPage({projectId:project.id,kind:'batch',id:selected.result.reference.id});
  assert.deepEqual(selectedPage.items.map(row=>row.path),['nested']);
  assert.equal(selectedPage.items[0].result.counts.files,1);
  for(const [out,key]of [[index,'index/folders'],[batch,'run/folder-index']]){
    assert.ok(Buffer.byteLength(JSON.stringify(out.result))<4096);
    conforms(out.result,JSON.parse(await readFile(path.join(root,'tools/audit',key,'contract.json'),'utf8')).result);
    assert.ok(out.result.reference.file.startsWith(path.join(rabHome,'projects',project.name)+path.sep));
  }
  const token=(await(await fetch(app.origin+'/api/session')).json()).token;
  const base=`${app.origin}/api/projects/${project.id}/batches/${batch.result.reference.id}`;
  const get=async suffix=>{const response=await fetch(base+suffix,{headers:{'x-magic-token':token}});return {status:response.status,body:await response.json()};};
  const status=await get('');assert.equal(status.body.state.status,'partial');
  const results=[];let cursor=null;
  do{
    const page=await get('/records?limit=1'+(cursor?'&cursor='+encodeURIComponent(JSON.stringify(cursor)):''));
    assert.equal(page.status,200);assert.ok(page.body.items.length<=1);
    results.push(...page.body.items);cursor=page.body.cursor;
  }while(cursor);
  assert.equal(results.length,4);
  for(const row of results.filter(row=>row.status==='completed')){
    assert.equal(typeof row.folder_id,'number');assert.equal(typeof row.execution.execution_id,'number');assert.ok(row.duration_ms>=0);
    assert.equal(row.result.counts.files,row.path==='.'||row.path==='nested'?1:0);
  }
  assert.notEqual((await get('/records?cursor=%7B')).status,200);
  assert.notEqual((await get('/records?limit=101')).status,200);
  assert.deepEqual(await readdir(path.join(folder,'.rab')),[]);
  assert.equal(await readFile(path.join(folder,'one.txt'),'utf8'),'one');
  await assert.rejects(()=>house.runTool({key:'audit/run/folder-index',options:{project_id:project.id,index_id:index.result.reference.id,tool:'audit/count/classes'},context:{rab_home:rabHome}}),{code:'UNSUPPORTED_FOLDER_SCOPE'});
  assert.equal((await memory.getFolderRecordStatus({projectId:project.id,kind:'index',id:index.result.reference.id})).state.status,'completed');
});
