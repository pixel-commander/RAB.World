import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm, cp, mkdir, readFile, lstat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createToolHouse } from '../bridge/tool-house.mjs';
import { createSeatParser } from '../bridge/seat-parser.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('Tool House structural law: template means stamp-* and settings outer shape is universal',async()=>{
  const house=createToolHouse({root});const data=await house.scan({fresh:true});assert.deepEqual(data.unavailable,[]);
  assert.ok(data.items.some(tool=>tool.key==='base/stamp-new-stamp'),'Known scaffold must be discovered; an empty scan cannot pass.');
  for(const tool of data.items){
    for(const key of ['id','name','title','description','settings','meta']) assert.ok(tool[key]!==undefined,`${tool.key}:${key}`);
    assert.equal(Boolean(tool.template),tool.name.startsWith('stamp-'),tool.key);
  }
});

test('audit look/read discovery is a hard domain boundary and skips stamps when requested',async()=>{
  const house=createToolHouse({root});
  const out=await house.listTools({domain:'audit',includeStamps:false});
  assert.ok(out.items.some(x=>x.key==='audit/find-files'));
  assert.ok(out.items.some(x=>x.domain==='base'));
  assert.ok(out.items.every(x=>x.kind!=='stamp'));
  assert.ok(out.items.every(x=>['base','audit'].includes(x.domain)));
  assert.ok(!out.items.some(x=>x.key==='react/find/hooks'));
});

test('reworded component creation melts to the same top Tool candidates',async()=>{
  const house=createToolHouse({root});
  const queries=['create a new component','make a component','build another component'];
  for(const query of queries){
    const out=await house.findTools({query,domain:'react',includeStamps:true});
    assert.equal(out.request_shape.seats.operation,'create');
    assert.equal(out.request_shape.seats.target_type,'component');
    assert.equal(out.items[0].key,'react/stamp-new-component',query);
  }
});

test('find-hook and find-hooks honor the singular/plural house law',async()=>{
  const house=createToolHouse({root});
  let out=await house.findTools({query:'find hook',domain:'react',includeStamps:false});
  assert.equal(out.request_shape.seats.quantifier,'one');assert.equal(out.items[0].key,'react/find-hook');
  out=await house.findTools({query:'find hooks',domain:'react',includeStamps:false});
  assert.equal(out.request_shape.seats.quantifier,'all');assert.equal(out.items[0].key,'react/find/hooks');
});

test('base stamp-new-project delegates known values to the selected type stamp',async t=>{
  const temp=await mkdtemp(path.join(os.tmpdir(),'rab-v08-project-'));t.after(()=>rm(temp,{recursive:true,force:true}));
  const parent=path.join(temp,'projects');await mkdir(parent);
  const house=createToolHouse({root});
  const out=await house.runTool({key:'base/stamp-new-project',options:{type:'html',name:'demo-site',folder:parent},context:{rab_home:path.join(temp,'.rab')}});
  assert.equal(out.result.delegate,'new-html-project');
  assert.equal(out.result.child.tool.path,'html/stamp-new-project');
  const project=out.result.child.result.project;assert.equal(project.name,'demo-site');assert.equal(project.type,'html');
  assert.equal(JSON.parse(await readFile(path.join(project.root,'settings.json'),'utf8')).type,'html');
  assert.ok(await lstat(path.join(project.root,'index.html')));
});

test('stamp-new-tool creates a non-stamp Tool and stamp-new-key-phrase feeds the same parser',async t=>{
  const temp=await mkdtemp(path.join(os.tmpdir(),'rab-v08-authoring-'));t.after(()=>rm(temp,{recursive:true,force:true}));
  for(const folder of ['bridge','engine'])await cp(path.join(root,folder),path.join(temp,folder),{recursive:true});
  await cp(path.join(root,'tools'),path.join(temp,'tools'),{recursive:true});
  await cp(path.join(root,'language'),path.join(temp,'language'),{recursive:true});
  const house=createToolHouse({root:temp});
  const made=await house.runTool({key:'base/stamp-new-tool',context:{rab_home:path.join(temp,'.rab')},options:{type:'audit',name:'check-lines',title:'Check Lines',description:'Checks line records.',settings:[],meta:{operation:'check',target_type:'file'}}});
  assert.equal(made.result.name,'check-lines');assert.equal(made.result.check.visible,true);assert.equal((await lstat(path.join(temp,'tools/audit/check-lines'))).isDirectory(),true);
  await assert.rejects(lstat(path.join(temp,'tools/audit/check-lines/template')),{code:'ENOENT'});
  const phrase='rabbity orphan things';
  await house.runTool({key:'base/stamp-new-key-phrase',options:{phrase,types:'predicate-phrase',senses:'orphaned'}});
  const parser=await createSeatParser({languageRoot:path.join(temp,'language')});
  assert.ok(parser.lexiconStats.phrases>=58);
});

test('normalized audit Tools run through the same Tool House contract',async t=>{
  const temp=await mkdtemp(path.join(os.tmpdir(),'rab-v08-audit-'));t.after(()=>rm(temp,{recursive:true,force:true}));
  const src=path.join(temp,'src');await mkdir(src,{recursive:true});
  await import('node:fs/promises').then(({writeFile})=>Promise.all([
    writeFile(path.join(src,'a.ts'),"// hello\nimport { b } from './b'\nexport const a = b\n"),
    writeFile(path.join(src,'b.ts'),"/* block */\nexport const b = 1\n"),
    writeFile(path.join(src,'note.txt'),'hello')
  ]));
  const house=createToolHouse({root});
  const files=await house.runTool({key:'audit/count-file-types',options:{folder:src}});
  assert.equal(files.result.totals.total_files,3);
  assert.ok(files.result.rows.some(row=>row.label==='.ts'&&row.count===2));
  const comments=await house.runTool({key:'audit/find-comments',options:{folder:src}});
  assert.equal(comments.result.totals.comments,2);
  const imports=await house.runTool({key:'audit/find-imports',options:{folder:src}});
  assert.equal(imports.result.totals.imports,1);
  assert.ok(imports.result.index.by_source['./b']);
});

test('check-tool verifies structural visibility and description relation',async()=>{
  const house=createToolHouse({root});
  const out=await house.runTool({key:'base/check-tool',options:{key:'react/stamp-new-component'}});
  assert.equal(out.result.status,'visible');
  assert.equal(out.result.kind,'stamp');
  assert.equal(out.result.structural.template_rule,true);
  assert.ok(out.result.description_check.rank>=1);
});
