import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { createSeatParser } from '../bridge/seat-parser.mjs';
import { createToolHouse } from '../bridge/tool-house.mjs';
import { createWorkbench } from '../bridge/service.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('house discovers representative tools and stamps with unique identities',async()=>{
  const house=createToolHouse({root});
  const scan=await house.scan({fresh:true});
  assert.ok(scan.items.some(tool=>tool.key==='base/stamp-new-stamp'&&tool.kind==='stamp'));
  assert.ok(scan.items.some(tool=>tool.key==='audit/find-files'&&tool.kind==='tool'));
  assert.equal(new Set(scan.items.map(tool=>String(tool.id))).size,scan.items.length);
  assert.equal(scan.unavailable.length,0);
});

test('v0.9.0 capability resolution follows path/tag semantics',async()=>{
  const house=createToolHouse({root});
  const cases=[
    ['find all hooks','react','react/find/hooks'],
    ['find hooks','react','react/find/hooks'],
    ['find state hooks','react','react/find/hooks/state-hooks'],
    ['count hooks','react','react/count/hooks'],
    ['count files',undefined,'audit/count/files'],
    ['count components','react','react/count/components']
  ];
  for(const [query,domain,expected] of cases){
    const found=await house.findTools({query,domain,includeStamps:false});
    assert.equal(found.items[0]?.path,expected,query);
  }
});

test('typed composition preserves known structure around unknown language',async()=>{
  const parser=await createSeatParser({languageRoot:path.join(root,'language')});
  let frame=parser.parse('find fuck-off hooks',{context:{},knownEntities:[]}).frames[0];
  assert.equal(frame.seats.operation,'find');
  assert.equal(frame.seats.target_type,'hook');
  assert.deepEqual(frame.seats.predicate,{value:'fuck-off',type:'predicate',known:false});
  assert.equal(frame.typedUnknowns[0].seat,'predicate');
  assert.equal(frame.unknownTokens.length,0);
  assert.equal(frame.completeLanguage,false);

  frame=parser.parse('hack a new component named "do-it"',{context:{},knownEntities:[]}).frames[0];
  assert.equal(frame.seats.operation,'create');
  assert.equal(frame.seats.target_type,'component');
  assert.equal(frame.seats.name,'do-it');
  assert.equal(frame.typedUnknowns[0].value,'hack');
  assert.equal(frame.typedUnknowns[0].type,'operation-alias');
  assert.equal(frame.completeLanguage,false);
});

test('settings try visibly resolves a missing seat through a child Tool and resumes parent',async t=>{
  const temp=await mkdtemp(path.join(os.tmpdir(),'rab-v085-try-')); t.after(()=>rm(temp,{recursive:true,force:true}));
  const projectRoot=path.join(temp,'project'); await mkdir(path.join(projectRoot,'src'),{recursive:true});
  await writeFile(path.join(projectRoot,'settings.json'),JSON.stringify({id:'demo',name:'demo',type:'react'},null,2));
  await writeFile(path.join(projectRoot,'src','Demo.tsx'),"import { useEffect, useState } from 'react'; export const Demo=()=>{ const [x,setX]=useState(0); useEffect(()=>setX(1),[]); return x; };\n");
  const house=createToolHouse({root});
  const out=await house.runTool({key:'find-hooks',options:{},context:{rab_home:path.join(temp,'.rab'),project:{id:'demo',name:'demo',root:projectRoot}}});
  assert.equal(out.result.total,2);
  assert.equal(out.tasks.length,2);
  const parent=out.tasks.find(x=>x.parentTaskId===null), child=out.tasks.find(x=>x.parentTaskId===parent.id);
  assert.equal(parent.tool.address,'find-hooks');
  assert.equal(parent.tool.path,'react/find/hooks');
  assert.equal(child.tool.address,'determine-script-type');
  assert.equal(child.tool.path,'base/determine/script-type');
  assert.equal(child.auto,true);
  assert.equal(child.reason,'fill:script_extensions');
  assert.deepEqual(parent.options.script_extensions,['tsx']);
});

