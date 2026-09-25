import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtemp, rm, cp, mkdir, rename, readFile, writeFile } from 'node:fs/promises';
import { createToolHouse } from '../bridge/tool-house.mjs';
import { createSeatParser } from '../bridge/seat-parser.mjs';
import { createRabMemory } from '../bridge/rab-memory.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('deep Tool leaves inherit path tags and nearest parent executor',async()=>{
  const house=createToolHouse({root});
  const tool=await house.getTool('react/count/hooks/use-effect');
  assert.equal(tool.id,1790000000811);
  assert.equal(tool.path,'react/count/hooks/use-effect');
  assert.deepEqual(tool.tags,['react','count','hooks','use-effect']);
  assert.equal(tool.script,'count.mjs');
  assert.equal(tool.scriptOwner,'react/count');
  assert.equal(tool.inheritedExecutor,true);
  assert.deepEqual(tool.index,{id:1790000000811,path:'react/count/hooks/use-effect',tags:['react','count','hooks','use-effect'],script:'count.mjs'});
});

test('moving a Tool changes inherited path tags but preserves permanent ID and executor',async t=>{
  const temp=await mkdtemp(path.join(os.tmpdir(),'rab-move-tool-'));t.after(()=>rm(temp,{recursive:true,force:true}));
  await cp(path.join(root,'tools'),path.join(temp,'tools'),{recursive:true});
  await cp(path.join(root,'language'),path.join(temp,'language'),{recursive:true});
  const before=createToolHouse({root:temp});
  const original=await before.getTool('react/count/hooks/use-effect');
  await mkdir(path.join(temp,'tools/react/count/effects'),{recursive:true});
  await rename(path.join(temp,'tools/react/count/hooks/use-effect'),path.join(temp,'tools/react/count/effects/use-effect'));
  const after=createToolHouse({root:temp});
  const moved=await after.getTool('react/count/effects/use-effect');
  const byId=await after.getTool(String(original.id));
  assert.equal(byId.key,'react/count/effects/use-effect');
  assert.equal(moved.id,original.id);
  assert.equal(moved.script,'count.mjs');
  assert.deepEqual(moved.tags,['react','count','effects','use-effect']);
  assert.equal(moved.path,'react/count/effects/use-effect');
});

test('explicit metadata cannot contradict inherited path operation',async t=>{
  const temp=await mkdtemp(path.join(os.tmpdir(),'rab-path-conflict-'));t.after(()=>rm(temp,{recursive:true,force:true}));
  await cp(path.join(root,'tools'),path.join(temp,'tools'),{recursive:true});
  await cp(path.join(root,'language'),path.join(temp,'language'),{recursive:true});
  const dir=path.join(temp,'tools/react/count/hooks/wrong-operation');await mkdir(dir,{recursive:true});
  await writeFile(path.join(dir,'settings.json'),JSON.stringify({id:999123,name:'wrong-operation',title:'Wrong Operation',description:'Finds a hook.',settings:[],meta:{domain:'react',operation:'find',target_type:'hook'}},null,2));
  const house=createToolHouse({root:temp});
  const scan=await house.scan({fresh:true});
  assert.ok(!scan.items.some(x=>x.key==='react/count/hooks/wrong-operation'));
  const failure=scan.unavailable.find(x=>x.key==='react/count/hooks/wrong-operation');
  assert.equal(failure.code,'PATH_META_CONFLICT');
});

test('extra path match selects specific hook Tool while an underspecified query keeps the generic Tool',async()=>{
  const house=createToolHouse({root});
  let found=await house.findTools({query:'find hooks',domain:'react',includeStamps:false});
  assert.equal(found.items[0].key,'react/find/hooks');
  found=await house.findTools({query:'find state hooks',domain:'react',includeStamps:false});
  assert.equal(found.items[0].key,'react/find/hooks/state-hooks');
  assert.ok(found.items[0].path_score>0);
  found=await house.findTools({query:'count useEffect',domain:'react',includeStamps:false});
  assert.equal(found.items[0].key,'react/count/hooks/use-effect');
  assert.ok(found.items[0].path_matches.some(x=>x.tag==='use-effect'));
});

