import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSeatParser } from '../bridge/seat-parser.mjs';

const ROOT=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const parser=await createSeatParser({languageRoot:path.join(ROOT,'language')});
const shape=text=>parser.parse(text,{context:{domain:'audit'}}).frames[0];

test('builder turns preserve typed className, DOM address, and separate imperatives',()=>{
  const result=parser.parse('add class continer-main to data-area=main  make component CheeseHead with className cotainer-main.');
  assert.equal(result.frames.length,2);
  assert.ok(result.complete);
  assert.equal(result.frames[0].evidence.find(e=>e.seat==='data_area').value,'main');
  assert.equal(result.frames[0].seats.target,null);
  assert.deepEqual(result.frames[1].resources.map(r=>r.name),['cotainer-main']);
});

test('container atom creation differs from attaching an existing atom',()=>{
  const created=parser.parse('add container atom container-floating').frames[0];
  assert.equal(created.seats.target_type,'atom');assert.equal(created.seats.operation,'create');assert.ok(created.completeLanguage);
  const attached=parser.parse('add atom container-floating to component BallSack').frames[0];
  assert.equal(attached.seats.operation,'attach');assert.equal(attached.seats.target,'BallSack');
});

test('quoted content is not split at command words',()=>{
  assert.deepEqual(parser.split('add div with text "make component CheeseHead then add div"'),['add div with text "make component CheeseHead then add div"']);
});

test('surface variants melt to the same audit shape',()=>{
  const a=shape('find all orphaned files').seats;
  const b=shape('show every unused file').seats;
  for(const key of ['domain','operation','target_type','quantifier','predicate','output']) assert.equal(a[key],b[key],key);
});

test('minimal pair find vs count changes operation/output but preserves subject',()=>{
  const a=shape('find all orphaned files').seats;
  const b=shape('count all orphaned files').seats;
  assert.equal(a.target_type,b.target_type);
  assert.equal(a.quantifier,b.quantifier);
  assert.equal(a.predicate,b.predicate);
  assert.equal(a.operation,'find'); assert.equal(a.output,'list');
  assert.equal(b.operation,'count'); assert.equal(b.output,'count');
});

test('strict typo soup becomes language gaps',()=>{
  const result=parser.parse('nd thwies willll sete tehm all fof');
  assert.equal(result.complete,false);
  assert.ok(result.gaps.unknownWords.length>=4);
});

test('same words in opposite nesting order preserve destination',()=>{
  const known=[{name:'Header',type:'component'},{name:'Main',type:'component'}];
  const a=parser.parse('add component Menu to Header',{context:{domain:'react'},knownEntities:known}).frames[0].seats;
  const b=parser.parse('add component Menu to Main',{context:{domain:'react'},knownEntities:known}).frames[0].seats;
  assert.equal(a.operation,'create'); assert.equal(b.operation,'create');
  assert.equal(a.name,'Menu'); assert.equal(b.name,'Menu');
  assert.equal(a.target,'Header'); assert.equal(b.target,'Main');
});

test('class resource does not replace the created div target',()=>{
  const f=parser.parse('add div with class container-main',{context:{domain:'react'},knownEntities:[{name:'container-main',type:'atom'}]}).frames[0];
  assert.equal(f.seats.operation,'create');
  assert.equal(f.seats.target_type,'div');
  assert.equal(f.resources[0].name,'container-main');
  assert.equal(f.completeLanguage,true);
});

test('house verb stamp creates the following artifact instead of stealing the target seat', () => {
  const result = parser.parse('stamp a new react project named Test');
  const frame = result.frames[0];
  assert.equal(frame.seats.operation, 'create');
  assert.equal(frame.seats.target_type, 'project');
  assert.equal(frame.seats.name, 'Test');
});
