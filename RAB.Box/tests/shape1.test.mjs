import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSeatParser } from '../bridge/seat-parser.mjs';

const ROOT=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const parser=await createSeatParser({languageRoot:path.join(ROOT,'language')});

const candidate=(shape,text)=>shape.words.find(w=>w.text.toLowerCase()===text.toLowerCase());

test('Shape 1 preserves add ambiguity without choosing a final operation',()=>{
  const s=parser.shape1('add container-main to Header');
  const add=candidate(s,'add');
  assert.ok(add);
  assert.deepEqual(add.candidates[0].types,['verb']);
  assert.ok(add.candidates[0].senses.includes('create'));
  assert.ok(add.candidates[0].senses.includes('attach'));
  assert.ok(add.candidates[0].senses.includes('increment'));
});

test('Shape 1 phrase can cover words that have no standalone lexical entry',()=>{
  const s=parser.shape1('spin up a project');
  assert.equal(s.unknown.length,0);
  const phrase=s.phrases.find(p=>p.text==='spin up');
  assert.ok(phrase);
  assert.ok(phrase.senses.includes('create'));
});

test('Shape 2 can consume a Shape 1 verb phrase without model guessing',()=>{
  const r=parser.parse('spin up a project');
  assert.equal(r.complete,true,JSON.stringify(r.gaps));
  assert.equal(r.frames[0].seats.operation,'create');
  assert.equal(r.frames[0].seats.target_type,'project');
});

test('same Shape 1 word can resolve by grammar position: adjective clear',()=>{
  const s=parser.shape1('the path is clear');
  const clear=candidate(s,'clear');
  assert.equal(clear.candidates.length,2);
  assert.ok(clear.candidates.some(c=>c.types.includes('verb')));
  assert.ok(clear.candidates.some(c=>c.types.includes('adjective')));
  const r=parser.parse('the path is clear');
  assert.equal(r.complete,true,JSON.stringify(r.gaps));
  assert.equal(r.frames[0].seats.predicate,'unobstructed');
  assert.equal(r.frames[0].seats.operation,null);
});

test('same Shape 1 word at verb position does not collapse to adjective meaning',()=>{
  const r=parser.parse('clear the form');
  assert.equal(r.frames[0].seats.predicate,null);
  assert.equal(r.complete,false);
  assert.deepEqual(r.gaps.ambiguousSeats[0].candidates.sort(),['empty','reset']);
});

test('modern Shape 1 additions are available but remain candidates only',()=>{
  for(const [word,sense] of [['pull','retrieve'],['deploy','release'],['hydrate','populate'],['refactor','restructure']]){
    const s=parser.shape1(word);
    const row=candidate(s,word);
    assert.ok(row,word);
    assert.ok(row.candidates.some(c=>c.senses.includes(sense)),`${word} missing ${sense}`);
  }
});
