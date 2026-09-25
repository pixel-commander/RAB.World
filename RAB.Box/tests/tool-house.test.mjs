import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createToolHouse } from '../bridge/tool-house.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('tool house discovers normal Tools and template-backed Stamps from settings.json', async () => {
  const house=createToolHouse({root});
  const data=await house.listTools();
  const keys=data.items.map(x=>x.key);
  for (const key of ['base/find-tool','base/re-phrase-check','base/stamp-new-stamp','base/stamp-new-tool','base/stamp-new-project','base/list-projects','base/load-project','base/check-tool','react/find-hook','react/find/hooks','react/stamp-new-component','audit/find-files']) assert.ok(keys.includes(key), key);
  assert.equal(data.items.find(x=>x.key==='base/stamp-new-stamp').kind,'stamp');
  assert.equal(data.items.find(x=>x.key==='base/find-tool').kind,'tool');
  assert.deepEqual(data.unavailable,[]);
});

test('find-tool searches the actual Tool settings and carries zero authority', async () => {
  const house=createToolHouse({root});
  const out=await house.runTool({key:'base/find-tool',options:{query:'re phrase'}});
  assert.equal(out.result.items[0].name,'re-phrase-check');
  assert.equal(out.result.authority,0);
});

test('re-phrase-check uses lexical/sense logic rather than hardcoded sentence output', async () => {
  const house=createToolHouse({root});
  const out=await house.runTool({key:'base/re-phrase-check',options:{text:`re-phrase "this didn't work"`}});
  assert.equal(out.result.status,'ok');
  assert.equal(out.result.normalized,'this did not work');
  assert.equal(out.result.shape.predicate,'succeed');
  assert.equal(out.result.shape.opposite,'fail');
  assert.equal(out.result.primary,'This failed.');
  assert.equal(out.result.rule,'negated-predicate→opposite-predicate');
});

test('re-phrase-check keeps strict unknown language visible', async () => {
  const house=createToolHouse({root});
  const out=await house.runTool({key:'base/re-phrase-check',options:{text:'thwies blorpt'}});
  assert.equal(out.result.status,'language-gap');
  assert.deepEqual(out.result.unknown,['thwies','blorpt']);
  assert.equal(out.result.primary,null);
});

test('same-sense re-phrase generates a different known surface', async () => {
  const house=createToolHouse({root});
  const out=await house.runTool({key:'base/re-phrase-check',options:{text:'find all orphaned files'}});
  assert.equal(out.result.primary,'Locate every unreferenced file');
  assert.deepEqual(out.result.shape.senses,['find','all','orphaned']);
});

test('stamp-new-stamp copies the standard mold and populates generated settings.json', async t => {
  const temp=await mkdtemp(path.join(os.tmpdir(),'rab-tool-house-'));
  t.after(()=>rm(temp,{recursive:true,force:true}));
  await cp(path.join(root,'tools'),path.join(temp,'tools'),{recursive:true});
  const house=createToolHouse({root:temp});
  const out=await house.runTool({key:'base/stamp-new-stamp',options:{
    type:'css',name:'new-token',title:'New Token',description:'Creates one CSS token.',
    settings:[{type:'text',name:'name',description:'Atom name',required:true}],
    meta:{operation:'create',target_type:'atom'}
  }});
  assert.equal(out.result.name,'stamp-new-token');
  assert.equal(out.result.check.visible,true);
  assert.equal(out.result.check.key,'css/stamp-new-token');
  const generated=JSON.parse(await readFile(path.join(temp,'tools/css/stamp-new-token/settings.json'),'utf8'));
  assert.equal(generated.name,'stamp-new-token');
  assert.equal(generated.title,'New Token');
  assert.deepEqual(generated.settings,[{type:'text',name:'name',description:'Atom name',required:true}]);
  assert.equal(generated.meta.target_type,'atom');
  assert.match(await readFile(path.join(temp,'tools/css/stamp-new-token/stamp-new-token.mjs'),'utf8'),/stamp-new-token/);
  assert.match(await readFile(path.join(temp,'tools/css/stamp-new-token/template/README.txt'),'utf8'),/Every generated Stamp owns/);
});
