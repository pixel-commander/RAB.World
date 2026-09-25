import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createToolHouse } from '../bridge/tool-house.mjs';
import { runSecurityVerification } from '../tools/security/_verify.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('generated component classes remain editable without losing caller props',async t=>{
  const project=await mkdtemp(path.join(os.tmpdir(),'rab-composed-class-'));
  t.after(()=>rm(project,{recursive:true,force:true}));
  const house=createToolHouse({root}),context={project:{root:project}};
  await house.runTool({key:'react/stamp-new-component',options:{name:'Panel',location:path.join(project,'src'),class_name:'initial'},context});
  await house.runTool({key:'add-class',options:{component:'Panel',class_name:'skin'},context});
  await house.runTool({key:'add-class',options:{component:'Panel',class_name:'skin'},context});
  let text=await readFile(path.join(project,'src/Panel/Panel.tsx'),'utf8');
  assert.match(text,/\["initial skin", className\]/);assert.match(text,/\.filter\(Boolean\)\.join/);assert.match(text,/\.\.\.domProps/);
  await house.runTool({key:'change-class',options:{component:'Panel',from_class:'skin',to_class:'quiet'},context});
  await house.runTool({key:'remove-class',options:{component:'Panel',class_name:'initial'},context});
  text=await readFile(path.join(project,'src/Panel/Panel.tsx'),'utf8');assert.match(text,/\["quiet", className\]/);
  const dynamic=text.replace('["quiet", className].filter(Boolean).join(\' \')','chooseClass()');
  await writeFile(path.join(project,'src/Panel/Panel.tsx'),dynamic);
  await assert.rejects(()=>house.runTool({key:'add-class',options:{component:'Panel',class_name:'unsafe'},context}),e=>e.code==='DYNAMIC_CLASS_UNSUPPORTED');
  assert.equal(await readFile(path.join(project,'src/Panel/Panel.tsx'),'utf8'),dynamic);
});

const projectFixture=async t=>{
  const project=await mkdtemp(path.join(os.tmpdir(),'rab-dom-edit-'));
  t.after(()=>rm(project,{recursive:true,force:true}));
  await mkdir(path.join(project,'src'),{recursive:true});
  await writeFile(path.join(project,'src','Panels.tsx'),`export const Other = () => <aside data-area="other">Other</aside>;

export const Panel = () => (
  <main data-area="main" className="root">
    <section data-area="side"></section>
    <section data-area="side" className="old"></section>
  </main>
);
`);
  return project;
};

test('DOM class Tools default to selected component root and honor all data-area matches',async t=>{
  const project=await projectFixture(t); const house=createToolHouse({root}); const context={project:{root:project}};
  let out=await house.runTool({key:'add-class',options:{component:'Panel',class_name:'shell'},context});
  assert.equal(out.result.status,'updated'); assert.equal(out.result.targets,1); assert.equal(out.result.target.defaulted_to_root,true);
  let text=await readFile(path.join(project,'src','Panels.tsx'),'utf8');
  assert.match(text,/<main data-area="main" className="root shell">/); assert.match(text,/<aside data-area="other">Other<\/aside>/);

  out=await house.runTool({key:'add-class',options:{component:'Panel',data_area:'side',quantifier:'all',class_name:'pane'},context});
  assert.equal(out.result.targets,2);
  text=await readFile(path.join(project,'src','Panels.tsx'),'utf8');
  assert.equal((text.match(/className="pane"/g)??[]).length,1);
  assert.match(text,/className="old pane"/);

  out=await house.runTool({key:'change-class',options:{component:'Panel',data_area:'side',quantifier:'all',from_class:'pane',to_class:'slot'},context});
  assert.equal(out.result.targets,2);
  text=await readFile(path.join(project,'src','Panels.tsx'),'utf8');
  assert.equal((text.match(/\bslot\b/g)??[]).length,2);
  assert.doesNotMatch(text,/\bpane\b/);
});

test('add-element inserts child into selected data-area with class and new data-area',async t=>{
  const project=await projectFixture(t); const house=createToolHouse({root}); const context={project:{root:project}};
  const out=await house.runTool({key:'add-element',options:{component:'Panel',data_area:'main',tag:'div',class_name:'content',new_data_area:'body'},context});
  assert.equal(out.result.status,'updated'); assert.equal(out.result.targets,1);
  const text=await readFile(path.join(project,'src','Panels.tsx'),'utf8');
  assert.match(text,/<div className="content" data-area="body"><\/div>/);
});

test('DOM edit Tools reject files outside loaded project',async t=>{
  const project=await projectFixture(t); const outside=path.join(os.tmpdir(),`rab-outside-${Date.now()}.tsx`); await writeFile(outside,'export const X=()=> <div/>;');t.after(()=>rm(outside,{force:true}));
  const house=createToolHouse({root});
  await assert.rejects(()=>house.runTool({key:'add-class',options:{file:outside,class_name:'x'},context:{project:{root:project}}}),error=>error.code==='BAD_REQUEST');
});

test('active bounded security verifier pulls the real doors and all probes pass',async()=>{
  const result=await runSecurityVerification({root,check:'all'});
  assert.equal(result.status,'pass',JSON.stringify(result.rows.filter(x=>x.status==='fail'),null,2));
  assert.equal(result.totals.failed,0); assert.ok(result.totals.checks>=17);
  for(const required of ['cross-origin','host-mismatch','completed-run-replay','unreceipted-file','receipt-path-traversal','project-override-symlink-escape','paths-dot-segment','tool-context-project-forgery','tool-context-rab-home-forgery','control-mentioned-not-promoted','control-negation-preserved']){
    assert.equal(result.rows.find(x=>x.check===required)?.status,'pass',required);
  }
});

test('security verifier is exposed as House Tools through one shared engine',async()=>{
  const house=createToolHouse({root}); const scan=await house.listTools({fresh:true});
  for(const key of ['security/check/http-boundaries','security/check/project-override','security/check/paths-registry','security/check/control-plane-language','security/check/workbench']) assert.ok(scan.items.some(x=>x.key===key),key);
  const result=await house.runTool({key:'check-paths-registry'}); assert.equal(result.result.status,'pass');
});
