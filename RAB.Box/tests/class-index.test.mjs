import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { mkdtemp, realpath, mkdir, writeFile, readFile, readdir, rm, stat } from 'node:fs/promises';
import { findAssignedClasses, findDefinedClasses } from '../tools/audit/_engines/class-search.mjs';
import { createToolHouse } from '../bridge/tool-house.mjs';
import { createRabMemory } from '../bridge/rab-memory.mjs';
import { createWorkbench } from '../bridge/service.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
const counts=rows=>rows.reduce((out,row)=>{if(row.className)out.set(row.className,(out.get(row.className)??0)+1);return out;},new Map());
const fixture=async t=>{
  const temp=await realpath(await mkdtemp(path.join(os.tmpdir(),'rab-class-index-')));
  t.after(async()=>{
    assert.equal(path.dirname(temp),await realpath(os.tmpdir()));
    assert.ok(path.basename(temp).startsWith('rab-class-index-'));
    await rm(temp,{recursive:true,force:true});
  });
  const folder=path.join(temp,'source');await mkdir(folder);
  await writeFile(path.join(folder,'style.css'),'/* .fake {} */\n.panel.active { background: url(asset.png); opacity: .5; }\n.unused {}');
  await writeFile(path.join(folder,'page.html'),'<div class="panel\n active panel"></div>\n<span className={"other"} />');
  await writeFile(path.join(folder,'component.vue'),'<template><div class="panel">Hello</div></template>');
  await writeFile(path.join(folder,'dynamic.tsx'),'const C = () => <div className={`panel ${value} item-${id}`} />;');
  await writeFile(path.join(folder,'binary.bin'),Buffer.from([0,1,2,3]));
  await mkdir(path.join(folder,'nested','node_modules'),{recursive:true});
  await writeFile(path.join(folder,'nested','node_modules','skip.html'),'<b class="excluded"/>');
  return {temp,folder};
};

test('assignments split multiline whitespace, preserve exact tokens, and include class-prefixed attributes',()=>{
  const source='<div class="panel\n active\tpanel" classNames="secondary" data-class="ignore" />\n<div className={"button"} class=bare />';
  const rows=findAssignedClasses(source,'page.html');
  assert.deepEqual([...counts(rows)].sort(),[['active',1],['bare',1],['button',1],['panel',2],['secondary',1]]);
  assert.equal(rows.find(row=>row.className==='button').line,3);
  assert.ok(rows.every(row=>row.column>0&&row.text.length<=180));
});

test('templates retain complete static tokens and mark dynamic expressions without inventing partial names',()=>{
  const source='const C = () => <div className={`panel ${active ? "hot" : "cold"} item-${id} end`} />;\n<div className={clsx("maybe", active)} />';
  const rows=findAssignedClasses(source,'view.tsx',{javascript:true});
  assert.deepEqual([...counts(rows)].sort(),[['end',1],['panel',1]]);
  assert.equal(rows.filter(row=>row.kind==='dynamic-class-expression').length,2);
});

test('commented assignments and equality comparisons are excluded; DOM literals are searchable',()=>{
  const source='// className="lineComment"\n/* class="blockComment" */\n<!-- <div class="htmlComment"/> -->\nnode.className = "panel active";\nif (node.className === "not-an-assignment") {}';
  assert.deepEqual([...counts(findAssignedClasses(source,'app.js',{javascript:true}))].sort(),[['active',1],['panel',1]]);
});

test('CSS classes come from selectors, including nesting and escapes, not comments, URLs, strings or attribute values',()=>{
  const source='/* .fake {} */\n.panel:hover, .panel.active { background: url(asset.png); content: ".fake2 { }"; opacity: .5; }\n@media (min-width: 10px) { .nested { &.selected, :is(.one, .two) {} } }\n.\\32 xl\\:p-2[data-label=".not-a-class"] { color:red; }\n@supports selector(.condition) { .supported {} }';
  const rows=findDefinedClasses(source,'style.css');
  assert.deepEqual([...counts(rows)].sort(),[['2xl:p-2',1],['active',1],['nested',1],['one',1],['panel',2],['selected',1],['supported',1],['two',1]]);
  assert.equal(rows.find(row=>row.className==='panel').line,2);
});

test('long single-line inputs produce bounded evidence per occurrence',()=>{
  const source='<div class="'+ 'panel '.repeat(2000)+'"></div>';
  const rows=findAssignedClasses(source,'large.html');
  assert.equal(rows.length,2000);
  assert.ok(rows.every(row=>row.text.length<=180));
  assert.ok(Buffer.byteLength(JSON.stringify(rows))<700000);
});

