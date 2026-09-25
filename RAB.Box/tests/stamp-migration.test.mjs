import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, lstat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createToolHouse } from '../bridge/tool-house.mjs';
import { writeArtifactPlan } from '../tools/_artifact-plan.mjs';
import { createToolWorkbench } from '../bridge/tool-workbench.mjs';
import { loadProject } from '../engine/src/project.mjs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const execFileAsync=promisify(execFile);
const fixture=async()=>{
  const temp=await mkdtemp(path.join(os.tmpdir(),'rab-stamp-migration-'));
  const project=path.join(temp,'project'); await mkdir(project);
  await writeFile(path.join(project,'settings.json'),JSON.stringify({paths:{components:'components',pages:'pages',atoms:'atoms'}}));
  await writeFile(path.join(project,'PATHS.json'),JSON.stringify({project:{id:'migration'},stamps:{},tools:{},catalogs:{tokens:{kind:'json',path:'tokens.json'}}}));
  await writeFile(path.join(project,'tokens.json'),JSON.stringify({complete:true,values:['--surface-main']}));
  return {temp,project,house:createToolHouse({root}),context:{rab_home:path.join(temp,'.rab'),project:{id:'migration',name:'migration',root:project}}};
};

test('public CLI prepares without writing, then executes the native stamp with verified output',async()=>{
  const f=await fixture();
  const request=path.join(f.temp,'request.json');
  await writeFile(request,JSON.stringify({mode:'command',capability:'react/stamp-new-component',options:{name:'CliPanel',location:path.join(f.project,'components')}}));
  const args=[path.join(root,'engine/cli.mjs'),'--project',f.project,'--rab-home',path.join(f.temp,'.rab'),'--canonical',request];
  const ready=JSON.parse((await execFileAsync(process.execPath,args)).stdout);
  assert.equal(ready.status,'ready');
  await assert.rejects(lstat(path.join(f.project,'components/CliPanel')),{code:'ENOENT'});
  const done=JSON.parse((await execFileAsync(process.execPath,[...args,'--execute'])).stdout);
  assert.equal(done.status,'completed');
  assert.equal(done.receipt.steps[0].result.verification.status,'verified');
  assert.match(await readFile(path.join(f.project,'components/CliPanel/CliPanel.tsx'),'utf8'),/\.\.\.domProps/);
});

test('migrated parent and child stamps preserve props, classes, metadata and verified files',async()=>{
  const f=await fixture();
  const parent=await f.house.runTool({key:'react/stamp-new-component',options:{name:'Panel',location:path.join(f.project,'components'),class_name:'container-cell'},context:f.context});
  const child=await f.house.runTool({key:'react/stamp-sub-component',options:{name:'Menu',parent_path:parent.result.folder,class_name:'effect-inset'},context:f.context});
  const text=await readFile(child.result.path,'utf8');
  assert.match(text,/\.\.\.domProps/); assert.match(text,/"effect-inset", className/);
  assert.match(text,/children = 'Menu'/);
  const meta=JSON.parse(await readFile(path.join(child.result.folder,'settings.json'),'utf8'));
  assert.equal(meta.parent_path,parent.result.folder); assert.equal(meta.class,'effect-inset');
  assert.equal(child.result.verification.status,'verified'); assert.equal(child.result.verification.files.length,3);
  await assert.rejects(f.house.runTool({key:'react/stamp-sub-component',options:{name:'Menu',parent_path:parent.result.folder},context:f.context}),{code:'EEXIST'});
  assert.equal(await readFile(child.result.path,'utf8'),text);
});

test('page content is escaped as text, remains overridable and keeps construction seats',async()=>{
  const f=await fixture();
  const result=await f.house.runTool({key:'react/stamp-new-page',options:{name:'Home',content:'hello "world" <script>'},context:f.context});
  const text=await readFile(result.result.file,'utf8');
  assert.match(text,/children = "hello \\"world\\" <script>"/);
  assert.match(text,/data-rab-seat="page-home:p1"/);
  assert.equal(result.result.verification.status,'verified');
});

