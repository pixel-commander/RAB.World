import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createSeatParser } from '../bridge/seat-parser.mjs';

const ROOT=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const parser=await createSeatParser({languageRoot:path.join(ROOT,'language')});
const suite=JSON.parse(await readFile(path.join(ROOT,'language','coverage-samples.json'),'utf8'));

for (const sample of suite.samples) test(`language coverage: ${sample.text}`,()=>{
  const result=parser.parse(sample.text,{context:sample.context??{},knownEntities:sample.known??[]});
  if (sample.expect_failure) {
    assert.equal(result.complete,false,'failure sample must remain blocked');
    if (sample.expect_failure==='unknown-word') assert.ok(result.gaps.unknownWords.length>0);
    if (sample.expect_failure==='ambiguous-seat') assert.ok(result.gaps.ambiguousSeats.length>0);
    if (sample.expect_failure==='negation') assert.ok(result.gaps.negation.length>0);
    return;
  }
  assert.equal(result.complete,true,JSON.stringify(result.gaps));
  assert.equal(result.frames.length,1,'coverage samples are single-frame probes');
  const seats=result.frames[0].seats;
  for (const [key,value] of Object.entries(sample.expect??{})) assert.deepEqual(seats[key],value,`${key} mismatch`);
});
