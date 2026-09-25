import { createRabMemory } from '../../../bridge/rab-memory.mjs';
import { getProjectWatcher } from '../../base/watch/watch.mjs';
import { containedPath, relativePath } from '../../../engine/src/core.mjs';

export const run=async({options,context,tool})=>{
  if(!context?.project||!context?.rab_home) throw Object.assign(new Error(`${tool.key}: loaded project context is required.`),{code:'PROJECT_CONTEXT_REQUIRED'});
  const memory=createRabMemory({rabHome:context.rab_home});
  const selected=relativePath(options.path);
  await containedPath(context.project.root,selected,{allowMissing:true});
  const fact=await memory.setProjectPath(context.project,options.name,selected,{source:tool.key,...(options.description!==undefined?{description:options.description}:{}),...(options.types!==undefined?{types:options.types}:{}),...(options.expected!==undefined?{expected:options.expected}:{})});
  const listener=await getProjectWatcher({rabHome:context.rab_home}).add(context,{type:options.name});
  return {status:'saved',provided:{name:options.name,path:fact.value,value:fact.value},path:fact.value,listener};
};
