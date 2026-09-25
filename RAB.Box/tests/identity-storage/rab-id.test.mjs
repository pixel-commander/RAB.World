import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {assertNumericId,MAX_ID_BATCH,validateIdState,enrollNumericIds,convertLegacyIdState,reserveObservedIds} from '../../bridge/rab-id.mjs';
import {createRabMemory} from '../../bridge/rab-memory.mjs';
const empty=()=>({version:'rab-ids/v2',reserved:[]});
test('numeric IDs reject coercion and invalid numbers',()=>{
 for(const value of [0,-1,1.5,NaN,Infinity,'123',null,false,1n,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>assertNumericId(value),{code:'BAD_ID'});
 assert.equal(assertNumericId(1),1);
});
test('future catalog reservations do not advance current clock',async()=>{
 const state=enrollNumericIds(empty(),[1830100001003,1830100001001]);
 const out=await reserveObservedIds({state,clock:()=>1789920825354});
 assert.deepEqual(out.ids,[1789920825354]);
 assert.deepEqual(state.reserved,[[1830100001001,1830100001001],[1830100001003,1830100001003]]);
 assert.deepEqual(out.state.reserved[0],[1789920825354,1789920825354]);
});
test('repeated and backward clocks wait or use unreserved observed values, never synthesize',async()=>{
 const values=[100,100,99,102];let sleeps=0;
 const result=await reserveObservedIds({state:empty(),count:3,clock:()=>values.shift(),sleep:async()=>{sleeps++;}});
 assert.deepEqual(result.ids,[100,99,102]);assert.equal(sleeps,3);
 assert.deepEqual(result.state.reserved,[[99,100],[102,102]]);
});
test('occupied clock fails bounded and partial batch does not mutate input',async()=>{
 const state=enrollNumericIds(empty(),[100]),before=JSON.stringify(state);
 await assert.rejects(reserveObservedIds({state,clock:()=>100,timeoutMs:0}),{code:'ID_CLOCK_BUSY'});
 await assert.rejects(reserveObservedIds({state:empty(),clock:()=>101,count:2,timeoutMs:0}),{code:'ID_CLOCK_BUSY'});
 assert.equal(JSON.stringify(state),before);
});
test('legacy conversion requires explicit evidence, retains future singleton and provenance',()=>{
 const legacy={version:'rab-ids/v1',highWater:1830100001003};
 assert.throws(()=>validateIdState(legacy),{code:'ID_MIGRATION_REQUIRED'});
 assert.throws(()=>convertLegacyIdState({legacy,knownIds:[]}),{code:'BAD_ID_STATE'});
 const state=convertLegacyIdState({legacy,knownIds:[20,21,50],backupPath:'preserved/id-state.json'});
 assert.deepEqual(state.reserved,[[20,21],[50,50],[1830100001003,1830100001003]]);
 assert.equal(state.legacy_highWater,legacy.highWater);assert.match(state.legacy_limitation,/cannot be reconstructed/);
 assert.equal(legacy.version,'rab-ids/v1');
});
test('invalid batches and corrupt intervals fail closed',async()=>{
 for(const count of [0,-1,1.5,'1',null,MAX_ID_BATCH+1])await assert.rejects(reserveObservedIds({state:empty(),count}),{code:'BAD_ID_RANGE'});
 for(const reserved of [[[0,2]],[[2,1]],[[1,2],[2,4]],[[3,4],[1,2]],[[1,Infinity]]])assert.throws(()=>validateIdState({version:'rab-ids/v2',reserved}),{code:'BAD_ID_STATE'});
});
test('fresh persistent home uses v2, independent memory owners allocate uniquely at actual time',async t=>{
 const home=await mkdtemp(path.join(os.tmpdir(),'rab-clock-test-'));t.after(()=>rm(home,{recursive:true,force:true}));
 const a=createRabMemory({rabHome:home}),b=createRabMemory({rabHome:home});
 await a.ensureHome();const before=Date.now();
 const ids=(await Promise.all([a.allocateIds(4),b.allocateIds(4)])).flat();const after=Date.now();
 assert.equal(new Set(ids).size,8);assert.ok(ids.every(id=>id>=before&&id<=after));
 await a.enrollId([1830100001001,1830100001003]);const next=await a.allocateId();assert.ok(next<=Date.now());assert.ok(next<1830100001001);
 const state=JSON.parse(await readFile(path.join(home,'id-state.json')));assert.equal(state.version,'rab-ids/v2');
});
test('persistent v1 fails closed and preserves exact ledger bytes',async t=>{
 const home=await mkdtemp(path.join(os.tmpdir(),'rab-clock-legacy-'));t.after(()=>rm(home,{recursive:true,force:true}));
 const file=path.join(home,'id-state.json'),bytes='{"version":"rab-ids/v1","highWater":1830100001003}';
 await writeFile(file,bytes);const memory=createRabMemory({rabHome:home});
 await assert.rejects(memory.allocateId(),{code:'ID_MIGRATION_REQUIRED'});
 await assert.rejects(memory.enrollId(42),{code:'ID_MIGRATION_REQUIRED'});
 assert.equal(await readFile(file,'utf8'),bytes);
});
