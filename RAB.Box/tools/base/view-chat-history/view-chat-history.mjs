import { createRabMemory } from '../../../bridge/rab-memory.mjs';
const low=v=>String(v??'').trim().toLowerCase();
export const run = async ({ options, context }) => {
  const memory=createRabMemory({rabHome:context.rab_home});
  const known=await memory.listProjects();
  const wanted=options.project || context.project?.name || context.project_name;
  if(!wanted) return {status:'input-required',missing:[{name:'project',type:'text',required:true,description:'Which project chat history should I load?'}]};
  const matches=known.items.filter(item=>low(item.name)===low(wanted)||low(item.key)===low(wanted));
  if(!matches.length)return {status:'not-found',project:wanted};
  if(matches.length>1)return {status:'ambiguous',project:wanted,matches};
  const project=matches[0], sessions=await memory.listSessions(project), history=[];
  for(const summary of sessions.slice(0,20)){
    const session=await memory.loadSession(project,summary.id);
    history.push({session_id:session.id,updated_at:session.updated_at,turns:session.turns??[]});
  }
  return {status:'ok',project,history};
};
