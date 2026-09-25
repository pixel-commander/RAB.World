import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createToolHouse } from '../bridge/tool-house.mjs';
import { createRabMemory } from '../bridge/rab-memory.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const toolkitRoot=path.resolve(process.argv[2]??'C:/magic-box-tools');
const metadata=JSON.parse(await readFile(path.join(toolkitRoot,'settings.json'),'utf8'));
const house=createToolHouse({root}),memory=createRabMemory();
const proofId=await memory.allocateId(),folder=path.join(memory.rabHome,'temp','test',String(proofId));
const projectRoot=path.join(folder,'controller');await mkdir(projectRoot,{recursive:true});
const selected=await house.getTool('react/projects/stamp-rraabbiitt');
await writeFile(path.join(projectRoot,'settings.json'),JSON.stringify({name:'toolkit-proof',type:'react',custom_toolkit_path:toolkitRoot},null,2));
await writeFile(path.join(projectRoot,'PATHS.json'),JSON.stringify({project:{id:proofId,name:'toolkit-proof'},stamps:{'new-react-project':{id:selected.id,path:selected.path,toolkit:metadata.id}},tools:{},catalogs:{}},null,2));
const context={project:{id:proofId,name:'toolkit-proof',root:projectRoot},rab_home:memory.rabHome};
const defaultTool=await house.getTool('new-react-project');assert.notEqual(defaultTool.id,selected.id);
const output=await house.runTool({key:'new-react-project',options:{name:'react-toolkit-proof',folder},context});
assert.equal(output.tool.id,selected.id);assert.equal(output.tool.source,'project');
assert.equal(output.result.settings.custom_toolkit_path,toolkitRoot);
assert.equal(output.tasks.length,6);assert.ok(output.tasks.every(task=>task.status==='completed'));
const generated=output.result.project.root;
for(const file of ['src/HouseKeys.types.ts','src/hooks/useURL/useURL.ts','src/themes/layout/grid.css','src/css/actions.css','src/components/site-chrome/SiteChrome.tsx','src/pages/home/Home.tsx'])await access(path.join(generated,file));
const generatedContext={project:output.result.project,rab_home:memory.rabHome};
assert.equal((await house.getTool('new-react-project',{context:generatedContext})).id,selected.id);
const settings=JSON.parse(await readFile(path.join(generated,'settings.json'),'utf8'));
assert.equal(settings.type,'react');assert.equal(settings.custom_toolkit_path,toolkitRoot);
assert.equal((await house.runTool({key:'react/components/list/seeds',context:generatedContext})).result.items.length>=1,true);
let refusal;
try { await house.runTool({key:'new-react-project',options:{name:'react-toolkit-proof',folder},context}); }
catch(error){refusal={code:error.code,status:error.execution?.status};}
assert.equal(refusal?.code,'EEXIST');
const source=JSON.parse(await readFile(path.join(toolkitRoot,'SOURCE_IMPORT.json'),'utf8'));
for(const file of source.files)assert.equal(createHash('sha256').update(await readFile(file.source)).digest('hex'),file.sha256);
const proof={version:'external-toolkit-proof/v1',at:new Date().toISOString(),folder,generated,default_tool:defaultTool.id,selected_tool:output.tool,settings,rerun_refusal:refusal,source_files_unchanged:source.files.length,output};
const file=path.join(folder,'proof.json');await writeFile(file,JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify({file,generated,tasks:output.tasks.map(task=>({id:task.id,tool:task.tool,status:task.status,tracking_file:task.tracking_file})),source_files_unchanged:source.files.length},null,2));
