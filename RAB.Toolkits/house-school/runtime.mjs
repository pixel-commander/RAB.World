import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

export const boxRoot = process.env.HOUSE_BOX_ROOT || 'F:/RAB.Box';
export const uiRoot = process.env.HOUSE_UI_ROOT || 'F:/rraabbiitt.ai';
export const boxImport = async (relative) => import(pathToFileURL(path.join(boxRoot, relative)));
export const stamp = await boxImport('tools/_artifact-plan.mjs');
export const legacy = await boxImport('tools/audit/code-review/code-review.mjs');
export const requireUi = createRequire(path.join(uiRoot, 'package.json'));
