import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cp, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { createToolHouse } from '../bridge/tool-house.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const settings=(id,name,title,fields=[])=>JSON.stringify({id,name,title,description:`${title} test fixture.`,settings:fields,meta:{authority:'pure'}},null,2);
const field=(name,{tryTool=null,required=true}={})=>({type:'text',name,title:name,description:`${name} test seat.`,required,...(tryTool?{try:tryTool}:{})});

const fixture=async t=>{
  const temp=await mkdtemp(path.join(os.tmpdir(),'rab-v092-nested-'));
  t.after(()=>rm(temp,{recursive:true,force:true}));
  await cp(root,temp,{recursive:true});
  const base=path.join(temp,'tools','test-nest');
  const add=async(name,id,fields,source)=>{
    const dir=path.join(base,name);await mkdir(dir,{recursive:true});
    await writeFile(path.join(dir,'settings.json'),settings(id,name,`Test ${name}`,fields));
    await writeFile(path.join(dir,`${name}.mjs`),source);
  };
  await add('grandchild',9900000001001,[],`export const run=async()=>({provided:{seats:{name:'Burrow'}},grandchild_name:'Burrow'});`);
  await add('child',9900000001002,[field('name',{tryTool:'test-nest/grandchild'})],`export const run=async({options,helpers})=>({child_name:options.name,local_name:helpers.getSeat('name')});`);
  await add('provider',9900000001003,[],`export const run=async()=>({provided:{seats:{name:'Burrow'}}});`);
  await add('continuation',9900000001004,[],`export const run=async()=>({continuation:{seat:'name',value:'Burrow'}});`);
  await add('parent',9900000001005,[],`export const run=async({helpers})=>{helpers.fillSeat('name','Rabbit');const child=await helpers.runTool({key:'test-nest/child',options:{}});return{parent_name:helpers.getSeat('name'),child:child.result};};`);
  await add('parent-explicit-down',9900000001006,[],`export const run=async({helpers})=>{helpers.fillSeat('name','Rabbit');const child=await helpers.runTool({key:'test-nest/child',options:{name:helpers.getSeat('name')}});return{parent_name:helpers.getSeat('name'),child:child.result};};`);
  await add('parent-unbound-provider',9900000001007,[],`export const run=async({helpers})=>{helpers.fillSeat('name','Rabbit');const child=await helpers.runTool({key:'test-nest/provider',options:{}});return{parent_name:helpers.getSeat('name'),child:child.result};};`);
  await add('parent-unbound-continuation',9900000001008,[],`export const run=async({helpers})=>{helpers.fillSeat('name','Rabbit');const child=await helpers.runTool({key:'test-nest/continuation',options:{}});return{parent_name:helpers.getSeat('name'),child:child.result};};`);
  await add('parent-explicit-up',9900000001009,[],`export const run=async({helpers})=>{helpers.fillSeat('name','Rabbit');const child=await helpers.runTool({key:'test-nest/provider',options:{}});helpers.fillSeat('chosen_name',child.result.provided.seats.name);return{parent_name:helpers.getSeat('name'),chosen_name:helpers.getSeat('chosen_name')};};`);
  await add('child-a',9900000001010,[],`export const run=async({helpers})=>{helpers.fillSeat('name','Alpha');return{local_name:helpers.getSeat('name')};};`);
  await add('parent-siblings',9900000001011,[],`export const run=async({helpers})=>{const a=await helpers.runTool({key:'test-nest/child-a',options:{}});const b=await helpers.runTool({key:'test-nest/child',options:{}});return{a:a.result,b:b.result};};`);
  await add('promoted-reader',9900000001012,[field('name')],`export const run=async({options})=>({name:options.name});`);
  return {temp,house:createToolHouse({root:temp})};
};

test('NEST-001: ancestor-local same-name seat does not bind child and grandchild resolves it',async t=>{
  const {house}=await fixture(t);const out=await house.runTool({key:'test-nest/parent'});
  assert.equal(out.result.parent_name,'Rabbit');
  assert.equal(out.result.child.child_name,'Burrow');
  assert.equal(out.tasks.length,3);
  assert.deepEqual(out.tasks.map(x=>x.requested),['test-nest/parent','test-nest/child','test-nest/grandchild']);
  assert.equal(out.tasks[1].options.name,'Burrow');
  assert.equal(out.seats.name,'Rabbit');
});

test('explicit Parent -> Child option is legal and skips resolver child',async t=>{
  const {house}=await fixture(t);const out=await house.runTool({key:'test-nest/parent-explicit-down'});
  assert.equal(out.result.parent_name,'Rabbit');
  assert.equal(out.result.child.child_name,'Rabbit');
  assert.equal(out.tasks.length,2);
});

test('unbound provided.seats and continuation.seat remain child-local',async t=>{
  const {house}=await fixture(t);
  for(const key of ['test-nest/parent-unbound-provider','test-nest/parent-unbound-continuation']){
    const out=await house.runTool({key});
    assert.equal(out.result.parent_name,'Rabbit');
    assert.equal(out.seats.name,'Rabbit');
  }
});

test('Parent may explicitly select a child return into a different root seat',async t=>{
  const {house}=await fixture(t);const out=await house.runTool({key:'test-nest/parent-explicit-up'});
  assert.equal(out.result.parent_name,'Rabbit');
  assert.equal(out.result.chosen_name,'Burrow');
  assert.deepEqual(out.seats,{name:'Rabbit',chosen_name:'Burrow'});
});

test('sibling task-local same-name seats are isolated',async t=>{
  const {house}=await fixture(t);const out=await house.runTool({key:'test-nest/parent-siblings'});
  assert.equal(out.result.a.local_name,'Alpha');
  assert.equal(out.result.b.child_name,'Burrow');
  assert.deepEqual(out.tasks.map(x=>x.requested),['test-nest/parent-siblings','test-nest/child-a','test-nest/child','test-nest/grandchild']);
});

test('promoted/session seats still inherit by bare name at a later top-level invocation',async t=>{
  const {house}=await fixture(t);const out=await house.runTool({key:'test-nest/promoted-reader',context:{bag:{seats:{name:'Promoted'}}}});
  assert.equal(out.options.name,'Promoted');
  assert.equal(out.result.name,'Promoted');
  assert.equal(out.tasks.length,1);
});
