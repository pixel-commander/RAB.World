import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm, readFile, lstat, realpath, mkdir, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createWorkbench } from '../bridge/service.mjs';
import { createSeatParser } from '../bridge/seat-parser.mjs';
import { resolveProjectIntent } from '../bridge/project-intent.mjs';
import { createRabMemory } from '../bridge/rab-memory.mjs';
import { createToolHouse } from '../bridge/tool-house.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const fixture = async (t,{memoryFolder='.rab'}={}) => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'rab-project-wiring-'));
  t.after(async () => {
    assert.equal(path.dirname(path.resolve(temp)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(temp).startsWith('rab-project-wiring-'));
    await rm(temp, { recursive: true, force: true });
  });
  const rabHome=path.join(temp,memoryFolder);
  const workbench = createWorkbench({ root, rabHome });
  let current = await workbench.sessionNew({name:'Test session'});
  const turn = async text => { current = await workbench.sessionTurn({ session_id: current.session_id, text }); return current; };
  return { temp, rabHome, workbench, turn, current: () => current };
};

test('project intent uses parsed meanings and guards questions, history, negation and other targets', async () => {
  const parser = await createSeatParser({ languageRoot: path.join(root, 'language') });
  const action = text => resolveProjectIntent({ parse: parser.parse(text), supplied: false }).projectIntent?.action;
  for (const text of ['start a new project','I want to start a new project','new project','please begin a new project','can you create a new project','I would like to start a project']) assert.equal(action(text), 'create', text);
  assert.equal(action('list projects'), 'list');
  assert.equal(action('load project deez-nuts'), 'load');
  assert.equal(action('do not start a new project'), 'declined');
  assert.equal(action('how do I start a new project'), 'clarify');
  assert.equal(action('I started a new project'), 'clarify');
  assert.equal(action('create a component in a new project'), undefined);
  assert.equal(action('audit a project'), undefined);
  assert.equal(action('create a react project named Test'), undefined);
  assert.equal(resolveProjectIntent({ parse: parser.parse('new project'), supplied: false }).supplied, false);
});

test('new React project asks about the UI kit before confirmation, then creates without it', async t => {
  const f = await fixture(t), original = f.current().session_id;
  const parent = path.join(f.temp, 'projects');
  await import('node:fs/promises').then(({mkdir})=>mkdir(parent,{recursive:true}));
  let result = await f.turn('I want to start a new project');
  assert.match(result.last_turn.reply, /kind of project/i);
  const stepId = result.last_turn.stepIds[0];
  result = await f.turn('react');
  assert.equal(result.current_steps[0].options.type.value, 'react');
  result = await f.turn('deez-nuts');
  assert.equal(result.current_steps[0].options.name.value, 'deez-nuts');
  result = await f.turn(parent);
  assert.equal(result.last_turn.stepIds[0], stepId);
  assert.match(result.last_turn.reply, /Add a UI kit/i);
  result = await f.turn('no');
  assert.equal(result.current_steps[0].options.add_ui_kit.value,false);
  assert.match(result.last_turn.reply,/without a UI kit/i);
  result = await f.turn('yes');
  assert.notEqual(result.session_id, original);
  assert.equal(result.bag.project.name, 'deez-nuts');
  const expected = await realpath(path.join(parent,'deez-nuts'));
  assert.equal(result.bag.project.root, expected);
  const projectSettings = JSON.parse(await readFile(path.join(expected, 'settings.json'), 'utf8'));
  assert.equal(projectSettings.name, 'deez-nuts');
  const manifest = JSON.parse(await readFile(path.join(expected, 'PATHS.json'), 'utf8'));
  assert.equal(manifest.project.name, 'deez-nuts');
  const inspected = await f.workbench.inspect(result.session_id);
  assert.equal(inspected.project.name, 'deez-nuts');
  assert.equal(inspected.project_path, expected);
});

