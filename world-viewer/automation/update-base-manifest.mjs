import path from 'node:path';
import { createToolHouse } from '../../RAB.Box/bridge/tool-house.mjs';
const root = path.resolve(import.meta.dirname, '../../RAB.Box');
const result = await createToolHouse({ root }).runTool({ key: 'base/index/manifest' });
console.log(`Updated ${result.result.path}`);
await import('./sync-world.mjs');
