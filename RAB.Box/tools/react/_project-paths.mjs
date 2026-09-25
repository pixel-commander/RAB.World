import {pathValue} from '../../bridge/project-paths.mjs';
import { createRabMemory } from '../../bridge/rab-memory.mjs';
import path from 'node:path';

export const resolveProjectFolder=async({context,explicit,key,fallback})=>{
  if(explicit)return path.resolve(explicit);
  if(!context?.project?.root)throw Object.assign(new Error('A loaded project is required to resolve a configured path.'),{code:'PROJECT_CONTEXT_REQUIRED'});
  const root=path.resolve(context.project.root);
  const memory=createRabMemory({rabHome:context.rab_home});
  const settings=await memory.readProjectSettings(context.project);
  const configured=pathValue(settings?.paths?.[key])??fallback;
  return path.isAbsolute(configured)?path.resolve(configured):path.resolve(root,configured);
};
