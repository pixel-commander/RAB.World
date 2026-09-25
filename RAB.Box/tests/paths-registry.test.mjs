import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createPathsRegistry } from '../bridge/paths-registry.mjs';
import { createToolHouse } from '../bridge/tool-house.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('house PATHS is a flat direct address book', async()=>{
  const registry=createPathsRegistry({root});
  const packed=await registry.pack();
  assert.equal(packed.stamps['add-atom'].id,1790000000501);
  assert.equal(packed.stamps['add-atom'].path,'css/stamp-new-atom');
  assert.equal(packed.tools['count-use-effect'].path,'react/count/hooks/use-effect');
  assert.deepEqual(registry.tagsFromPath('react/count/hooks/use-effect'),['react','count','hooks','use-effect']);
});

test('Tool House resolves a short PATHS key by permanent id', async()=>{
  const house=createToolHouse({root});
  const tool=await house.getTool('count-use-effect');
  assert.equal(tool.id,1790000000811);
  assert.equal(tool.key,'react/count/hooks/use-effect');
  assert.equal(tool.address,'count-use-effect');
});

test('project PATHS can hijack one house address without replacing siblings', async()=>{
  const project=await mkdtemp(path.join(os.tmpdir(),'rab-paths-'));
  const stampRoot=path.join(project,'project-stamps','css','stamp-new-atom');
  await mkdir(path.join(stampRoot,'template'),{recursive:true});
  await writeFile(path.join(stampRoot,'settings.json'),JSON.stringify({
    id:1990000000001,
    name:'stamp-new-atom',
    title:'Project Atom',
    description:'Creates a project-specific CSS atom.',
    settings:[],
    meta:{domain:'css',operation:'create',target_type:'atom',output:'atom',authority:'write'}
  },null,2));
  await writeFile(path.join(stampRoot,'stamp-new-atom.mjs'),"export const run=async()=>({source:'project-override'});\n");
  await writeFile(path.join(project,'PATHS.json'),JSON.stringify({
    project:{id:'paths-test',name:'Paths Test'},
    stamps:{'add-atom':{id:1990000000001,path:'project-stamps/css/stamp-new-atom'}},
    tools:{},
    catalogs:{}
  },null,2));

  const house=createToolHouse({root});
  const normal=await house.getTool('add-atom');
  assert.equal(normal.id,1790000000501);

  const local=await house.getTool('add-atom',{context:{project:{id:'paths-test',name:'Paths Test',root:project}}});
  assert.equal(local.id,1990000000001);
  assert.equal(local.source,'project');
  assert.equal(local.shadowed.id,1790000000501);
  assert.deepEqual(local.tags,['css','stamp-new-atom']);

  const sibling=await house.getTool('count-use-effect',{context:{project:{id:'paths-test',name:'Paths Test',root:project}}});
  assert.equal(sibling.id,1790000000811);
});
