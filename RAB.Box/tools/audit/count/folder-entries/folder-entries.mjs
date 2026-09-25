import { opendir } from 'node:fs/promises';
import { checkedFolder } from '../../_folder-index.mjs';

export const run = async ({ options }) => {
  const folder = await checkedFolder(options.folder);
  const counts = { files: 0, directories: 0, links: 0, other: 0, entries: 0 };
  for await (const entry of await opendir(folder, { bufferSize: 32 })) {
    counts.entries++;
    if (entry.isSymbolicLink()) counts.links++;
    else if (entry.isFile()) counts.files++;
    else if (entry.isDirectory()) counts.directories++;
    else counts.other++;
  }
  return { status: 'completed', folder, scope: 'direct-folder', counts };
};
