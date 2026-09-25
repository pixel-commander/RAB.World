import { canonicalizeShape } from './shape-codec.mjs';
import { createGraph, isDag, topologicalOrder } from './graph.mjs';

export const normalizeAuthority = value => {
  const v=String(value ?? 'read').toLowerCase();
  if (['pure','read','write','train'].includes(v)) return v;
  if (v==='0') return 'pure';
  return 'read';
};

export const makeTransition = ({ index, capability, authority, before, returned, after, taskId = null }) => canonicalizeShape({
  index, task_id:taskId, capability, authority:normalizeAuthority(authority), before, returned, after
});

export const validateFlow = flow => {
  const stages=flow?.stages ?? [];
  const ids=stages.map((s,i)=>s.id ?? `stage-${i+1}`);
  const edges=[];
  for(let i=0;i<ids.length-1;i++)edges.push({from:ids[i],to:ids[i+1]});
  const g=createGraph({vertices:ids,edges,directed:true});
  return { ok:isDag(g), graph:g, order:topologicalOrder(g), stages };
};

export const runFlow = async ({ flow, initialShape = {}, invoke }) => {
  const checked=validateFlow(flow); if(!checked.ok) throw Object.assign(new Error('Flow contains a cycle.'),{code:'FLOW_CYCLE'});
  let current=canonicalizeShape(initialShape); const transitions=[];
  for(let i=0;i<checked.stages.length;i++){
    const stage=checked.stages[i]; const before=canonicalizeShape(current);
    const returned=canonicalizeShape(await invoke(stage,current));
    current=canonicalizeShape({ ...current, ...(returned?.seats ?? returned ?? {}) });
    transitions.push(makeTransition({index:i+1,capability:stage.capability??stage.id,authority:stage.authority,before,returned,after:current}));
  }
  return { shape:current, transitions, flow:checked };
};
