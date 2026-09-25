import { createRabMemory } from '../../../bridge/rab-memory.mjs';
export const run = async ({ options, context }) => {
  const memory = createRabMemory({ rabHome: context.rab_home });
  const data = await memory.findProjectsInManifest(options.name);
  return { status: data.items.length ? 'found' : 'not-found', query: options.name, matches: data.items, unavailable:data.unavailable };
};