test('missing lookup lists only available names and retries the same step without starting creation', async t => {
  const f = await fixture(t), parent = path.join(f.temp, 'projects');
  await import('node:fs/promises').then(({mkdir})=>mkdir(parent,{recursive:true}));
  await f.turn('new project');
  await f.turn('react');
  let result=await f.turn('deez-nuts');
  assert.match(result.last_turn.reply, /parent folder/i);
  result = await f.turn(parent);
  assert.match(result.last_turn.reply,/Add a UI kit/i);
  result = await f.turn('no');
  assert.match(result.last_turn.reply, /Start it|Start this project/i);
  result = await f.turn('yes');
  const createdRun = result.session_id;
  assert.equal(result.bag.project.name, 'deez-nuts');
  result = await f.turn('list projects');
  assert.match(result.last_turn.reply, /deez-nuts/);
  assert.equal(result.last_turn.reply.split('\n').sort().join('\n'),['Mock project','deez-nuts'].sort().join('\n'));
  result = await f.turn('load project "Mock project"');
  assert.equal(typeof result.bag.project.id, 'number');
  assert.equal(result.bag.project.name, 'Mock project');
  const origin=result.session_id,originProject=result.rab.project;
  result=await f.turn('load project missing-name');
  assert.match(result.last_turn.reply,/No project found for “missing-name”/);
  assert.match(result.last_turn.reply,/These are the available projects:/);
  assert.deepEqual(result.last_turn.reply.split('\n').slice(2,-1).sort(),['Mock project','deez-nuts'].sort());
  assert.doesNotMatch(result.last_turn.reply,/Folder:|[A-Za-z]:\\|start a new|full folder path/i);
  const lookupStep=result.current_steps[0].id;
  assert.equal(result.current_steps[0].options.name.value,null);
  result=await f.turn('yes');
  assert.equal(result.current_steps[0].projectAction,'load');
  assert.equal(result.current_steps[0].id,lookupStep);
  assert.match(result.last_turn.reply,/No project found for “yes”/);
  result=await f.turn('list projects');
  assert.match(result.last_turn.reply,/available projects/);
  assert.equal(result.current_steps[0].id,lookupStep);
  result=await f.turn('load project another-missing-name');
  assert.match(result.last_turn.reply,/No project found for “another-missing-name”/);
  result = await f.turn('deez-nuts');
  assert.equal(result.session_id, createdRun);
  assert.match(result.switch_message, /Loaded “deez-nuts”/);
  assert.doesNotMatch(result.switch_message,/Folder:|[A-Za-z]:\\/);
  const saved=JSON.parse(await readFile(path.join(originProject,'sessions',String(origin),'state.json'),'utf8'));
  assert.equal(saved.steps.find(step=>step.id===lookupStep).status,'completed');
  assert.equal(saved.turns.at(-1).text,'deez-nuts');
});

test('an unresolved project lookup survives session restoration and accepts a new load command',async t=>{
  const f=await fixture(t);
  const missed=await f.turn('load project absent');
  const restored=createWorkbench({root,rabHome:f.rabHome});
  const loaded=await restored.sessionTurn({session_id:missed.session_id,text:'load project "Mock project"'});
  assert.equal(loaded.session_id,missed.session_id);
  assert.equal(loaded.current_steps[0].status,'completed');
  assert.equal(loaded.current_steps[0].id,missed.current_steps[0].id);
  assert.match(loaded.last_turn.reply,/Loaded “Mock project”/);
});

test('an explicit new-project request can replace a pending load retry',async t=>{
  const f=await fixture(t);
  const missed=await f.turn('load project absent');
  const created=await f.turn('Start a new audit project');
  assert.equal(created.steps.find(step=>step.id===missed.current_steps[0].id).status,'superseded');
  assert.equal(created.current_steps[0].projectAction,'create');
  assert.equal(created.current_steps[0].options.type.value,'audit');
  assert.match(created.last_turn.reply,/project name/i);
});

