import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { createToolHouse } from '../bridge/tool-house.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const makeProject=async(t,label)=>{
  const temp=await mkdtemp(path.join(os.tmpdir(),`rab-v093-${label}-`));t.after(()=>rm(temp,{recursive:true,force:true}));
  const projectRoot=path.join(temp,'project');
  await mkdir(path.join(projectRoot,'src/pages'),{recursive:true});
  await mkdir(path.join(projectRoot,'src/components'),{recursive:true});
  await mkdir(path.join(projectRoot,'src/css'),{recursive:true});
  await writeFile(path.join(projectRoot,'settings.json'),JSON.stringify({id:label,name:label,type:'react',paths:{pages:'src/pages',components:'src/components',atoms:'src/atoms'}},null,2));
  return {temp,projectRoot,context:{project:{id:label,name:label,root:projectRoot},rab_home:path.join(temp,'.rab')},house:createToolHouse({root})};
};

const buildPrimitiveDashboard=async({house,context,projectRoot,componentFirst=false,name='Test'})=>{
  const components=path.join(projectRoot,'src/components');
  let nav;
  if(componentFirst)nav=await house.runTool({key:'react/stamp-new-component',options:{name:'SiteNav',location:components},context});
  const page=await house.runTool({key:'react/stamp-new-page',options:{name},context});
  await house.runTool({key:'react/apply/grid-layout',options:{file:page.result.file,layout:'header-main'},context});
  if(!componentFirst)nav=await house.runTool({key:'react/stamp-new-component',options:{name:'SiteNav',location:components},context});
  await house.runTool({key:'react/insert/component-into-area',options:{component:'SiteNav',file:page.result.file,area:'header'},context});
  return {page,nav,text:await readFile(page.result.file,'utf8')};
};

test('v0.9.3 required construction capabilities are registered with stable IDs',async()=>{
  const house=createToolHouse({root});const data=await house.listTools({fresh:true});
  assert.equal(data.unavailable.length,0);
  const byKey=new Map(data.items.map(item=>[item.key,item]));
  assert.equal(byKey.get('react/stamp-new-page')?.id,1830000000001);
  assert.equal(byKey.get('react/apply/grid-layout')?.id,1830000000002);
  assert.equal(byKey.get('react/insert/component-into-area')?.id,1830000000003);
  assert.equal(byKey.get('react/apply/scroll-y')?.id,1830000000004);
  assert.equal(byKey.get('react/add/scroll-wrapper')?.id,1830000000005);
  assert.equal(byKey.get('react/stamp-new-dashboard')?.id,1830000000006);
});

test('page-first and component-first construction orders converge to the same final page',async t=>{
  const a=await makeProject(t,'order-a');
  const b=await makeProject(t,'order-b');
  const pageFirst=await buildPrimitiveDashboard({...a,componentFirst:false});
  const componentFirst=await buildPrimitiveDashboard({...b,componentFirst:true});
  assert.equal(pageFirst.text,componentFirst.text);
  assert.match(pageFirst.text,/data-grid="header-main"/);
  assert.match(pageFirst.text,/data-area="header"/);
  assert.match(pageFirst.text,/<div[^>]*data-area="header"/);
  assert.match(pageFirst.text,/data-rab-seat="area-header:a1"/);
  assert.match(pageFirst.text,/<SiteNav><\/SiteNav>/);
  assert.match(pageFirst.text,/import \{ SiteNav \} from '\.\.\/\.\.\/components\/SiteNav\/SiteNav';/);
});

test('compound Dashboard Stamp converges with the equivalent primitive sequence',async t=>{
  const compound=await makeProject(t,'compound');
  const primitive=await makeProject(t,'primitive');
  const made=await compound.house.runTool({key:'react/stamp-new-dashboard',options:{name:'Test'},context:compound.context});
  const expected=await buildPrimitiveDashboard({...primitive,name:'Test'});
  const actual=await readFile(made.result.page.file,'utf8');
  assert.equal(actual,expected.text);
  assert.equal(made.result.layout,'header-main');
  assert.deepEqual(made.result.nav,{name:'SiteNav',area:'header',created:true});
  assert.equal(made.tasks.some(task=>task.tool?.key==='react/stamp-new-page'&&task.auto),true);
  assert.equal(made.tasks.some(task=>task.tool?.key==='react/apply/grid-layout'&&task.auto),true);
  assert.equal(made.tasks.some(task=>task.tool?.key==='react/insert/component-into-area'&&task.auto),true);
});