test('use-effect is the reserved house word for native useEffect surfaces',async()=>{
  const parser=await createSeatParser({languageRoot:path.join(root,'language')});
  for(const surface of ['use-effect','useEffect','useeffect']){
    const shape=parser.shape1(`find ${surface}`);
    const token=shape.words.find(w=>w.text.toLowerCase()===surface.toLowerCase());
    assert.ok(token,surface);
    assert.ok(token.candidates.some(c=>c.lemma==='use-effect'&&c.types.includes('reserved')&&c.senses.includes('effect-hook')),surface);
    const parsed=parser.parse(`find ${surface}`,{context:{domain:'react'}});
    assert.equal(parsed.frames[0].seats.domain,'react');
    assert.equal(parsed.frames[0].seats.target_type,'hook');
    assert.equal(parsed.frames[0].seats.predicate,'effect');
  }
});

test('hook finder determines script types once, saves project fact, then reuses it',async t=>{
  const temp=await mkdtemp(path.join(os.tmpdir(),'rab-hook-facts-'));t.after(()=>rm(temp,{recursive:true,force:true}));
  const projectRoot=path.join(temp,'project');await mkdir(path.join(projectRoot,'src'),{recursive:true});
  await writeFile(path.join(projectRoot,'settings.json'),JSON.stringify({id:'demo',name:'demo',type:'react'},null,2));
  await writeFile(path.join(projectRoot,'src','Demo.tsx'),"import { useEffect, useState } from 'react';\nexport const Demo=()=>{ const [x,setX]=useState(0); useEffect(()=>setX(1),[]); return x; };\n");
  const rabHome=path.join(temp,'.rab');
  const context={rab_home:rabHome,project:{id:'demo',name:'demo',root:projectRoot}};
  const house=createToolHouse({root});
  const first=await house.runTool({key:'react/find/hooks/use-effect',options:{},context});
  assert.equal(first.result.total,1);
  assert.equal(first.result.extension_source,'base/determine/script-type');
  assert.ok(first.result.dependency);
  const memory=createRabMemory({rabHome});
  const fact=await memory.getFact(context.project,'script_extensions');
  assert.ok(fact.value.includes('tsx'));
  const second=await house.runTool({key:'react/count/hooks/state-hooks',options:{},context});
  assert.equal(second.result.count,1);
  assert.equal(second.result.extension_source,'project-fact');
  assert.equal(second.result.dependency,null);
});

test('React hook Stamps materialize native hooks and leave explicit future seats',async t=>{
  const temp=await mkdtemp(path.join(os.tmpdir(),'rab-hook-stamps-'));t.after(()=>rm(temp,{recursive:true,force:true}));
  const house=createToolHouse({root});
  const effect=await house.runTool({key:'react/hooks/use-effect/stamp-new',options:{name:'useWindowTitle',location:temp}});
  const effectText=await readFile(effect.result.path,'utf8');
  assert.match(effectText,/useEffect/);
  assert.match(effectText,/@rab-seat effect-body/);
  assert.match(effectText,/@rab-seat dependencies/);
  const state=await house.runTool({key:'react/hooks/state-hooks/stamp-new',options:{name:'useCartState',location:temp,initial_value:'[]'}});
  const stateText=await readFile(state.result.path,'utf8');
  assert.match(stateText,/useState\(\[\]\)/);
  assert.match(stateText,/@rab-seat state-logic/);
});

test('reserved hook shape gives the matching deep Stamp the distinguishing path match',async()=>{
  const house=createToolHouse({root});
  let out=await house.findTools({query:'make a useEffect hook',domain:'react',includeStamps:true});
  assert.equal(out.items[0].key,'react/hooks/use-effect/stamp-new');
  out=await house.findTools({query:'make a state hook',domain:'react',includeStamps:true});
  assert.equal(out.items[0].key,'react/hooks/state-hooks/stamp-new');
});
