import { createRabMemory } from '../../../bridge/rab-memory.mjs';
import { getProjectWatcher } from '../../base/watch/watch.mjs';

export const run=async({options,context,tool})=>{
  if(!context?.project||!context?.rab_home) throw Object.assign(new Error(`${tool.key}: loaded project context is required.`),{code:'PROJECT_CONTEXT_REQUIRED'});
  const memory=createRabMemory({rabHome:context.rab_home});
  const result=await memory.removeProjectPath(context.project,options.name,{source:tool.key});
  const listener=await getProjectWatcher({rabHome:context.rab_home}).remove(context,{type:options.name});
  return {status:result.removed?'removed':'not-found',name:options.name,removed:result.removed,listener};
};