test('scroll-y and scroll wrapper target nested construction seats without touching siblings',async t=>{
  const x=await makeProject(t,'scroll');
  const file=path.join(x.projectRoot,'src/pages/ScrollDemo.tsx');
  await writeFile(file,`export const ScrollDemo=()=> (\n  <main>\n    <div data-rab-seat="container-main:c1" className="container-main">\n      <div data-rab-seat="container-seat:c1" className="container-seat"></div>\n    </div>\n    <div data-rab-seat="other:c1" className="other"></div>\n  </main>\n);\n`);
  await x.house.runTool({key:'react/apply/scroll-y',options:{file,seat_id:'container-seat:c1'},context:x.context});
  await x.house.runTool({key:'react/add/scroll-wrapper',options:{file,seat_id:'container-seat:c1',new_seat_id:'scroll-seat:s1'},context:x.context});
  const text=await readFile(file,'utf8');
  assert.match(text,/data-rab-seat="scroll-seat:s1"/);
  assert.match(text,/<div[^>]*className="scroll-y"[^>]*data-rab-seat="scroll-seat:s1"|<div[^>]*data-rab-seat="scroll-seat:s1"[^>]*className="scroll-y"/);
  assert.match(text,/data-rab-seat="container-seat:c1" className="container-seat scroll-y"/);
  assert.match(text,/data-rab-seat="other:c1" className="other"/);
  assert.doesNotMatch(text,/data-rab-seat="other:c1" className="other scroll-y"/);
});

test('Scaffolding Cleanup Pass strips new page/grid/wrapper markers without removing semantic output',async t=>{
  const x=await makeProject(t,'cleanup');
  const made=await x.house.runTool({key:'react/stamp-new-dashboard',options:{name:'Test'},context:x.context});
  await x.house.runTool({key:'react/add/scroll-wrapper',options:{file:made.result.page.file,area:'main',new_seat_id:'scroll-main:s1'},context:x.context});
  await x.house.runTool({key:'code/scaffolding/cleanup',options:{file:made.result.page.file},context:x.context});
  const text=await readFile(made.result.page.file,'utf8');
  assert.doesNotMatch(text,/data-rab-seat=/);
  assert.doesNotMatch(text,/rab-seat:/);
  assert.match(text,/data-grid="header-main"/);
  assert.match(text,/data-area="header"/);
  assert.match(text,/<SiteNav><\/SiteNav>/);
  assert.match(text,/className="scroll-y"/);
});

test('component insertion refuses a same-name import bound from the wrong module',async t=>{
  const x=await makeProject(t,'import-collision');
  const componentDir=path.join(x.projectRoot,'src/components/SiteNav');
  await mkdir(componentDir,{recursive:true});
  await writeFile(path.join(componentDir,'SiteNav.tsx'),`export const SiteNav=()=> <nav>right</nav>;\n`);
  const page=path.join(x.projectRoot,'src/pages/Test.tsx');
  const original=`import { SiteNav } from '../wrong';\nexport const Test=()=> <main><section data-area="header"></section></main>;\n`;
  await writeFile(page,original);
  await assert.rejects(
    x.house.runTool({key:'react/insert/component-into-area',options:{component:'SiteNav',file:page,area:'header'},context:x.context}),
    error=>error?.code==='IMPORT_COLLISION'&&error?.existing_source==='../wrong'
  );
  assert.equal(await readFile(page,'utf8'),original);
});

test('grid layout can target one exact nested construction seat without touching siblings',async t=>{
  const x=await makeProject(t,'nested-grid');
  const file=path.join(x.projectRoot,'src/pages/NestedGrid.tsx');
  await writeFile(file,`export const NestedGrid=()=> (\n  <main>\n    <div data-rab-seat="container-main:c1" className="container-main"></div>\n    <div data-rab-seat="other:c1" className="other"></div>\n  </main>\n);\n`);
  const applied=await x.house.runTool({key:'react/apply/grid-layout',options:{file,seat_id:'container-main:c1',layout:'header-main'},context:x.context});
  const text=await readFile(file,'utf8');
  assert.match(text,/data-rab-seat="container-main:c1" className="container-main" data-grid="header-main" data-gap="content"/);
  assert.match(text,/data-rab-seat="area-header:a1--in-container-main-c1"/);
  assert.match(text,/data-rab-seat="area-main:a1--in-container-main-c1"/);
  assert.match(text,/data-rab-seat="other:c1" className="other"/);
  assert.doesNotMatch(text,/data-rab-seat="other:c1" className="other" data-grid=/);
  assert.equal(applied.result.target.seat_id,'container-main:c1');
});

test('canonical Grid CSS includes vertical-scroll utility used by construction Tools',async()=>{
  const css=await readFile(path.join(root,'tools/css/grid/stamp-install/template/grid.css'),'utf8');
  assert.match(css,/\.scroll-y\s*\{[^}]*min-block-size:\s*0;[^}]*overflow-y:\s*auto;/s);
});
