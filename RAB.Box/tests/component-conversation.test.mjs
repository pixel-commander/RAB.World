import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdir, mkdtemp, readFile, writeFile, cp, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRabMemory } from '../bridge/rab-memory.mjs';
import { createSessionPlanner } from '../bridge/session-planner.mjs';
import { makeItemSettings } from '../bridge/rab-node.mjs';

const box=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const toolkit=path.join(path.dirname(box),'RAB.Toolkits/react');
const put=(file,value)=>writeFile(file,JSON.stringify(value,null,2)+'\n');
const json=file=>readFile(file,'utf8').then(JSON.parse);
const digest=async file=>createHash('sha256').update(await readFile(file)).digest('hex');
const pending=state=>state.current_steps.find(step=>step.status!=='completed');
const question=state=>[...(pending(state)?.gaps.configuration??[]),...(pending(state)?.gaps.requiredInputs??[])][0];
const detail=state=>JSON.stringify(state.current_steps.map(step=>({id:step.id,status:step.status,key:step.capability?.house?.key,gaps:step.gaps,options:step.options})));

const fixture=async()=>{
  const parent=path.join(os.homedir(),'.rab/temp/test');await mkdir(parent,{recursive:true});
  const temp=await mkdtemp(path.join(parent,'component-conversation-'));
  const source=path.join(temp,'source'),catalog=path.join(temp,'catalog'),rabHome=path.join(temp,'memory');
  const paths={components:'src/components','container-atoms':'src/container-atoms','action-atoms':'src/action-atoms'};
  for(const relative of Object.values(paths))await mkdir(path.join(source,relative),{recursive:true});
  const memory=createRabMemory({rabHome});
  const project={id:await memory.allocateId(),name:'Component conversation fixture',root:source};
  await put(path.join(source,'settings.json'),{id:project.id,name:project.name,type:'react',paths});
  await put(path.join(source,'PATHS.json'),{project:{id:project.id,name:project.name},tools:{},stamps:{},catalogs:{}});
  await memory.registerProject(project);
  const nav=path.join(source,'src/components/SiteNav');await mkdir(nav,{recursive:true});
  await put(path.join(nav,'settings.json'),makeItemSettings({id:await memory.allocateId(),name:'SiteNav',title:'Site Navigation',description:'Fixture existing component',settings:[],meta:{kind:'component'},type:'component'}));
  const navFile=path.join(nav,'SiteNav.tsx');
  await writeFile(navFile,'export function SiteNav() { return <nav data-area="nav">Navigation</nav>; }\n');
  for(const key of ['react/add/new/component','react/css/add/new/container-atom','react/css/add/new/action-atom']){
    const from=path.join(toolkit,'tools',key),to=path.join(catalog,'tools',key);await mkdir(to,{recursive:true});
    await cp(path.join(from,'settings.json'),path.join(to,'settings.json'));
    await cp(path.join(from,'template'),path.join(to,'template'),{recursive:true});
    const owner=key.includes('/css/')?path.join(toolkit,'tools/react/css/add/new/new.mjs'):path.join(from,'component.mjs');
    await writeFile(path.join(to,path.basename(key)+'.mjs'),'export {run} from '+JSON.stringify(pathToFileURL(owner).href)+';\n');
  }
  for(const key of ['react/insert/component-into-area','react/add/element']){
    const to=path.join(catalog,'tools',key);await mkdir(to,{recursive:true});
    await cp(path.join(box,'tools',key,'settings.json'),path.join(to,'settings.json'));
    const owner=key.endsWith('/element')?'react/add/add.mjs':key+'/component-into-area.mjs';
    await writeFile(path.join(to,path.basename(key)+'.mjs'),'export {run} from '+JSON.stringify(pathToFileURL(path.join(box,'tools',owner)).href)+';\n');
  }
  await cp(path.join(box,'language'),path.join(catalog,'language'),{recursive:true});
  const newPlanner=()=>createSessionPlanner({root:catalog,projectRoot:source,project:{...project,manifest:{project:{name:project.name}}},languageRoot:path.join(catalog,'language'),rabHome});
  const planner=await newPlanner();
  const save=async state=>{await put(path.join(temp,'latest-session.json'),state);return state;};
  return {temp,source,catalog,memory,planner,newPlanner,navFile,save};
};

