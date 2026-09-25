const unique = items => [...new Set(items)];
export const createGraph = ({ vertices = [], edges = [], directed = true } = {}) => ({ directed, vertices:unique(vertices), edges:edges.map(edge=>({from:edge.from,to:edge.to,weight:edge.weight ?? 1,type:edge.type ?? null})) });
export const outgoing = (g,v) => g.edges.filter(e=>e.from===v).map(e=>e.to);
export const incoming = (g,v) => g.edges.filter(e=>e.to===v).map(e=>e.from);
export const reverseGraph = g => createGraph({ directed:g.directed, vertices:g.vertices, edges:g.edges.map(e=>({...e,from:e.to,to:e.from})) });
export const reachable = (g,start,goal) => {
  const seen=new Set([start]), q=[start];
  while(q.length){ const v=q.shift(); if(v===goal)return true; for(const n of outgoing(g,v)){ if(!seen.has(n)){seen.add(n);q.push(n);} } }
  return false;
};
export const findCycles = g => {
  const visiting=new Set(), visited=new Set(), cycles=[];
  const walk=(v,path)=>{ if(visiting.has(v)){ const i=path.indexOf(v); cycles.push([...path.slice(i),v]); return; } if(visited.has(v))return; visiting.add(v); path.push(v); for(const n of outgoing(g,v))walk(n,path); path.pop(); visiting.delete(v); visited.add(v); };
  for(const v of g.vertices)walk(v,[]);
  return cycles;
};
export const topologicalOrder = g => {
  const indeg=Object.fromEntries(g.vertices.map(v=>[v,0])); for(const e of g.edges) indeg[e.to]=(indeg[e.to]??0)+1;
  const q=g.vertices.filter(v=>indeg[v]===0).sort(), out=[];
  while(q.length){const v=q.shift();out.push(v);for(const n of outgoing(g,v)){indeg[n]-=1;if(indeg[n]===0){q.push(n);q.sort();}}}
  return out.length===g.vertices.length ? out : null;
};
export const isDag = g => Boolean(topologicalOrder(g));
