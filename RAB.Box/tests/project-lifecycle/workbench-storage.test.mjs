import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {mkdtemp,cp,mkdir,readFile,writeFile,readdir,rm,rmdir,rename,symlink} from 'node:fs/promises';
import {createWorkbench} from '../../bridge/service.mjs';
import {createRabMemory} from '../../bridge/rab-memory.mjs';

const source=fileURLToPath(new URL('../../',import.meta.url));
const fixture=async t=>{
  const folder=await mkdtemp(path.join(os.tmpdir(),'rab-workbench-storage-'));
  t.after(async()=>{assert.equal(path.dirname(folder),os.tmpdir());assert.ok(path.basename(folder).startsWith('rab-workbench-storage-'));await rm(folder,{recursive:true,force:true});});
  const root=path.join(folder,'repository'),rabHome=path.join(folder,'home');await mkdir(root);
  for(const entry of ['HOST.json','mock-project','tools','bridge','engine','language'])await cp(path.join(source,entry),path.join(root,entry),{recursive:true});
  await mkdir(path.join(root,'runs'));
  return {root,rabHome,folder,box:createWorkbench({root,rabHome}),memory:createRabMemory({rabHome})};
};
const snapshot=async dir=>{
  const files={};
  const walk=async base=>{for(const entry of await readdir(base,{withFileTypes:true})){const file=path.join(base,entry.name);if(entry.isDirectory())await walk(file);else files[path.relative(dir,file)]=createHash('sha256').update(await readFile(file)).digest('hex');}};
  await walk(dir);return files;
};
const request=root=>({request:{mode:'command',capability:'react/stamp-new-component',options:{location:path.join(root,'mock-project','components')}}});
const meta=root=>({id:'mock-project',name:'Mock project',root:path.join(root,'mock-project')});

test('new Workbench prepares and answers save only in the owning memory project',async t=>{
  const f=await fixture(t);await f.box.initialize();
  const legacy=await snapshot(path.join(f.root,'runs')),sourceBefore=await snapshot(path.join(f.root,'mock-project'));
  let run=await f.box.prepare(request(f.root));assert.equal(run.status,'input-required');
  const directory=await f.memory.workbenchRunsDirectory(meta(f.root));
  assert.equal(directory,path.join(f.rabHome,'projects','Mock project','runs','workbench'));
  const file=path.join(directory,String(run.id),'run.json');assert.equal(JSON.parse(await readFile(file)).id,run.id);
  run=await f.box.act(run.id,'answer',{revision:run.revision,stamp:'react/stamp-new-component',key:'name',value:'PreparedOnly'});
  assert.equal(run.status,'ready');assert.equal(JSON.parse(await readFile(file)).revision,1);
  assert.equal((await f.box.read(run.id)).id,run.id);assert.ok((await f.box.list()).items.some(x=>x.id===run.id));
  assert.deepEqual(await snapshot(path.join(f.root,'runs')),legacy);
  assert.deepEqual(await snapshot(path.join(f.root,'mock-project')),sourceBefore);
});

test('old HOST run records remain readable but cannot be resumed or rewritten',async t=>{
  const f=await fixture(t),id=1700000000001;
  const old={version:'tool-house-run/v1',id,project_id:'mock-project',revision:0,status:'ready',original:'Historical request',ticket:{version:'tool-house-ticket/v1'},result:{status:'ready'},history:[]};
  const folder=path.join(f.root,'runs',String(id));await mkdir(folder);const file=path.join(folder,'run.json'),bytes=JSON.stringify(old);await writeFile(file,bytes);
  const loaded=await f.box.read(id);assert.equal(loaded.read_only,true);assert.equal((await f.box.list()).items[0].read_only,true);
  for(const action of ['resume','execute'])await assert.rejects(()=>f.box.act(id,action,{revision:0,...(action==='execute'?{confirm:true}:{})}),{code:'LEGACY_RUN_READ_ONLY'});
  assert.equal(await readFile(file,'utf8'),bytes);await assert.rejects(()=>readdir(f.rabHome),{code:'ENOENT'});
});

test('legacy records from another project are not returned and bad current records do not fall back',async t=>{
  const f=await fixture(t);await f.box.initialize();const run=await f.box.prepare(request(f.root));
  const legacyFolder=path.join(f.root,'runs',String(run.id));await mkdir(legacyFolder);await writeFile(path.join(legacyFolder,'run.json'),JSON.stringify(run));
  const directory=await f.memory.workbenchRunsDirectory(meta(f.root));await writeFile(path.join(directory,String(run.id),'run.json'),JSON.stringify({...run,project_id:'another-project'}));
  await assert.rejects(()=>f.box.read(run.id),{code:'WRONG_PROJECT'});
  const foreignFolder=path.join(f.root,'runs','1700000000002');await mkdir(foreignFolder);await writeFile(path.join(foreignFolder,'run.json'),JSON.stringify({...run,id:1700000000002,project_id:'another-project'}));
  await assert.rejects(()=>f.box.read(1700000000002),{code:'WRONG_PROJECT'});
  assert.deepEqual((await f.box.list()).items,[]);
});

test('new saves do not require a legacy run directory and cannot escape memory via a junction',async t=>{
  const f=await fixture(t);await rmdir(path.join(f.root,'runs'));await f.box.initialize();
  const run=await f.box.prepare(request(f.root));assert.equal(run.status,'input-required');await assert.rejects(()=>readdir(path.join(f.root,'runs')),{code:'ENOENT'});
  const directory=await f.memory.workbenchRunsDirectory(meta(f.root)),outside=path.join(f.folder,'outside');await mkdir(outside);
  const renamed=path.join(path.dirname(directory),'preserved-workbench');
  await rename(directory,renamed);await symlink(outside,directory,process.platform==='win32'?'junction':'dir');
  await assert.rejects(()=>f.box.prepare(request(f.root)),{code:'INVALID_PATH'});assert.deepEqual(await readdir(outside),[]);
});
