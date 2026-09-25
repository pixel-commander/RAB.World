import { createRabMemory } from '../../../../bridge/rab-memory.mjs';
import { assertNumericId } from '../../../../bridge/rab-id.mjs';
import { runFolderBatch } from '../../_folder-batch.mjs';

export const run = async ({ root, options, context = {} }) => {
  const memory = createRabMemory({ rabHome: context.rab_home });
  const projectId = assertNumericId(options.project_id ?? (context.project ? Number(memory.projectKey(context.project)) : undefined));
  return runFolderBatch({ memory, projectId, indexId: assertNumericId(options.index_id), root,
    toolKey: options.tool ?? 'audit/count/folder-entries', options: options.options ?? {}, folderPaths: options.folder_paths,
    timeoutMs: options.timeout_ms ?? 10000, maxDurationMs: options.max_duration_ms ?? 300000 });
};
