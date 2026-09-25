import { readFile } from 'node:fs/promises';
import { canonicalizeShape, shapeEquals } from './shape-codec.mjs';
import { reduceSeats, substituteReturnedSeats, normalForm } from './seat-reducer.mjs';
import { createGraph, findCycles, isDag, topologicalOrder } from './graph.mjs';
import { runFlow } from './flow-runtime.mjs';

const verdict = ({id, concept, given, expected, actual, rule = null}) => ({
  id, concept, given:canonicalizeShape(given), expected:canonicalizeShape(expected), actual:canonicalizeShape(actual),
  pass:shapeEquals(expected,actual), rule
});

export const runLesson = async (lesson, deps = {}) => {
  const { id, concept, kind, given = {}, expected, rule = null } = lesson;
  let actual;
  switch(kind){
    case 'exact-token': {
      const known=new Set(given.known??[]); actual={ token:given.token, state:known.has(given.token)?'known':'unknown' }; break;
    }
    case 'shape-equals': actual=canonicalizeShape(given.actual); break;
    case 'type-check': {
      const ok = given.type==='path' ? typeof given.value==='string' && given.value.length>0 :
        given.type==='string' ? typeof given.value==='string' :
        given.type==='boolean' ? typeof given.value==='boolean' : true;
      actual={ ok, code:ok?'OK':'TYPE_MISMATCH' }; break;
    }
    case 'reduce-layers': actual=reduceSeats({current:given.current,layers:given.layers}).values; break;
    case 'substitute-returned': actual=substituteReturnedSeats({parent:given.parent,returned:given.returned,bindings:given.bindings,childOwner:given.child_owner}).values; break;
    case 'normal-form': actual={state:normalForm(given)}; break;
    case 'graph-cycle': {
      const g=createGraph(given.graph); actual={ dag:isDag(g), cycles:findCycles(g) }; break;
    }
    case 'graph-order': {
      const g=createGraph(given.graph); actual={ order:topologicalOrder(g) }; break;
    }
    case 'flow': {
      const out=await runFlow({flow:given.flow,initialShape:given.initial_shape,invoke:deps.invoke ?? (async stage=>stage.returned??{})});
      actual={shape:out.shape,transitions:out.transitions.map(t=>({capability:t.capability,before:t.before,returned:t.returned,after:t.after}))}; break;
    }
    case 'authority': {
      const allowed={pure:['shape'],read:['shape','world-read'],write:['shape','world-read','world-write'],train:['shape','training-write']};
      actual={allowed:(allowed[given.authority]??[]).includes(given.action)}; break;
    }
    case 'verification': actual={promote:Boolean(given.executed&&given.verified)}; break;
    case 'receipt': actual={before:given.before,rule:given.rule,consumed:given.consumed,returned:given.returned,after:given.after,verdict:given.verdict}; break;
    case 'house-law': actual={pass:Boolean(given.condition===given.required)}; break;
    default: throw Object.assign(new Error(`Unknown lesson kind: ${kind}`),{code:'LESSON_KIND'});
  }
  return verdict({id,concept,given,expected,actual,rule});
};

export const loadLesson = async file => JSON.parse(await readFile(file,'utf8'));
export const runLessonFile = async (file,deps={}) => runLesson(await loadLesson(file),deps);
