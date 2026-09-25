import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { createToolHouse } from '../bridge/tool-house.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const specs=JSON.parse(await readFile(new URL('./audit-specs.json',import.meta.url),'utf8'));
const house=createToolHouse({root});
let made=0;
for(const spec of specs){
  const existing=await house.getTool(spec.address).catch(()=>null);
  if(existing){console.log('skip',spec.address);continue;}
  const out=await house.runTool({key:'new-tool',options:{path:spec.path,address:spec.address,inherit_executor:true,title:spec.title,description:spec.description,settings:spec.settings,meta:spec.meta}});
  console.log('made',out.result.address,out.result.id,out.result.path);made++;
}
console.log(JSON.stringify({requested:specs.length,made},null,2));