test('token-backed atoms require registered tokens and cannot overwrite existing CSS',async()=>{
  const f=await fixture(),location=path.join(f.project,'atoms');
  const result=await f.house.runTool({key:'css/stamp-new-atom',options:{name:'container-test',location,token:'--surface-main'},context:f.context});
  assert.match(await readFile(result.result.path,'utf8'),/var\(--container-test-background, var\(--surface-main\)\)/);
  assert.equal(result.result.verification.status,'verified');
  await assert.rejects(f.house.runTool({key:'css/stamp-new-atom',options:{name:'bad-token',location,token:'--unregistered'},context:f.context}),{code:'BAD_REQUEST'});
  await assert.rejects(f.house.runTool({key:'css/stamp-new-atom',options:{name:'no-input',location},context:f.context}),{code:'INPUT_REQUIRED'});
});

test('artifact preflight rejects traversal, duplicate paths, and escaping allowed roots before writing',async()=>{
  const f=await fixture(); const destination=path.join(f.project,'New');
  for(const files of [[{path:'../escape',text:'x'}],[{path:'A.tsx',text:'x'},{path:'a.tsx',text:'y'}],[{path:'a',text:'x'},{path:'a/b',text:'y'}]]){
    await assert.rejects(writeArtifactPlan({destination,files}));
    await assert.rejects(lstat(destination),{code:'ENOENT'});
  }
  await assert.rejects(writeArtifactPlan({destination,allowedRoot:path.join(f.project,'elsewhere'),files:[{path:'x',text:'y'}]}),{code:'DENIED'});
});

test('React project template is verified without modifying its existing scaffold contract',async()=>{
  const f=await fixture();
  const out=await f.house.runTool({key:'react/stamp-new-project',options:{folder:f.project,name:'demo'},context:{rab_home:path.join(f.temp,'.rab')}});
  const pkg=JSON.parse(await readFile(path.join(out.result.project.root,'package.json'),'utf8'));
  assert.equal(pkg.scripts.build,'tsc --noEmit && vite build');
  assert.equal(out.result.verification.status,'verified');
  assert.ok(out.result.verification.files.some(x=>x.path.endsWith('vite.config.mjs')));
});

test('optional StyleGuide and SQLite payload survive without replacing current package setup',async()=>{
  const f=await fixture();
  const out=await f.house.runTool({key:'react/stamp-new-project',options:{folder:f.project,name:'demo',starter:'style-guide',add_database:true},context:{rab_home:path.join(f.temp,'.rab')}});
  const project=out.result.project.root;
  assert.match(await readFile(path.join(project,'src/dashboards/StyleGuide.tsx'),'utf8'),/<h1>\{"demo"\}<\/h1>/);
  assert.match(await readFile(path.join(project,'src/components/Button/demo/Demo.tsx'),'utf8'),/\{"demo"\} is ready/);
  assert.ok((await readFile(path.join(project,'data/app.sqlite'))).subarray(0,16).toString().startsWith('SQLite format 3'));
  const pkg=JSON.parse(await readFile(path.join(project,'package.json'),'utf8'));
  assert.ok(pkg.devDependencies['@vitejs/plugin-react']);
});

test('Workbench missing-atom question resumes the same ticket through native child calls',async()=>{
  const f=await fixture();
  const box=createToolWorkbench({toolHouse:f.house,project:await loadProject(f.project),context:f.context});
  let state=await box.prepare({mode:'command',capability:'react/stamp-new-component',options:{name:'WithAtom',location:path.join(f.project,'components'),class_name:'container-fresh',ensure_atoms:true}});
  assert.equal(state.status,'ready');const id=state.ticket.id;
  state=await box.execute(state.ticket);
  assert.equal(state.status,'input-required');assert.equal(state.ticket.id,id);assert.equal(state.questions[0].key,'background_token');
  await assert.rejects(lstat(path.join(f.project,'components/WithAtom')),{code:'ENOENT'});
  state=await box.answer(state.ticket,{request_id:id,stamp:'react/stamp-new-component',values:{background_token:'--surface-main'}});
  assert.equal(state.status,'ready');
  state=await box.execute(state.ticket);
  assert.equal(state.status,'completed');
  assert.ok(state.receipt.steps[0].tasks.some(t=>t.tool?.path==='css/stamp-new-atom'||t.tool?.key==='css/stamp-new-atom'));
  assert.match(await readFile(path.join(f.project,'atoms/container-fresh.css'),'utf8'),/--surface-main/);
});