test('existing duplicate labels stay unresolved and allow another name without showing paths',async t=>{
  const f=await fixture(t),memory=createRabMemory({rabHome:f.rabHome});
  for(let index=0;index<2;index++){
    const id=await memory.allocateId(),project={id,name:'shared-name',root:path.join(memory.rabHome,'projects',String(id))};
    await mkdir(project.root,{recursive:true});
    await writeFile(path.join(project.root,'settings.json'),JSON.stringify({id,name:project.name,type:'react'}));
    await memory.openProject(project);
  }
  const original=f.current().session_id;
  let result=await f.turn('load project shared-name');
  assert.equal(result.session_id,original);
  assert.equal(result.current_steps[0].status,'input-required');
  assert.match(result.last_turn.reply,/More than one project matched/);
  assert.match(result.last_turn.reply,/available projects:\nshared-name\n/);
  assert.doesNotMatch(result.last_turn.reply,/[A-Za-z]:\\|Folder:/);
  const stepId=result.current_steps[0].id;
  result=await f.turn('Mock project');
  assert.equal(result.current_steps[0].id,stepId);
  assert.equal(result.current_steps[0].status,'completed');
  assert.match(result.last_turn.reply,/Loaded “Mock project”/);
});

test('cancellation and an existing destination do not create or overwrite projects', async t => {
  const f = await fixture(t), original = f.current().session_id;
  await f.turn('load project not-created');
  let result = await f.turn('no');
  assert.equal(result.session_id, original);
  assert.match(result.last_turn.reply, /Cancelled/);
  const parent = path.join(f.temp,'projects');
  await import('node:fs/promises').then(({mkdir})=>mkdir(path.join(parent,'protected'),{recursive:true}));
  await f.turn('new project');
  await f.turn('react');
  await f.turn('protected');
  await f.turn(parent);
  await f.turn('no');
  result = await f.turn('yes');
  assert.equal(result.session_id, original);
  assert.match(result.last_turn.reply, /not completed|exist/i);
});

test('yes to a UI kit confirms the choice, then an empty seed fails before project creation',async t=>{
  const f=await fixture(t),parent=path.join(f.temp,'projects');await mkdir(parent,{recursive:true});
  await f.turn('new project');await f.turn('react');await f.turn('kit-test');
  let result=await f.turn(parent);
  assert.match(result.last_turn.reply,/Add a UI kit/i);
  result=await f.turn('yes');
  assert.equal(result.current_steps[0].options.add_ui_kit.value,true);
  assert.match(result.last_turn.reply,/with a UI kit/i);
  result=await f.turn('yes');
  assert.match(result.last_turn.reply,/template is empty/i);
  await assert.rejects(lstat(path.join(parent,'kit-test')),{code:'ENOENT'});
  result=await f.turn('no');
  assert.equal(result.current_steps[0].options.add_ui_kit.value,false);
  assert.match(result.last_turn.reply,/without a UI kit/i);
});

test('Magic Box setup asks name and folder, stamps local settings, and restores its saved session', async t => {
  const f = await fixture(t), original = f.current().session_id;
  const name = 'session-notes', target = path.join(f.temp, name);
  let result = await f.turn('Start a new Magic Box project');
  assert.equal(result.current_steps[0].options.type.value, 'magic-box');
  assert.match(result.last_turn.reply, /project name/i);
  result = await f.turn(name);
  assert.match(result.last_turn.reply, /parent folder/i);
  result = await f.turn(f.temp);
  assert.match(result.last_turn.reply, /settings\.json/);
  assert.match(result.last_turn.reply, /Start it/i);
  await assert.rejects(lstat(target), { code: 'ENOENT' });

  result = await f.turn('yes');
  assert.notEqual(result.session_id, original);
  assert.equal(result.bag.project.name, name);
  assert.equal(result.bag.projectSettings.type, 'magic-box');
  assert.match(result.last_turn.reply, /What would you like to work on/);
  const settings = JSON.parse(await readFile(path.join(target, 'settings.json'), 'utf8'));
  assert.equal(settings.name, name);
  assert.equal(settings.type, 'magic-box');
  assert.deepEqual(settings.paths, { output: 'output', audit_results: 'audit-results' });
  for (const folder of Object.values(settings.paths)) assert.equal((await lstat(path.join(target, folder))).isDirectory(), true);
  const manifest = JSON.parse(await readFile(path.join(target, 'PATHS.json'), 'utf8'));
  assert.equal(manifest.project.id, settings.id);
  assert.equal(manifest.project.name, name);
  await assert.rejects(lstat(path.join(target, 'package.json')), { code: 'ENOENT' });
  const saved = JSON.parse(await readFile(path.join(result.rab.project, 'sessions', String(result.session_id), 'state.json'), 'utf8'));
  assert.equal(saved.bag.project.name, name);
  const restored = await f.workbench.sessionRead(result.session_id);
  assert.equal(restored.bag.project.id, settings.id);
  assert.equal((await f.workbench.inspect(result.session_id)).project.name, name);
});

