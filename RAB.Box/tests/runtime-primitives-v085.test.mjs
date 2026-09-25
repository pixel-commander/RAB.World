import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeShape, decodeShape, shapeEquals, unresolvedSeat } from '../bridge/shape-codec.mjs';
import { reduceSeats, substituteReturnedSeats, normalForm, scopeSeat } from '../bridge/seat-reducer.mjs';
import { createGraph, reverseGraph, reachable, findCycles, topologicalOrder, isDag } from '../bridge/graph.mjs';
import { runFlow, validateFlow } from '../bridge/flow-runtime.mjs';
import { createToolHouse } from '../bridge/tool-house.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('canonical Shape codec round-trips without changing semantic state',()=>{
  const shape={operation:'add',target_type:'component',seats:{components_path:unresolvedSeat('components_path'),name:'TestKit'},meta:{z:2,a:1}};
  const encoded=encodeShape(shape); const decoded=decodeShape(encoded);
  assert.ok(shapeEquals(shape,decoded));
  assert.equal(encoded,encodeShape(decoded));
});

test('seat reduction uses explicit layer order and preserves scoped identity until binding',()=>{
  const reduced=reduceSeats({current:{name:'Old'},layers:[
    {source:'project',owner:'project-1',values:{name:'ProjectName',components_path:'src/components'}},
    {source:'turn',owner:'turn-9',values:{name:'TestKit'}}
  ]});
  assert.equal(reduced.values.name,'TestKit');
  assert.equal(reduced.values.components_path,'src/components');
  const sub=substituteReturnedSeats({parent:{name:'Parent'},returned:{name:'Child',file:'x.tsx'},bindings:{file:'component_file'},childOwner:'task-2'});
  assert.equal(sub.values.name,'Parent');
  assert.equal(sub.values.component_file,'x.tsx');
  assert.equal(sub.applied[0].from,scopeSeat('task-2','file'));
});

test('normal forms distinguish reducible, unresolved, ready, completed and failed',()=>{
  assert.equal(normalForm({required:['name'],values:{},canReduce:true}),'reducible');
  assert.equal(normalForm({required:['name'],values:{},canReduce:false}),'unresolved');
  assert.equal(normalForm({required:['name'],values:{name:'Foo'}}),'ready');
  assert.equal(normalForm({completed:true}),'completed');
  assert.equal(normalForm({failed:true}),'failed');
});

test('graph primitive detects cycles, reverses edges and orders a DAG deterministically',()=>{
  const dag=createGraph({vertices:['parse','reduce','execute'],edges:[{from:'parse',to:'reduce'},{from:'reduce',to:'execute'}]});
  assert.equal(isDag(dag),true); assert.deepEqual(topologicalOrder(dag),['parse','reduce','execute']); assert.equal(reachable(dag,'parse','execute'),true);
  const rev=reverseGraph(dag); assert.equal(reachable(rev,'execute','parse'),true);
  const cyclic=createGraph({vertices:['a','b'],edges:[{from:'a',to:'b'},{from:'b',to:'a'}]});
  assert.equal(isDag(cyclic),false); assert.ok(findCycles(cyclic).length>=1);
});

test('Flow is inspectable data and records BEFORE RETURNED AFTER for every stage',async()=>{
  const flow={id:'demo',stages:[{id:'a',capability:'fill-name',authority:'pure'},{id:'b',capability:'fill-path',authority:'read'}]};
  assert.equal(validateFlow(flow).ok,true);
  const out=await runFlow({flow,initialShape:{},invoke:async stage=>stage.id==='a'?{seats:{name:'TestKit'}}:{seats:{components_path:'src/components'}}});
  assert.deepEqual(out.shape,{components_path:'src/components',name:'TestKit'});
  assert.equal(out.transitions.length,2);
  assert.deepEqual(out.transitions[0].before,{});
  assert.equal(out.transitions[0].returned.seats.name,'TestKit');
  assert.equal(out.transitions[1].after.components_path,'src/components');
});

test('normal Tool execution emits a transition receipt and authority class',async()=>{
  const house=createToolHouse({root});
  const out=await house.runTool({key:'list-projects',options:{},context:{}});
  assert.ok(out.transition);
  assert.equal(out.transition.capability,'list-projects');
  assert.equal(out.tool.authority_class,'read');
  assert.ok(out.transition.before);
  assert.ok(out.transition.after);
});
