// One-time authoring receipt: reuse the existing New Tool stamp in an isolated
// staging house, then install its output without regenerating shared registries.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRabMemory } from '../bridge/rab-memory.mjs';
import { createToolHouse } from '../bridge/tool-house.mjs';
import { run as stampTool } from '../tools/base/stamp-new-tool/stamp-new-tool.mjs';
import { renderTemplateTree, writeArtifactPlan } from '../tools/_artifact-plan.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const memory=createRabMemory(), id=await memory.allocateId();
const stage=path.join(memory.rabHome,'temp','test',String(id),'tool-scaffold');
await mkdir(path.join(stage,'tools','base'),{recursive:true});
const house=createToolHouse({root,toolsRoot:path.join(stage,'tools')});
const common=[
  {name:'file',type:'path',title:'Intended file',description:'Project-relative filename, such as src/components/Card/Card.tsx or src/atoms/action.css. Review does not change this file.',required:true},
  {name:'code',type:'textarea',title:'Proposed code',description:'Paste the exact code to check. Static checks only; this code is never executed. Maximum 256 KiB combined with supporting CSS.',required:true},
  {name:'css',type:'textarea',title:'Supporting CSS (optional)',description:'CSS for resolving class-based grid/flex layout in JSX. Only the grids check reads this; it is not written to the project.',required:false}
];
const checks={name:'checks',type:'json',title:'Check groups',description:'Omit for all groups, or supply an array such as ["guards","grids"] or ["atoms"]. Non-applicable groups are reported as skipped.',required:false,default:['guards','grids','atoms']};
const definitions=[
  {name:'code-review',title:'Review Proposed Code',description:'Checks pasted code with existing guards, grids and atoms auditors. Reports findings separately from execution success; saves scratch evidence without changing project source.',settings:[...common,checks],meta:{operation:'inspect',target_type:'code-review',authority:'read',output:'report',group:'all'}},
  {name:'guards',title:'Review Code Guards',description:'Checks pasted JavaScript or TypeScript with the existing Bag/collection guards and prop-renaming auditors.',settings:common,meta:{operation:'inspect',target_type:'code-review',authority:'read',output:'report',group:'guards'}},
  {name:'grids',title:'Review Code Grids',description:'Checks pasted JSX or TSX for Grid to Flex to Grid ancestry, using the existing grid continuity auditor.',settings:common,meta:{operation:'inspect',target_type:'grid',authority:'read',output:'report',group:'grids'}},
  {name:'atoms',title:'Review Code Atoms',description:'Checks pasted CSS with the existing token and state auditors, including duplicate is-active states.',settings:common,meta:{operation:'inspect',target_type:'atom',authority:'read',output:'report',group:'atoms'}},
  {name:'write',title:'Review and Write New File',description:'Reruns selected code checks and creates a new file in the selected project only if they pass. Requires explicit confirmation; existing files are never overwritten.',settings:[...common,checks,{name:'confirm',type:'boolean',title:'Confirm new file write',description:'True permits creation after the checks pass. False or omitted refuses writing.',required:false,default:false}],meta:{operation:'create',target_type:'reviewed-code',authority:'write',output:'file'}}
];
const receipts=[];
for(const definition of definitions){
  const key=definition.name==='code-review'?'base/code-review':`base/code-review/${definition.name}`;
  receipts.push(await stampTool({root:stage,context:{rab_home:memory.rabHome},tool:{root:path.join(root,'tools','base','stamp-new-tool')},helpers:{listTools:house.listTools,findTools:house.findTools},options:{path:key,title:definition.title,description:definition.description,settings:definition.settings,meta:definition.meta,inherit_executor:!['code-review','write'].includes(definition.name)}}));
}
const source=path.join(stage,'tools','base','code-review');
const files=await renderTemplateTree(source);
for(const file of files.filter(file=>file.path.endsWith('settings.json'))){
  const settings=JSON.parse(file.text);settings.meta.domain='code-review';file.text=JSON.stringify(settings,null,2)+'\n';
}
const installed=await writeArtifactPlan({destination:path.join(root,'tools','code-review'),allowedRoot:path.join(root,'tools'),files});
// A one-segment tool path needs an explicit flat address in today's registry.
const registryFile=path.join(root,'PATHS.json'), registry=JSON.parse(await readFile(registryFile,'utf8'));
registry.tools??={};
if(registry.tools['code-review'])throw new Error('code-review address already exists; installed tools need manual reconciliation.');
registry.tools['code-review']={id:receipts[0].id,path:'code-review'};
await writeFile(registryFile,JSON.stringify(registry,null,2)+'\n');
const receipt=path.join(root,'docs','session-audits',`${id}-code-review-scaffold.json`);
await writeFile(receipt,JSON.stringify({id,stage,stamp:'base/stamp-new-tool',receipts,installed},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({receipt,tools:receipts.map(x=>({id:x.id,path:x.path.replace(/^base\//,'')}))},null,2));
