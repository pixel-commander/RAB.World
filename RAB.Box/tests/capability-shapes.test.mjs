import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSeatParser } from '../bridge/seat-parser.mjs';
import { createCapabilityRegistry } from '../bridge/capabilities.mjs';
import { createToolHouse } from '../bridge/tool-house.mjs';

const ROOT=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const parser=await createSeatParser({languageRoot:path.join(ROOT,'language')});
const registry=await createCapabilityRegistry({projectRoot:path.join(ROOT,'tests/fixtures/stamp-contracts'),seatParser:parser});
const house=createToolHouse({root:ROOT});

test('all registered stamp descriptions compile without language gaps',()=>{
  for (const cap of registry.stamps) assert.equal(cap.descriptionParse?.complete,true,`${cap.name}: ${JSON.stringify(cap.descriptionParse?.gaps)}`);
});

test('Tool House has no unavailable capabilities and audit Tools obey structural metadata',async()=>{
  const scanned=await house.scan({fresh:true});
  assert.deepEqual(scanned.unavailable,[]);
  const audit=scanned.items.filter(cap=>cap.domain==='audit');
  assert.ok(audit.length>0);
  for(const cap of audit){
    assert.equal(cap.meta.domain,'audit',cap.path);
    assert.ok(['read','pure','write','train'].includes(cap.authorityClass),cap.path);
  }
});
