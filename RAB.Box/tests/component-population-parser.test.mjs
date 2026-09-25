import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSeatParser } from '../bridge/seat-parser.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const parser=await createSeatParser({languageRoot:path.join(root,'language')});
const population={domain:'react',populationTarget:{name:'PageShell',file:'src/components/PageShell/PageShell.tsx'}};
const evidence=(frame,seat)=>frame.evidence.find(item=>item.seat===seat)?.value;

// The dialogue's selected destination is bound by the planner; the parser must
// preserve the inserted component and each literal DOM address independently.
test('population splits component insertion and DOM creation with their exact areas',()=>{
  const result=parser.parse('add SiteNav to header and add a div with class container-main to data-area main',{context:population});
  assert.equal(result.frames.length,2);
  assert.equal(result.complete,true,JSON.stringify(result.gaps));
  const [insert,element]=result.frames;
  assert.equal(insert.seats.operation,'insert');
  assert.equal(insert.seats.target_type,'component-use');
  assert.equal(insert.seats.name,'SiteNav');
  assert.equal(insert.seats.target,null);
  assert.equal(insert.seats.reference,null);
  assert.equal(evidence(insert,'component'),'SiteNav');
  assert.equal(evidence(insert,'area'),'header');
  assert.equal(element.seats.operation,'create');
  assert.equal(element.seats.target_type,'div');
  assert.equal(element.seats.target,null);
  assert.equal(element.resources[0].name,'container-main');
  assert.equal(evidence(element,'data_area'),'main');
});

test('explicit data-area syntax binds identically with and without equals',()=>{
  for(const marker of ['data-area main','data-area=main','data-area = "main"']){
    const result=parser.parse(`add SiteNav to ${marker} and add div to ${marker}`,{context:population});
    assert.equal(result.complete,true,JSON.stringify(result.gaps));
    assert.equal(evidence(result.frames[0],'area'),'main');
    assert.equal(evidence(result.frames[1],'data_area'),'main');
    assert.equal(result.frames[1].seats.name,null,'a quoted area is an address, not the new element name');
  }
  const custom=parser.parse('add SiteNav to data-area masthead',{context:population}).frames[0];
  assert.equal(custom.seats.operation,'insert');
  assert.equal(evidence(custom,'area'),'masthead');
});

test('known component names and literal area addresses support the population shorthand',()=>{
  for(const area of ['header','main','footer','side','left','right','masthead']){
    const frame=parser.parse(`add sitenav to ${area}`,{context:{componentPopulation:true},knownEntities:[{name:'sitenav',type:'component'}]}).frames[0];
    assert.equal(frame.completeLanguage,true);
    assert.equal(frame.seats.operation,'insert');
    assert.equal(evidence(frame,'component'),'sitenav');
    assert.equal(evidence(frame,'area'),area);
  }
});

test('population shorthand does not redirect creation or explicit component destinations',()=>{
  for(const text of ['add TestOne','add component TestOne','add component Menu to Header','add SiteNav to OtherComponent']){
    const plain=parser.parse(text,{context:{domain:'react'}}).frames[0];
    const selected=parser.parse(text,{context:population}).frames[0];
    assert.deepEqual(selected.seats,plain.seats,text);
    assert.notEqual(selected.seats.target_type,'component-use',text);
  }
  const outside=parser.parse('add SiteNav to header',{context:{domain:'react'}}).frames[0];
  assert.notEqual(outside.seats.target_type,'component-use');
});

test('unknown names, resources, negation and unbound destinations do not gain insertion authority',()=>{
  const cases=[
    ['add sitenav to header',[]],
    ['add SiteNav to OtherComponent',[]],
    ['add SiteNav to header with surprise',[]],
    ['do not add SiteNav to header',[]],
    ['add SiteNav to header',[{name:'SiteNav',type:'atom'}]],
  ];
  for(const [text,knownEntities] of cases){
    const frame=parser.parse(text,{context:population,knownEntities}).frames[0];
    assert.notEqual(frame.seats.target_type,'component-use',text);
  }
});