const snapshot = async folder => {
  const entries=[];
  const walk=async(relative='')=>{
    for(const entry of (await readdir(path.join(folder,relative),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
      const name=path.join(relative,entry.name),file=path.join(folder,name),info=await lstat(file);
      entries.push({name,directory:entry.isDirectory(),mtime:info.mtimeMs,content:entry.isFile()?(await readFile(file)).toString('base64'):null});
      if(entry.isDirectory())await walk(name);
    }
  };
  await walk();return entries;
};

test('audit setup keeps settings, sessions and results in one .rab project and leaves the input untouched', async t => {
  const f=await fixture(t),target=path.join(f.temp,'source to audit');
  await mkdir(target);
  await writeFile(path.join(target,'Sample.tsx'),"import { useState } from 'react';\n// TODO: audit sample\nexport const Sample = () => { const [count] = useState(0); return <div>{count}</div>; };\n");
  const before=await snapshot(target),canonicalTarget=await realpath(target);
  let result=await f.turn('Start a new audit project');
  assert.equal(result.current_steps[0].options.type.value,'audit');
  assert.match(result.last_turn.reply,/project name/i);
  result=await f.turn('sample-review');
  assert.match(result.last_turn.reply,/Which folder should I audit/i);
  result=await f.turn(target);
  assert.match(result.last_turn.reply,/\.rab\/projects/);
  const memory=createRabMemory({rabHome:path.join(f.temp,'.rab')});
  assert.equal((await memory.listProjects()).items.filter(p=>p.name==='sample-review').length,0);
  result=await f.turn('yes');
  const sessionId=result.session_id,project=result.bag.project;
  assert.equal(project.name,'sample-review',result.last_turn.reply);
  assert.equal(project.root,result.rab.project);
  assert.equal(path.dirname(project.root),path.join(memory.rabHome,'projects'));
  assert.equal(result.bag.domain,'audit');
  assert.equal(result.bag.audit.scanRoot,canonicalTarget);
  assert.equal(result.bag.audit.workingRoot,path.join(project.root,'audit-results'));
  const settings=JSON.parse(await readFile(path.join(project.root,'settings.json'),'utf8'));
  assert.equal(settings.name,'sample-review');
  assert.deepEqual(settings.paths,{folder:canonicalTarget,results:'audit-results'});
  assert.equal(JSON.parse(await readFile(path.join(project.root,'PATHS.json'),'utf8')).project.id,settings.id);
  assert.equal((await memory.listProjects()).items.filter(p=>p.id===project.id).length,1);

  result=await f.turn('audit all state hooks');
  assert.equal(result.current_steps[0].status,'ready');
  assert.equal(result.current_steps[0].options.folder.value,canonicalTarget);
  result=await f.workbench.sessionExecute({session_id:sessionId,confirm:true});
  const reportStep=result.current_steps[0].receipt.steps[0];
  assert.ok(reportStep.result.matches.length>0);
  assert.equal(path.dirname(reportStep.result_file),path.join(project.root,'audit-results',String(sessionId)));
  const chatReport=JSON.parse(await readFile(reportStep.result_file,'utf8'));
  assert.equal(chatReport.options.folder,canonicalTarget);
  assert.deepEqual(chatReport.result,reportStep.result);
  assert.equal(chatReport.session_id,sessionId);

  const manual=await f.workbench.toolsRun({session_id:sessionId,tool:'audit/find/todos'});
  assert.equal(manual.options.folder,canonicalTarget);
  assert.equal(manual.result.rows.length,1);
  assert.equal(manual.result.rows[0].line,2);
  assert.equal(path.dirname(manual.result_file),path.join(project.root,'audit-results',String(sessionId)));
  assert.deepEqual(JSON.parse(await readFile(manual.result_file,'utf8')).result,manual.result);
  const composite=await f.workbench.toolsRun({session_id:sessionId,tool:'audit/inspect/theme'});
  assert.ok(composite.tasks.length>1);
  assert.equal((await readdir(path.join(project.root,'audit-results',String(sessionId)))).length,3);

  const restoredWorkbench=createWorkbench({root,rabHome:memory.rabHome});
  const restored=await restoredWorkbench.sessionRead(sessionId);
  assert.equal(restored.bag.project.root,project.root);
  assert.equal(restored.bag.audit.scanRoot,canonicalTarget);
  const fresh=await restoredWorkbench.sessionNew({session_id:sessionId,name:'Follow-up audit'});
  assert.equal(fresh.bag.audit.scanRoot,canonicalTarget);
  assert.equal(fresh.rab.project,project.root);
  const saved=JSON.parse(await readFile(path.join(project.root,'sessions',String(sessionId),'state.json'),'utf8'));
  assert.equal(saved.steps.at(-1).status,'completed');
  await memory.recordFailure(project,{message:'Test failure record'});
  assert.equal(memory.paths(project).failures,path.join(project.root,'failures'));
  assert.deepEqual(await snapshot(target),before);

  settings.paths.results=path.join('..','..','..','source to audit');
  await writeFile(path.join(project.root,'settings.json'),JSON.stringify(settings));
  await assert.rejects(restoredWorkbench.toolsRun({session_id:sessionId,tool:'audit/find/todos'}),{code:'INVALID_PATH'});
  assert.deepEqual(await snapshot(target),before);
});

test('audit setup cancels early, rejects invalid targets or .rab itself, and allows a corrected folder', async t => {
  const f=await fixture(t),original=f.current().session_id;
  await f.turn('Start a new audit project');
  let result=await f.turn('cancel');
  assert.match(result.last_turn.reply,/Cancelled/);
  assert.equal(result.current_steps[0].status,'cancelled');
  await f.turn('Start a new audit project');
  await f.turn('retry-review');
  const missing=path.join(f.temp,'does-not-exist');
  await f.turn(missing);
  result=await f.turn('yes');
  assert.equal(result.session_id,original);
  assert.match(result.last_turn.reply,/existing folder/);
  assert.equal(result.current_steps[0].options.folder.value,null);
  await assert.rejects(lstat(missing),{code:'ENOENT'});
  await f.turn(f.rabHome);
  result=await f.turn('yes');
  assert.match(result.last_turn.reply,/outside .rab storage/);
  const target=path.join(f.temp,'valid');await mkdir(target);
  await f.turn(target);
  result=await f.turn('yes');
  assert.equal(result.bag.project.name,'retry-review');
  assert.deepEqual(await readdir(target),[]);
});

test('parent-folder audit saves inside nested .rab while excluding it from scans', async t => {
  const f=await fixture(t,{memoryFolder:path.join('Users','Box','.rab')});
  const source=path.join(f.temp,'Sample.tsx');
  const content="import { useState } from 'react';\n// TODO: real source\nexport const Sample = () => { const [count] = useState(0); return <div>{count}</div>; };\n";
  await writeFile(source,content);
  await writeFile(path.join(f.rabHome,'memory-only.tsx'),"// TODO: excluded memory\nuseState(1);\n");
  await f.turn('Start a new audit project');
  await f.turn('parent-review');
  let result=await f.turn(f.temp);
  assert.match(result.last_turn.reply,/.rab is excluded/);
  result=await f.turn('yes');
  assert.equal(result.bag.project.name,'parent-review',result.last_turn.reply);
  assert.equal(result.bag.audit.scanRoot,await realpath(f.temp));
  assert.equal(result.bag.project.root,result.rab.project);
  const session_id=result.session_id;
  const todos=await f.workbench.toolsRun({session_id,tool:'audit/find/todos'});
  assert.deepEqual(todos.result.rows.map(row=>row.file),['Sample.tsx']);
  assert.equal(path.dirname(todos.result_file),path.join(result.rab.project,'audit-results',String(session_id)));
  assert.equal(JSON.parse(await readFile(todos.result_file,'utf8')).result.rows.length,1);
  const count=await f.workbench.toolsRun({session_id,tool:'audit/count/files'});
  assert.equal(count.result.count,1);
  const hooks=await f.workbench.toolsRun({session_id,tool:'react/find/hooks/state-hooks'});
  assert.deepEqual(hooks.result.matches.map(row=>row.file),['Sample.tsx']);
  assert.equal(await readFile(source,'utf8'),content);
  assert.deepEqual((await readdir(f.temp)).sort(),['Sample.tsx','Users']);
});

test('direct Audit Stamp preserves valid names and creates only a .rab project', async t => {
  const f=await fixture(t),target=path.join(f.temp,'direct');await mkdir(target);
  const house=createToolHouse({root}),name='Review one UI';
  const out=await house.runTool({key:'audit/stamp-new-project',options:{name,folder:target},context:{rab_home:path.join(f.temp,'.rab')}});
  assert.equal(out.result.project.name,name);
  assert.equal(out.result.project.root,out.result.box_memory);
  assert.equal(JSON.parse(await readFile(path.join(out.result.project.root,'settings.json'),'utf8')).name,name);
  assert.equal(JSON.parse(await readFile(path.join(out.result.project.root,'PATHS.json'),'utf8')).project.name,name);
  assert.deepEqual(await readdir(target),[]);
});

test('Windows drive root can be saved as the default audit folder without scanning the drive', {skip:process.platform!=='win32'}, async t => {
  const f=await fixture(t),drive=path.parse(await realpath(f.temp)).root;
  const house=createToolHouse({root});
  const out=await house.runTool({key:'audit/stamp-new-project',options:{name:'drive-review',folder:drive.toLowerCase()+'\\'},context:{rab_home:f.rabHome}});
  assert.equal(out.result.settings.paths.folder,await realpath(drive));
  const memory=createRabMemory({rabHome:f.rabHome});
  assert.equal(path.dirname(out.result.project.root),path.join(memory.rabHome,'projects'));
  const session=await memory.createSession(out.result.project);
  assert.equal(session.bag.audit.scanRoot,await realpath(drive));
  assert.equal((await memory.getProjectPath(out.result.project,'folder')).value,await realpath(drive));
});

test('project inspection reads current settings from disk and reports invalid or missing settings', async t => {
  const f=await fixture(t),source=path.join(f.temp,'source');await mkdir(source);
  await f.turn('Start a new audit project');await f.turn('live-settings');await f.turn(source);
  const session=await f.turn('yes'),file=path.join(session.bag.project.root,'settings.json');
  let inspected=await f.workbench.inspect(session.session_id);
  assert.equal(inspected.settings.name,'live-settings');
  assert.equal(inspected.settings_path,file);
  assert.equal(inspected.rab.project,session.rab.project);
  assert.equal(inspected.settings_error,null);
  const edited={...inspected.settings,name:'Updated on disk',defaults:{enabled:false,limit:0,label:''}};
  await writeFile(file,JSON.stringify(edited));
  inspected=await f.workbench.inspect(session.session_id);
  assert.deepEqual(inspected.settings,edited);
  assert.equal(session.bag.projectSettings.name,'live-settings');
  await writeFile(file,'invalid json');
  inspected=await f.workbench.inspect(session.session_id);
  assert.equal(inspected.settings,null);assert.ok(inspected.settings_error);
  await rm(file);
  inspected=await f.workbench.inspect(session.session_id);
  assert.equal(inspected.settings,null);assert.ok(inspected.settings_error);
});