test('diagnostics expose typed holes and separate project language teaching changes Tool resolution',async t=>{
  const temp=await mkdtemp(path.join(os.tmpdir(),'rab-v085-turn-')); t.after(()=>rm(temp,{recursive:true,force:true}));
  const workbench=createWorkbench({root,rabHome:path.join(temp,'.rab')});
  const before=await workbench.turnCheck({text:'find fuck-off hooks'});
  const frame=before.frames[0];
  assert.equal(frame.failure_boundary.blocker_type,'typed-unknown');
  assert.equal(frame.failure_boundary.type,'predicate');
  assert.equal(frame.shape5.executable,false);
  assert.equal(frame.shape5.resolved.address,'find-hooks');

  const taught=await workbench.teachLanguage({check_id:before.check_id,text:before.input,token:'fuck-off',sense:'state',scope:'project-only'});
  assert.equal(taught.status,'taught-and-rechecked');
  assert.equal(taught.check.check_id,before.check_id);
  assert.equal(taught.check.frames[0].shape3.seats.predicate,'state');
  assert.equal(taught.check.frames[0].failure_boundary,null);
  assert.equal(taught.check.frames[0].shape5.resolved.address,'find-state-hooks');
  assert.equal(taught.receipt.raw_input,before.input);
  assert.equal(taught.receipt.scope,'project-only');
  assert.equal(taught.receipt.applied,true);
  assert.ok(taught.receipt.before.frames[0].blockers.length>0);
  assert.equal(taught.receipt.after.frames[0].blockers.length,0);
  assert.equal(taught.receipt.regression_cases[0].input,before.input);
});

test('project-only training survives a fresh Workbench instance and new session',async t=>{
  const temp=await mkdtemp(path.join(os.tmpdir(),'rab-v085-training-cold-')); t.after(()=>rm(temp,{recursive:true,force:true}));
  const rabHome=path.join(temp,'.rab');
  let workbench=createWorkbench({root,rabHome});
  let session=await workbench.sessionNew({name:'Test session'});
  let out=await workbench.sessionTurn({session_id:session.session_id,text:'find coldword hooks'});
  assert.equal(out.current_steps[0].status,'language-gap');
  const check=await workbench.turnCheck({text:'find coldword hooks'});
  const taught=await workbench.teachLanguage({session_id:session.session_id,check_id:check.check_id,text:check.input,token:'coldword',sense:'state',scope:'project-only'});
  assert.equal(taught.status,'taught-and-rechecked');
  workbench=createWorkbench({root,rabHome});
  session=await workbench.sessionNew({name:'Test session'});
  out=await workbench.sessionTurn({session_id:session.session_id,text:'find coldword hooks'});
  assert.equal(out.current_steps[0].status,'ready');
  assert.equal(out.current_steps[0].capability.name,'find-state-hooks');
  assert.equal(out.current_steps[0].frame.seats.predicate,'state');
});

test('grid Stamps use local topology data, leave future area seats, and refuse overwrite',async t=>{
  const temp=await mkdtemp(path.join(os.tmpdir(),'rab-v085-grid-')); t.after(()=>rm(temp,{recursive:true,force:true}));
  const house=createToolHouse({root});
  const context={rab_home:path.join(temp,'.rab')};
  const made=await house.runTool({key:'add-grid',options:{location:temp,name:'dashboard-grid',layout:'holy-grail',gap:'section'},context});
  assert.equal(made.result.layout,'holy-grail');
  const html=await import('node:fs/promises').then(({readFile})=>readFile(made.result.file,'utf8'));
  assert.match(html,/data-grid="holy-grail"/);
  for(const area of ['header','left','main','right','footer']){ assert.match(html,new RegExp(`data-rab-seat=\"area-${area}:a1\"`)); assert.match(html,new RegExp(`\\[rab-seat:area-${area}:a1\\]`)); }
  await assert.rejects(house.runTool({key:'add-grid',options:{location:temp,name:'dashboard-grid',layout:'shell'},context}),error=>error?.code==='EEXIST');
});

test('grid CSS resolves css_path through settings try and generic CSS import stays relative/idempotent',async t=>{
  const temp=await mkdtemp(path.join(os.tmpdir(),'rab-v085-grid-css-')); t.after(()=>rm(temp,{recursive:true,force:true}));
  const projectRoot=path.join(temp,'project'); const cssDir=path.join(projectRoot,'src','css'); await mkdir(cssDir,{recursive:true});
  await writeFile(path.join(projectRoot,'settings.json'),JSON.stringify({id:'demo-grid',name:'demo-grid',type:'html'},null,2));
  const entry=path.join(projectRoot,'src','app.css'); await writeFile(entry,'@layer app {}\n');
  const house=createToolHouse({root});
  const install=await house.runTool({key:'grid-css',options:{},context:{rab_home:path.join(temp,'.rab'),project:{id:'demo-grid',name:'demo-grid',root:projectRoot}}});
  assert.equal(install.result.status,'created');
  assert.equal(path.basename(install.result.file),'grid.css');
  const child=install.tasks.find(x=>x.reason==='fill:css_path');
  assert.equal(child.tool.address,'find-folder');
  assert.equal(child.tool.path,'base/find/folder');
  const css=await import('node:fs/promises').then(({readFile})=>readFile(install.result.file,'utf8'));
  assert.match(css,/\[data-grid='holy-grail'\]/);
  assert.match(css,/\.scroll \{ overflow: auto; \}/);

  const context={rab_home:path.join(temp,'.rab')};
  const imported=await house.runTool({key:'import-css',options:{file:install.result.file,entry},context});
  assert.equal(imported.result.status,'imported');
  assert.equal(imported.result.import,"@import './css/grid.css';");
  const again=await house.runTool({key:'import-css',options:{file:install.result.file,entry},context});
  assert.equal(again.result.status,'already-imported');
  const text=await import('node:fs/promises').then(({readFile})=>readFile(entry,'utf8'));
  assert.equal(text.match(/grid\.css/g)?.length,1);
});

