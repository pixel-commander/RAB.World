import { createRabMemory } from '../../../../bridge/rab-memory.mjs';
import { assertNumericId } from '../../../../bridge/rab-id.mjs';
import { buildFolderIndex } from '../../_folder-index.mjs';

export const run = async ({ options, context = {} }) => {
  const memory = createRabMemory({ rabHome: context.rab_home });
  const projectId = assertNumericId(options.project_id ?? (context.project ? Number(memory.projectKey(context.project)) : undefined));
  return buildFolderIndex({ memory, projectId, folder: options.folder, maxDurationMs: options.max_duration_ms ?? 300000 });
};