const answerText=async(f,planner,sessionId,text)=>f.save(await planner.turn({sessionId,text}));

test('component dialogue creates its atom, resumes at population, and executes both requested edits on the new component',async()=>{
  const f=await fixture();let planner=f.planner;
  let state=await planner.newSession();const sessionId=state.session_id;
  state=await answerText(f,planner,sessionId,'add component');
  assert.equal(pending(state).capability.house.key,'react/add/new/component',detail(state));
  assert.equal(question(state).field,'name');
  const componentStepId=pending(state).id;
  state=await answerText(f,planner,sessionId,'PageShell');assert.equal(question(state).field,'grid',detail(state));
  state=await answerText(f,planner,sessionId,'header-main');assert.equal(question(state).field,'class_name',detail(state));
  state=await answerText(f,planner,sessionId,'container-main');assert.equal(question(state).field,'atom:container-main:create',detail(state));
  assert.match(question(state).question,/not found/);
  state=await answerText(f,planner,sessionId,'yes');assert.equal(question(state).field,'atom:container-main:kind',detail(state));
  assert.deepEqual(question(state).enum.sort(),['action-atom','container-atom']);
  state=await answerText(f,planner,sessionId,'container-atom');assert.equal(state.ready_to_confirm,true,detail(state));
  await assert.rejects(access(path.join(f.source,'src/components/PageShell')),{code:'ENOENT'});
  await assert.rejects(access(path.join(f.source,'src/container-atoms/container-main')),{code:'ENOENT'});
  state=await f.save(await planner.execute({sessionId,confirm:true}));
  const componentStep=state.steps.find(step=>step.id===componentStepId),receiptId=componentStep.receipt.id;
  assert.equal(componentStep.status,'completed');
  const component=componentStep.receipt.steps.at(-1).result;
  assert.equal(component.settings.class,'container-main');
  assert.equal((await json(path.join(f.source,'src/container-atoms/container-main/settings.json'))).kind,'container-atom');
  for(const entry of component.verification.files)assert.equal(await digest(entry.path),entry.sha256);
  assert.equal(question(state).kind,'component-populate',detail(state));
  const originalComponent=await readFile(component.file,'utf8'),originalNav=await readFile(f.navFile,'utf8');
  assert.match(originalComponent,/data-area="header"/);assert.match(originalComponent,/data-area="main"/);
  // A new planner instance resumes the saved question; it must not restamp.
  planner=await f.newPlanner();state=await planner.resume(sessionId);
  assert.equal(question(state).kind,'component-populate');
  assert.equal(state.steps.find(step=>step.id===componentStepId).receipt.id,receiptId);
  assert.equal(await readFile(component.file,'utf8'),originalComponent);
  state=await answerText(f,planner,sessionId,'yes');
  assert.equal(state.bag.populationTarget.file,component.file);
  assert.match(state.last_turn.reply,/What would you like to add/);
  state=await answerText(f,planner,sessionId,'add SiteNav to header and add a div with class container-main to data-area main');
  assert.equal(state.ready_to_confirm,true,detail(state));
  assert.equal(state.current_steps.length,2,detail(state));
  const [insert,element]=state.current_steps;
  assert.equal(insert.capability.house.key,'react/insert/component-into-area');
  assert.equal(insert.options.component.value,'SiteNav');assert.equal(insert.options.area.value,'header');
  assert.equal(element.capability.house.key,'react/add/element');
  assert.equal(element.options.class_name.value,'container-main');assert.equal(element.options.data_area.value,'main');
  assert.equal(insert.options.file.value,component.file);assert.equal(element.options.file.value,component.file);
  assert.equal(element.options.component.value,'PageShell');
  state=await f.save(await planner.execute({sessionId,confirm:true}));
  assert.ok(state.current_steps.every(step=>step.status==='completed'),detail(state));
  const populated=await readFile(component.file,'utf8');
  assert.match(populated,/import \{ SiteNav \} from ['"]\.\.\/SiteNav\/SiteNav['"]/);
  assert.match(populated,/data-area="header"[^>]*>\s*<SiteNav\b/);
  assert.match(populated,/data-area="main"[^>]*>\s*<div[^>]*className="container-main"/);
  assert.equal(await readFile(f.navFile,'utf8'),originalNav);
  assert.equal(state.steps.filter(step=>step.capability?.house?.key==='react/add/new/component').length,1);
  assert.equal(state.steps.find(step=>step.id===componentStepId).receipt.id,receiptId);
  const after=await planner.execute({sessionId,confirm:true});
  assert.equal(await readFile(component.file,'utf8'),populated);assert.equal(after.current_steps.length,2);
});

test('declining a missing atom leaves class undefined and declining population finishes without another write',async()=>{
  const f=await fixture();let state=await f.planner.newSession();const sessionId=state.session_id;
  for(const text of ['add component','BareCard','none','container-missing'])state=await answerText(f,f.planner,sessionId,text);
  assert.equal(question(state).field,'atom:container-missing:create',detail(state));
  state=await answerText(f,f.planner,sessionId,'no');assert.equal(state.ready_to_confirm,true,detail(state));
  state=await f.save(await f.planner.execute({sessionId,confirm:true}));
  const component=state.current_steps[0].receipt.steps.at(-1).result;
  assert.equal(Object.hasOwn(component.settings,'class'),false);
  const content=await readFile(component.file,'utf8');
  assert.equal(content.includes('container-missing'),false);assert.equal(content.includes('undefined'),false);
  await assert.rejects(access(path.join(f.source,'src/container-atoms/container-missing')),{code:'ENOENT'});
  state=await answerText(f,f.planner,sessionId,'no');
  assert.equal(state.bag.populationTarget,null);assert.equal(state.current_group.status,'completed');
  const resumed=await f.newPlanner();state=await resumed.resume(sessionId);
  assert.equal(state.ready_to_confirm,false);
  await resumed.execute({sessionId,confirm:true});assert.equal(await readFile(component.file,'utf8'),content);
});

test('structured field, atom, and population answers use the same saved continuation',async()=>{
  const f=await fixture();let state=await f.planner.newSession();const sessionId=state.session_id;
  state=await answerText(f,f.planner,sessionId,'add component');const stepId=pending(state).id;
  const answer=async values=>f.save(await f.planner.answer({sessionId,answers:[{step_id:stepId,values}]}));
  state=await answer({name:'ActionCard',grid:'header-main',class_name:'action-main'});
  assert.equal(question(state).field,'atom:action-main:create',detail(state));
  state=await answer({'atom:action-main:create':true});assert.equal(question(state).field,'atom:action-main:kind',detail(state));
  state=await answer({'atom:action-main:kind':'action-atom'});assert.equal(state.ready_to_confirm,true,detail(state));
  state=await f.save(await f.planner.execute({sessionId,confirm:true}));
  assert.equal((await json(path.join(f.source,'src/action-atoms/action-main/settings.json'))).kind,'action-atom');
  const component=state.steps.find(step=>step.id===stepId).receipt.steps.at(-1).result;
  const content=await readFile(component.file,'utf8');
  assert.equal(component.settings.class,'action-main');
  const populationId=pending(state).id;
  state=await f.save(await f.planner.answer({sessionId,answers:[{step_id:populationId,values:{populate:false}}]}));
  assert.equal(state.current_group.status,'completed');assert.equal(state.bag.populationTarget,null);
  await f.planner.execute({sessionId,confirm:true});assert.equal(await readFile(component.file,'utf8'),content);
});