test('normal Chat planning resolves current Tool House capabilities, not only Turn Checker',async t=>{
  const temp=await mkdtemp(path.join(os.tmpdir(),'rab-v085-chat-tools-')); t.after(()=>rm(temp,{recursive:true,force:true}));
  const workbench=createWorkbench({root,rabHome:path.join(temp,'.rab')});
  const session=await workbench.sessionNew({name:'Test session'});
  const out=await workbench.sessionTurn({session_id:session.session_id,text:'find hooks'});
  const step=out.current_steps[0];
  assert.equal(step.status,'ready');
  assert.equal(step.capability.kind,'house-tool');
  assert.equal(step.capability.name,'find-hooks');
  assert.equal(step.capability.house.path,'react/find/hooks');
  assert.equal(step.options.script_extensions.status,'auto-resolver');
  const executed=await workbench.sessionExecute({session_id:session.session_id,confirm:true});
  const done=executed.steps.find(x=>x.id===step.id);
  assert.equal(done.status,'completed');
  assert.equal(done.receipt.steps[0].capability,'find-hooks');
  assert.ok(Number.isSafeInteger(session.session_id)&&session.session_id>0);
  assert.ok(Number.isSafeInteger(step.id)&&step.id>0);
  const tasks=done.receipt.steps[0].tasks;
  const parent=tasks.find(x=>x.parentTaskId===null);
  assert.ok(Number.isSafeInteger(parent.id)&&parent.id>0);
  assert.ok(tasks.some(x=>x.requested==='determine-script-type'&&x.parentTaskId===parent.id));
});

test('explicit project language teaching can repair the matching live Chat Step in place',async t=>{
  const temp=await mkdtemp(path.join(os.tmpdir(),'rab-v085-live-repair-')); t.after(()=>rm(temp,{recursive:true,force:true}));
  const workbench=createWorkbench({root,rabHome:path.join(temp,'.rab')});
  const session=await workbench.sessionNew({name:'Test session'});
  const before=await workbench.sessionTurn({session_id:session.session_id,text:'find fuck-off hooks'});
  const stepId=before.current_steps[0].id;
  assert.equal(before.current_steps[0].status,'language-gap');
  assert.equal(before.current_steps[0].gaps.language[0].gap_type,'typed-unknown');

  const check=await workbench.turnCheck({text:'find fuck-off hooks'});
  const taught=await workbench.teachLanguage({session_id:session.session_id,check_id:check.check_id,text:check.input,token:'fuck-off',sense:'state',scope:'project-only'});
  assert.equal(taught.session_repair.step_id,stepId);
  assert.equal(taught.session_repair.status,'ready');
  assert.equal(taught.session_repair.capability.name,'find-state-hooks');

  const after=await workbench.sessionRead(session.session_id);
  const step=after.steps.find(x=>x.id===stepId);
  assert.equal(step.id,stepId);
  assert.equal(step.frame.seats.predicate,'state');
  assert.equal(step.parseHistory.length,1);
  assert.equal(step.parseHistory[0].frame.seats.predicate.value,'fuck-off');
  assert.equal(step.training.at(-1).status_before,'language-gap');
  assert.equal(step.training.at(-1).status_after,'ready');
  assert.equal(after.turns.at(-1).mode,'training-correction');
  assert.equal(after.turns.at(-1).continuesStepId,stepId);
});

