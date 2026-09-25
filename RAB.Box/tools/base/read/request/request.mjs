import { createRabMemory } from '../../../../bridge/rab-memory.mjs';
export const run=async({options,context})=>createRabMemory({rabHome:context.rab_home}).readRequest(options.id,{scope:options.scope,...(options.project_id!==undefined?{project_id:options.project_id}:options.scope==='project'?{project_id:context.project?.id}:{})});
