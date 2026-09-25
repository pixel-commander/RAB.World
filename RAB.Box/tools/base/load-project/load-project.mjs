import path from 'node:path';
import { createRabMemory } from '../../../bridge/rab-memory.mjs';
import { projectNames } from '../list-projects/list-projects.mjs';
const low = v => String(v??'').trim().toLowerCase();
export const run = async ({ options, context }) => {
  const memory = createRabMemory({ rabHome: context.rab_home });
  const data = await memory.listProjects();
  const q = low(options.name);
  const matches = data.items.filter(item => low(item.name)===q || low(item.key)===q || low(path.resolve(item.root))===low(path.resolve(options.name)));
  if (!matches.length) return { status:'not-found', query:options.name, matches:[], items:projectNames(data.items) };
  if (matches.length>1) return { status:'ambiguous', query:options.name, matches };
  const project = matches[0];
  const opened = await memory.openProject(project);
  const sessions = await memory.listSessions(project);
  let latest = null;
  if (sessions[0]) latest = await memory.loadSession(project, sessions[0].id);
  return { status:'loaded', project, settings:opened.projectSettings ?? {}, sessions, chat_history: latest?.turns ?? [], last_session: latest };
};
