import path from 'node:path';
import { absolute, separate, missing, safeName, text, materialize, originalSource } from './_review.mjs';
export const run = async ({ options, tool, helpers }) => {
  const folder = await absolute(options.folder, 'Session folder');
  const name = safeName(path.basename(folder));
  const source = await originalSource(options.original_source, options.source_access);
  const title = text(options.title ?? name, 'Title');
  separate(source.stored, folder);
  separate(source.accessible, folder);
  separate(path.resolve(tool.root), folder);
  await missing(folder);
  return materialize({tool, helpers, destination: folder, allowedRoot: path.dirname(folder),
    values: { SESSION_NAME: name, SESSION_TITLE: title, ORIGINAL_SOURCE: source.stored },
    enrich: settings => ({...settings, created_at: new Date().toISOString()}) });
};