test('runner-owned seat bag chains values across ordinary Tools and search Tools without Stamp-specific wiring',async t=>{
  const temp=await mkdtemp(path.join(os.tmpdir(),'rab-v085-seat-chain-')); t.after(()=>rm(temp,{recursive:true,force:true}));
  const projectRoot=path.join(temp,'project'); await mkdir(path.join(projectRoot,'src'),{recursive:true});
  await writeFile(path.join(projectRoot,'settings.json'),JSON.stringify({id:'chain-demo',name:'chain-demo',type:'react'},null,2));
  await writeFile(path.join(projectRoot,'src','Demo.tsx'),"import { useEffect, useState } from 'react'; export const Demo=()=>{ const [x,setX]=useState(0); useEffect(()=>setX(1),[]); return x; };\n");
  const house=createToolHouse({root});
  const context={rab_home:path.join(temp,'.rab'),project:{id:'chain-demo',name:'chain-demo',root:projectRoot}};

  const first=await house.runTool({key:'find-hooks',options:{},context});
  assert.deepEqual(first.seats.script_extensions,['tsx']);
  assert.equal(first.tasks.length,2);
  assert.equal(first.tasks[1].reason,'fill:script_extensions');

  const second=await house.runTool({key:'find-hooks',options:{},context:{...context,bag:{seats:first.seats}}});
  assert.deepEqual(second.options.script_extensions,['tsx']);
  assert.equal(second.tasks.length,1,'inherited named seat should prevent another resolver child');
  assert.equal(second.result.total,2);
});

test('Box-owned PROJECT.json path memory fills matching Tool seats before settings try rediscovery',async t=>{
  const temp=await mkdtemp(path.join(os.tmpdir(),'rab-v085-project-path-seat-')); t.after(()=>rm(temp,{recursive:true,force:true}));
  const projectRoot=path.join(temp,'project'); const cssDir=path.join(projectRoot,'src','css'); await mkdir(cssDir,{recursive:true});
  await writeFile(path.join(projectRoot,'settings.json'),JSON.stringify({id:'memory-demo',name:'memory-demo',type:'html'},null,2));
  const context={rab_home:path.join(temp,'.rab'),project:{id:'memory-demo',name:'memory-demo',root:projectRoot}};
  const house=createToolHouse({root});
  await house.runTool({key:'add-project-path',options:{name:'css_path',path:'src/css'},context});
  const out=await house.runTool({key:'grid-css',options:{name:'css'},context});
  assert.equal(out.tasks.length,1,'saved PROJECT.json path should prevent a find-folder child');
  assert.equal(out.options.css_path,cssDir);
  assert.equal(out.tasks[0].seat_delta.css_path.source,'project-path:css_path');
  assert.equal(out.tasks[0].seat_delta.css_path.stored,'src/css');
  assert.equal(out.result.file,path.join(cssDir,'grid.css'));
});

test('Stamp can invoke a Stamp child through the same runner trace',async t=>{
  const temp=await mkdtemp(path.join(os.tmpdir(),'rab-v085-tool-stamp-chain-')); t.after(()=>rm(temp,{recursive:true,force:true}));
  const parent=path.join(temp,'projects'); await mkdir(parent,{recursive:true});
  const house=createToolHouse({root});
  const out=await house.runTool({key:'base/stamp-new-project',options:{type:'html',name:'chain-site',folder:parent},context:{rab_home:path.join(temp,'.rab')}});
  assert.equal(out.tasks.length,2);
  const parentTask=out.tasks.find(x=>x.parentTaskId===null);
  const childTask=out.tasks.find(x=>x.parentTaskId===parentTask.id);
  assert.equal(parentTask.tool.kind,'stamp');
  assert.equal(childTask.tool.kind,'stamp');
  assert.equal(childTask.reason,'child-of:base/stamp-new-project');
  assert.equal(out.result.child.result.project.name,'chain-site');
});

test('Turn Checker recovery reports missing seat and lawful positive fills without storing negative vocabulary',async t=>{
  const temp=await mkdtemp(path.join(os.tmpdir(),'rab-v085-recovery-')); t.after(()=>rm(temp,{recursive:true,force:true}));
  const workbench=createWorkbench({root,rabHome:path.join(temp,'.rab')});
  const check=await workbench.turnCheck({text:'hack a new component named "do-it"'});
  const frame=check.frames[0];
  assert.equal(frame.recovery.missing_seat,'operation');
  assert.equal(frame.recovery.known_seats.target_type,'component');
  assert.ok(frame.recovery.legal_fills.includes('create'));
  assert.ok(frame.recovery.actions.includes('rephrase'));
  assert.ok(frame.recovery.actions.includes('define-token'));
  assert.ok(frame.recovery.actions.includes('rephrase'));
  assert.equal(frame.recovery.question.version,'question-contract/v0.8.5');
});
