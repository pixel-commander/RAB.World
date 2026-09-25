import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createToolHouse } from '../bridge/tool-house.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('grid Stamp leaves addressable construction seats and Cleanup Pass strips only scaffolding',async t=>{
  const temp=await mkdtemp(path.join(os.tmpdir(),'rab-v092-scaffold-'));t.after(()=>rm(temp,{recursive:true,force:true}));
  const projectRoot=path.join(temp,'project');await mkdir(projectRoot,{recursive:true});
  const house=createToolHouse({root});const context={project:{id:'x',name:'x',root:projectRoot},rab_home:path.join(temp,'.rab')};
  const made=await house.runTool({key:'html/add/grid/stamp-new',options:{location:projectRoot,name:'layout',layout:'header-main',gap:'content'},context});
  const before=await readFile(made.result.file,'utf8');
  assert.match(before,/data-rab-seat="area-header:a1"/);assert.match(before,/\[rab-seat:area-header:a1\]/);
  assert.match(before,/data-rab-seat="area-main:a1"/);assert.match(before,/\[rab-seat:area-main:a1\]/);
  const listed=await house.runTool({key:'code/scaffolding/list-seats',options:{file:made.result.file},context});
  assert.equal(listed.result.count,4);
  const preview=await house.runTool({key:'code/scaffolding/cleanup',options:{file:made.result.file,dry_run:true},context});
  assert.equal(preview.result.removed_count,4);assert.equal(await readFile(made.result.file,'utf8'),before);
  await house.runTool({key:'code/scaffolding/cleanup',options:{file:made.result.file},context});
  const after=await readFile(made.result.file,'utf8');
  assert.doesNotMatch(after,/data-rab-seat/);assert.doesNotMatch(after,/rab-seat:/);
  assert.match(after,/data-grid="header-main"/);assert.match(after,/data-area="header"/);assert.match(after,/data-area="main"/);
});

test('React DOM edit Tools target exact construction seats and can create a new addressable child',async t=>{
  const temp=await mkdtemp(path.join(os.tmpdir(),'rab-v092-dom-seat-'));t.after(()=>rm(temp,{recursive:true,force:true}));
  const projectRoot=path.join(temp,'project');await mkdir(projectRoot,{recursive:true});
  const file=path.join(projectRoot,'SeatDemo.tsx');
  await writeFile(file,`export const SeatDemo=()=> (\n  <main>\n    <div data-rab-seat="container-main:c1"><span>A</span></div>\n    <div data-rab-seat="container-other:c1"><span>B</span></div>\n  </main>\n);\n`);
  const house=createToolHouse({root});const context={project:{id:'x',name:'x',root:projectRoot},rab_home:path.join(temp,'.rab')};
  const cls=await house.runTool({key:'react/add/class',options:{file,seat_id:'container-main:c1',class_name:'container-main'},context});
  assert.equal(cls.result.targets,1);
  let text=await readFile(file,'utf8');
  assert.match(text,/data-rab-seat="container-main:c1" className="container-main"/);
  assert.doesNotMatch(text,/data-rab-seat="container-other:c1" className=/);
  const child=await house.runTool({key:'react/add/element',options:{file,seat_id:'container-main:c1',tag:'div',class_name:'container-seat',new_seat_id:'container-seat:c1'},context});
  assert.equal(child.result.targets,1);
  text=await readFile(file,'utf8');
  assert.match(text,/data-rab-seat="container-seat:c1"/);assert.match(text,/className="container-seat"/);
});
