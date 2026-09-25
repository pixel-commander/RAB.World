import test from 'node:test';
import { request as httpRequest } from 'node:http';
import assert from 'node:assert/strict';
import { mkdtemp, cp, rm, readFile, writeFile, rename, mkdir, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server.mjs';
import { createToolHouse } from '../bridge/tool-house.mjs';

const source = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const fixture = async t => {
  const root = await mkdtemp(path.join(os.tmpdir(),'magic-box UI test '));
  for(const file of ['HOST.json','mock-project','magic-box','language','runs','tools','bridge','engine']) await cp(path.join(source,file),path.join(root,file),{recursive:true});
  const app = await startServer({root,port:0,rabHome:path.join(root,'.rab')});
  t.after(async()=>{await app.close();await rm(root,{recursive:true,force:true});});
  const session = await fetch(app.origin+'/api/session').then(r=>r.json());
  const request = async (url,method='GET',body,extra={}) => {
    const response = await fetch(app.origin+url,{method,headers:{'X-Magic-Token':session.token,...(body===undefined?{}:{'Content-Type':'application/json'}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
    return {status:response.status,data:await response.json()};
  };
  return {root,app,request};
};
const reactText = 'stamp a new react project named "test-project" into the current project folder';

const manual=(root,options={})=>({request:{mode:'command',capability:'react/stamp-new-component',options:{location:path.join(root,'mock-project','components'),...options}}});

test('selected session scopes Workbench contracts, execution, receipts and paths',async t=>{
  const {root,app,request}=await fixture(t),rabHome=path.join(root,'.rab'),house=createToolHouse({root});
  const made=[];
  for(const name of ['SelectedAlpha','SelectedBeta'])made.push((await house.runTool({key:'react/stamp-new-project',options:{name,folder:root},context:{rab_home:rabHome}})).result);
  const [alpha,beta]=await Promise.all(made.map(p=>app.workbench.projectActivate({project_id:p.project.id,mode:'new-session',name:'Test session'})));
  const query=`?session_id=${alpha.session_id}`;
  assert.equal((await request('/api/stamp'+query+'&name=react/stamp-new-component')).status,200);
  const payload={request:{mode:'command',capability:'react/stamp-new-component',options:{name:'ScopedCard',location:path.join(made[0].project.root,made[0].settings.paths.components)}}};
  const prepared=await request('/api/runs'+query,'POST',payload);assert.equal(prepared.data.status,'ready');
  const id=prepared.data.id;
  const done=await request(`/api/runs/${id}/execute`+query,'POST',{revision:prepared.data.revision,confirm:true});
  assert.equal(done.data.status,'completed');assert.equal(done.data.project_id,made[0].project.id);
  assert.equal(done.data.result.receipt.steps[0].tasks[0].execution.session_id,alpha.session_id);
  const artifact=done.data.result.receipt.steps[0].files.find(f=>f.path.endsWith('.tsx'));
  assert.ok(artifact);
  const view=await request(`/api/runs/${id}/file`+query+'&path='+encodeURIComponent(artifact.path));assert.equal(view.status,200);assert.equal(view.data.matches_receipt,true);
  assert.equal((await request(`/api/runs/${id}?session_id=${beta.session_id}`)).status,404);
  await request('/api/project/path','POST',{session_id:alpha.session_id,key:'scratch',value:'scratch-output'});
  assert.deepEqual(JSON.parse(await readFile(path.join(made[0].project.root,'settings.json'),'utf8')).paths.scratch,{path:'scratch-output',description:''});
  assert.equal(JSON.parse(await readFile(path.join(made[1].project.root,'settings.json'),'utf8')).paths.scratch,undefined);
  assert.equal((await request('/api/projects')).data.items.length,2,'No host project created incidentally');
});

test('HTML is self-contained; no remote script or stylesheet',async t=>{
 const {app}=await fixture(t); const response=await fetch(app.origin+'/'); const html=await response.text();
 assert.equal(response.status,200);assert.match(html,/<textarea id="request-text"/);assert.match(html,/id="view-language"/);assert.match(html,/id="view-rephrase"/);assert.doesNotMatch(html,/<script[^>]+src=|<link[^>]+stylesheet/);assert.match(response.headers.get('content-security-policy'),/sha256-/);
 const styles=html.match(/<style>([\s\S]*?)<\/style>/)[1];assert.doesNotMatch(styles,/display\s*:\s*flex|minmax\s*\(|min-width\s*:\s*0/);assert.doesNotMatch(html,/setInterval\(/);
});
test('project inspection lists current Tool House stamps, not project legacy declarations',async t=>{const {request}=await fixture(t);const {data}=await request('/api/project');assert.equal(typeof data.project.id,'number');assert.equal(data.project.name,'Mock project');assert.ok(data.capabilities.some(c=>c.name==='react/stamp-new-component'));assert.ok(!data.capabilities.some(c=>c.name==='react-project'));});
test('missing native stamp is unavailable; no old fallback',async t=>{const {root,request}=await fixture(t);await rm(path.join(root,'tools/react/stamp-new-component/stamp-new-component.mjs'));const {data}=await request('/api/project');assert.ok(data.unavailable.some(s=>s.key==='react/stamp-new-component'));assert.ok(!data.capabilities.some(s=>s.name==='react/stamp-new-component'));});
test('project PATHS.json is mandatory',async t=>{const {root,request}=await fixture(t);await rm(path.join(root,'mock-project/PATHS.json'));const out=await request('/api/runs','POST',{text:reactText});assert.notEqual(out.status,200);});
test('prepare asks only for missing seats and persists the request',async t=>{const {root,request}=await fixture(t);const {data:run}=await request('/api/runs','POST',manual(root));assert.equal(run.status,'input-required');assert.deepEqual(run.result.questions.map(q=>q.key),['name']);const runsRoot=(await request('/api/project')).data.runs_path;assert.ok(runsRoot.startsWith(path.join(root,'.rab','projects')+path.sep));const saved=JSON.parse(await readFile(path.join(runsRoot,String(run.id),'run.json'),'utf8'));assert.equal(saved.ticket.version,'tool-house-ticket/v1');assert.equal((await request('/api/runs/'+run.id)).data.id,run.id);});
test('answer retains ID; shared runner writes verified receipt; repeated execution rejected',async t=>{const {root,request}=await fixture(t);let {data:run}=await request('/api/runs','POST',manual(root));const id=run.id;run=(await request('/api/runs/'+id+'/answer','POST',{revision:run.revision,stamp:'react/stamp-new-component',key:'name',value:'Card'})).data;assert.equal(run.status,'ready');assert.equal(run.id,id);run=(await request('/api/runs/'+id+'/execute','POST',{revision:run.revision,confirm:true})).data;assert.equal(run.status,'completed');assert.ok(run.result.receipt.steps[0].execution.execution_id);const file=run.result.receipt.steps[0].files[0].path;const inspected=(await request('/api/runs/'+id+'/file?path='+encodeURIComponent(file))).data;assert.equal(inspected.matches_receipt,true,JSON.stringify(inspected));assert.notEqual((await request('/api/runs/'+id+'/execute','POST',{revision:run.revision,confirm:true})).status,200);await writeFile(path.join(root,'mock-project',file),'modified');assert.equal((await request('/api/runs/'+id+'/file?path='+encodeURIComponent(file))).data.matches_receipt,false);});
test('old canonical stamp names do not invoke an implicit legacy fallback',async t=>{const {request}=await fixture(t);const {data:run}=await request('/api/runs','POST',{request:{mode:'command',capability:'div-stamp',options:{name:'x',class:'x'}}});assert.notEqual(run.status,'ready');assert.equal(run.ticket,null);});
test('manual false remains false through shared binding',async t=>{const {root,request}=await fixture(t);const {data:run}=await request('/api/runs','POST',manual(root,{name:'Card',save_as_text:false}));assert.equal(run.status,'ready');assert.equal(run.result.frames[0].options.save_as_text,false);});
test('invalid answer remains recoverable without losing previous bindings',async t=>{const {root,request}=await fixture(t);let {data:run}=await request('/api/runs','POST',manual(root));run=(await request('/api/runs/'+run.id+'/answer','POST',{revision:run.revision,stamp:'react/stamp-new-component',key:'name',value:42})).data;assert.equal(run.status,'input-required');assert.equal(run.last_error.status,'invalid-input');assert.equal(run.ticket.options.location,path.join(root,'mock-project','components'));});
test('stale tab revision cannot answer or execute',async t=>{const {root,request}=await fixture(t);let {data:run}=await request('/api/runs','POST',manual(root));const stale=run.revision;run=(await request('/api/runs/'+run.id+'/answer','POST',{revision:run.revision,stamp:'react/stamp-new-component',key:'name',value:'Card'})).data;assert.equal((await request('/api/runs/'+run.id+'/execute','POST',{revision:stale,confirm:true})).status,409);});
test('contract edit forces stale-contract; no execution',async t=>{const {root,request}=await fixture(t);const {data:run}=await request('/api/runs','POST',manual(root,{name:'Card'}));const file=path.join(root,'tools/react/stamp-new-component/settings.json');const settings=JSON.parse(await readFile(file,'utf8'));settings.title='Changed';await writeFile(file,JSON.stringify(settings));const next=(await request('/api/runs/'+run.id+'/resume','POST',{revision:run.revision})).data;assert.equal(next.result.status,'stale-contract');});
test('manual contract uses native IDs and settings',async t=>{const {request}=await fixture(t);const out=await request('/api/stamp?name=react%2Fstamp-new-component');assert.equal(out.status,200);assert.equal(out.data.binding.id,1790000000401);assert.equal(out.data.settings.options.name.required,true);});
test('interrupted running record stays non-executable',async t=>{const {request,root}=await fixture(t);const {data:run}=await request('/api/runs','POST',manual(root,{name:'Card'}));run.status='running';const runsRoot=(await request('/api/project')).data.runs_path;await writeFile(path.join(runsRoot,String(run.id),'run.json'),JSON.stringify(run));assert.equal((await request('/api/runs/'+run.id)).data.status,'execution-interrupted');assert.equal((await request('/api/runs/'+run.id+'/execute','POST',{revision:run.revision,confirm:true})).status,409);});
test('safety: cross-origin, host mismatch, missing token and shell routes blocked',async t=>{const {request,app}=await fixture(t);assert.equal((await fetch(app.origin+'/api/runs')).status,403);assert.equal((await request('/api/project','GET',undefined,{Origin:'https://example.com'})).status,403);const hostReply=await new Promise(resolve=>{const req=httpRequest(app.origin+'/api/project',{headers:{Host:'evil.test'}},res=>{let text='';res.on('data',chunk=>text+=chunk);res.on('end',()=>resolve({status:res.statusCode,data:JSON.parse(text)}));});req.end();});assert.equal(hostReply.status,403);assert.equal(hostReply.data.code,'BAD_HOST');assert.equal((await request('/api/shell','POST',{command:'echo hi'})).status,404);assert.equal((await request('/mock-project/PATHS.json')).status,404);});
test('symlinked output paths and unsafe run IDs rejected',async t=>{const {request,root}=await fixture(t);const marker=path.join(root,'mock-project','linked');await symlink(path.join(root,'tools'),marker,process.platform==='win32'?'junction':'dir');const {data:run}=await request('/api/runs','POST',manual(root,{name:'Card',location:marker}));const out=(await request('/api/runs/'+run.id+'/execute','POST',{revision:run.revision,confirm:true})).data;assert.equal(out.status,'execution-failed');assert.equal((await request('/api/runs/bad')).status,404);});
test('unsupported wording and negation do not execute',async t=>{const {request}=await fixture(t);const {data}=await request('/api/runs','POST',{text:'do not make a div with class x'});assert.notEqual(data.status,'ready');assert.equal(data.ticket,null);});
test('resource shelf, exact sense search and original grammar available offline',async t=>{const {request}=await fixture(t);const {data}=await request('/api/language');assert.ok(data.resources.some(r=>r.id==='wordnet'));assert.ok(data.installed.length);const senses=(await request('/api/language/search?q=build')).data;assert.equal(senses.total,2);assert.match(senses.method,/no semantic similarity/);assert.match((await request('/api/language/grammar')).data.text,/\?n/);});
test('review import preserves provenance and never changes active grammar',async t=>{
 const {request,root}=await fixture(t);const before=await readFile(path.join(root,'mock-project/PATHS.json'),'utf8');
 const seed=JSON.parse(await readFile(path.join(root,'language/imports/workbench-seed.json'),'utf8'));seed.entries=[{...seed.entries[0],id:'test-new',word:'conjure',forms:['conjure']}];
 const imported=await request('/api/language/import','POST',seed);assert.equal(imported.data.status,'imported-for-review');assert.equal((await request('/api/language/import','POST',seed)).data.status,'already-present');assert.equal((await request('/api/language/search?q=conjure')).data.total,1);
 assert.equal(await readFile(path.join(root,'mock-project/PATHS.json'),'utf8'),before);assert.notEqual((await request('/api/runs','POST',{text:'conjure a div with class x'})).data.status,'ready');
 await rm(path.join(root,'language/imports',imported.data.file));assert.equal((await request('/api/language/search?q=conjure')).data.total,0);
});
test('malformed language export is rejected, broken local resource reported',async t=>{const {request,root}=await fixture(t);assert.equal((await request('/api/language/import','POST',{entries:[]})).status,400);await writeFile(path.join(root,'language/imports/broken.json'),'{');assert.equal((await request('/api/language')).data.unavailable[0].file,'broken.json');});
test('saved run history remains readable after relocation without registering another project',async t=>{
  const {request,root}=await fixture(t),{data:run}=await request('/api/runs','POST',manual(root));
  // Model the old HOST.runs layout explicitly: new runs no longer write there.
  const legacyFolder=path.join(root,'runs',String(run.id));await mkdir(legacyFolder);await writeFile(path.join(legacyFolder,'run.json'),JSON.stringify(run));
  const moved=await mkdtemp(path.join(os.tmpdir(),'magic-box moved '));await cp(root,moved,{recursive:true});
  const rootsFile=path.join(moved,'.rab','project-roots.json'),before=await readFile(rootsFile,'utf8');
  const second=await startServer({root:moved,port:0,rabHome:path.join(moved,'.rab')});
  try{
    const session=await fetch(second.origin+'/api/session').then(r=>r.json());
    const headers={'X-Magic-Token':session.token};
    const loaded=await fetch(second.origin+'/api/runs/'+run.id,{headers}).then(r=>r.json());
    assert.equal(loaded.id,run.id);assert.equal(loaded.status,'input-required');assert.equal(loaded.read_only,true);
    const listed=await fetch(second.origin+'/api/runs',{headers}).then(r=>r.json());
    assert.ok(listed.items.some(item=>item.id===run.id));
    assert.equal(await readFile(rootsFile,'utf8'),before);
  }finally{await second.close();await rm(moved,{recursive:true,force:true});}
});
test('new Tool API lists the real tools folder and re-phrase runs only its Tool',async t=>{
  const {request}=await fixture(t);
  const listed=await request('/api/tools');assert.equal(listed.status,200);assert.ok(listed.data.items.some(x=>x.key==='base/re-phrase-check'));assert.ok(listed.data.items.some(x=>x.key==='base/stamp-new-stamp'&&x.kind==='stamp'));
  const out=await request('/api/tools/run','POST',{tool:'base/re-phrase-check',options:{text:`re-phrase "this didn't work"`},context:{domain:'base'}});
  assert.equal(out.status,200);assert.equal(out.data.tool.key,'base/re-phrase-check');assert.equal(out.data.result.primary,'This failed.');assert.equal(out.data.result.shape.opposite,'fail');
});