test('runner returns a combined index, stable counts, file map and explicit unresolved evidence',async t=>{
  const {folder,temp}=await fixture(t),house=createToolHouse({root});
  const tool=await house.getTool('count-classes');
  assert.deepEqual(tool.settings.map(field=>field.name),['folder']);
  const out=await house.runTool({key:'count-classes',options:{folder},context:{rab_home:path.join(temp,'.rab')}}),result=out.result;
  assert.equal(result.unique,4);assert.equal(result.count,9);
  assert.deepEqual(result.totals,{definitions:3,usages:6,dynamic_assignments:1});
  assert.deepEqual(result.counts.map(row=>[row.name,row.definitions,row.usages]),[['panel',1,4],['active',1,1],['other',0,1],['unused',1,0]]);
  assert.deepEqual(result.counts[0].files,['component.vue','dynamic.tsx','page.html','style.css']);
  assert.equal(result.counts[0].locations.length,5);
  assert.deepEqual(result.skipped,[{file:'binary.bin',reason:'binary-or-non-utf8'}]);
  assert.ok(!result.counts.some(row=>row.name==='excluded'));
  assert.ok(!result.source_snapshot.files.some(row=>row.file.includes('node_modules/')));
  assert.equal(out.tasks.length,3);
});

test('prototype-like class names count as ordinary tokens',async t=>{
  const {folder,temp}=await fixture(t);
  await writeFile(path.join(folder,'names.html'),'<div class="constructor __proto__ toString constructor"/>');
  const house=createToolHouse({root}),result=(await house.runTool({key:'count-class-usage',options:{folder},context:{rab_home:path.join(temp,'.rab')}})).result;
  assert.equal(result.counts.find(row=>row.name==='constructor').count,2);
  assert.equal(result.counts.find(row=>row.name==='__proto__').count,1);
  assert.equal(result.counts.find(row=>row.name==='toString').count,1);
});

test('HTML template interpolation is unresolved, retaining only complete static class names',()=>{
  const source='<div class="panel ${state} size-${size}"></div><span class="{{color}} end"/><b class="<%= value %> final"/>';
  const rows=findAssignedClasses(source,'template.html');
  assert.deepEqual([...counts(rows)].sort(),[['end',1],['final',1],['panel',1]]);
  assert.equal(rows.filter(row=>row.kind==='dynamic-class-expression').length,3);
});

test('JS class-name strings decode whitespace escapes and concatenated fragments remain unresolved',()=>{
  const source='className = "panel\\tactive";\nclassName = "prefix" + suffix;\nnode.className = `prefix-${suffix}`;';
  const rows=findAssignedClasses(source,'app.js',{javascript:true});
  assert.deepEqual([...counts(rows)].sort(),[['active',1],['panel',1]]);
  assert.equal(rows.filter(row=>row.kind==='dynamic-class-expression').length,2);
});

test('Box text count classes uses saved folder, saves one report with small tracking records and leaves source unchanged',async t=>{
  const {folder,temp}=await fixture(t),rabHome=path.join(temp,'.rab');
  const memory=createRabMemory({rabHome}),id=await memory.allocateId(),projectRoot=memory.newProjectPath('Class map');
  await mkdir(projectRoot,{recursive:true});
  const project={id,name:'Class map',root:projectRoot};
  await writeFile(path.join(projectRoot,'settings.json'),JSON.stringify({id:project.id,name:project.name,type:'audit',paths:{folder,results:'audit-results'}}));
  await writeFile(path.join(projectRoot,'PATHS.json'),JSON.stringify({project:{id:project.id,name:project.name},stamps:{},tools:{},catalogs:{}}));
  await memory.openProject(project);const session=await memory.createSession(project),savedRoot=memory.paths(project).project;
  const before=await readFile(path.join(folder,'page.html')),beforeStat=await stat(path.join(folder,'page.html'));
  const workbench=createWorkbench({root,rabHome});
  const plan=await workbench.sessionTurn({session_id:session.id,text:'count classes'});
  assert.equal(plan.current_steps[0].status,'ready');
  assert.equal(plan.current_steps[0].capability.name,'count-classes');
  const executed=await workbench.sessionExecute({session_id:session.id,confirm:true});
  const step=executed.current_steps[0];assert.equal(step.status,'completed');
  const receipt=step.receipt.steps[0],report=JSON.parse(await readFile(receipt.result_file,'utf8'));
  assert.equal(report.options.folder,folder);assert.equal(report.result.unique,4);
  assert.ok(receipt.result_file.startsWith(path.join(savedRoot,'audit-results')));
  assert.equal((await readdir(path.dirname(receipt.result_file))).length,1);
  const records=await readdir(path.join(savedRoot,'runs',String(session.id)));assert.equal(records.length,3);
  for(const name of records){const file=path.join(savedRoot,'runs',String(session.id),name),record=JSON.parse(await readFile(file,'utf8'));assert.equal(record.status,'completed');assert.ok(record.start_date&&record.end_date);assert.ok(Number.isSafeInteger(record.execution_id)&&record.execution_id>0);assert.ok((await stat(file)).size<2000);}
  assert.deepEqual(await readFile(path.join(folder,'page.html')),before);
  assert.equal((await stat(path.join(folder,'page.html'))).mtimeMs,beforeStat.mtimeMs);
});
