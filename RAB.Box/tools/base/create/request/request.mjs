import { createRabMemory } from '../../../../bridge/rab-memory.mjs';
export const run=async({options,context})=>createRabMemory({rabHome:context.rab_home}).createRequest({...options,...(options.scope==='project'&&options.project_id===undefined?{project_id:context.project?.id}:{})});
