import { createRunner } from './index.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const {items,unavailable}=await createRunner({root}).listTools({includeStamps:true});
console.log(JSON.stringify({runner:'Tool House',stamps:items.filter(x=>x.kind==='stamp').map(x=>({id:x.id,path:x.path})),unavailable,authority:'read-only'},null,2));
