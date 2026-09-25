import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRabMemory } from '../../bridge/rab-memory.mjs';

test('saved project settings own paths while source settings remain unchanged', async t => {
  const parent=path.join(os.homedir(),'.rab','temp','test');
  await mkdir(parent,{recursive:true});
  const temp=await mkdtemp(path.join(parent,'saved-paths-'));
  t.after(async()=>{
    assert.equal(path.dirname(temp),parent);
    assert.ok(path.basename(temp).startsWith('saved-paths-'));
    await rm(temp,{recursive:true,force:true});
  });
  const source=path.join(temp,'source'),rabHome=path.join(temp,'memory');
  await mkdir(source);
  const sourceSettings={name:'Fixture',title:'Fixture',description:'',type:'react',paths:{components:'src/components'}};
  await writeFile(path.join(source,'settings.json'),JSON.stringify(sourceSettings));
  const memory=createRabMemory({rabHome});
  const id=await memory.registerProject({name:'Fixture',root:source});
  const project={id,name:'Fixture',root:source};
  assert.equal((await memory.readProjectSettings(project)).paths.components,'src/components');
  const prior=(await memory.readProjectSettings(project)).paths.components;
  const saved=await memory.setProjectPath(project,'components','src/ui',{description:'Shared components',types:['tsx'],expected:prior});
  assert.equal(saved.value,'src/ui');
  assert.equal(saved.description,'Shared components');
  assert.equal((await memory.getProjectPath(project,'components')).value,'src/ui');
  assert.equal((await memory.openProject(project)).projectSettings.paths.components.path,'src/ui');
  const inspection=await memory.inspectProject(id);
  assert.equal(inspection.settings_path,path.join(memory.paths(project).project,'settings.json'));
  assert.equal(inspection.source_settings_path,path.join(source,'settings.json'));
  assert.equal(inspection.project.paths.components.path,'src/ui');
  assert.deepEqual(JSON.parse(await readFile(path.join(source,'settings.json'),'utf8')),sourceSettings);
  await assert.rejects(memory.setProjectPath(project,'components','stale',{expected:prior}),{code:'STALE_REVISION'});
  assert.deepEqual(await memory.removeProjectPath(project,'components'),{removed:true});
  assert.equal(await memory.getProjectPath(project,'components'),null);
});

test('opening an unregistered project registers its saved descriptor before reading', async t => {
  const parent=path.join(os.homedir(),'.rab','temp','test');
  await mkdir(parent,{recursive:true});
  const temp=await mkdtemp(path.join(parent,'unregistered-paths-'));
  t.after(async()=>{
    assert.equal(path.dirname(temp),parent);
    assert.ok(path.basename(temp).startsWith('unregistered-paths-'));
    await rm(temp,{recursive:true,force:true});
  });
  const source=path.join(temp,'source');
  await mkdir(source);
  await writeFile(path.join(source,'settings.json'),JSON.stringify({name:'New project',type:'react',paths:{pages:'src/pages'}}));
  const memory=createRabMemory({rabHome:path.join(temp,'memory')});
  const opened=await memory.openProject({name:'New project',root:source});
  assert.equal(opened.projectSettings.paths.pages,'src/pages');
  assert.equal((await memory.readProjectSettings({name:'New project',root:source})).id,Number(opened.key));
});

test('saved audit folder permits an absolute source path outside memory', async t => {
  const parent=path.join(os.homedir(),'.rab','temp','test');
  await mkdir(parent,{recursive:true});
  const temp=await mkdtemp(path.join(parent,'audit-paths-'));
  t.after(async()=>{
    assert.equal(path.dirname(temp),parent);
    assert.ok(path.basename(temp).startsWith('audit-paths-'));
    await rm(temp,{recursive:true,force:true});
  });
  const source=path.join(temp,'source'),target=path.join(temp,'target');
  await mkdir(source);await mkdir(target);
  await writeFile(path.join(source,'settings.json'),JSON.stringify({name:'Audit fixture',type:'audit',paths:{folder:target}}));
  const memory=createRabMemory({rabHome:path.join(temp,'memory')});
  const project={name:'Audit fixture',root:source};
  assert.equal(await memory.requireAuditFolder(project),target);
  await memory.setProjectPath(project,'folder',target,{description:'Audit target'});
  assert.equal(await memory.requireAuditFolder(project),target);
});
