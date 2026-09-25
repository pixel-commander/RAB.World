import { createRabMemory } from '../../../bridge/rab-memory.mjs';
export const projectNames = projects => [...new Set(projects.map(project=>project.name))];
export const run = async ({ context }) => {
  const memory = createRabMemory({ rabHome: context.rab_home });
  const data = await memory.listProjects();
  return { status:'ok', items:projectNames(data.items) };
};
