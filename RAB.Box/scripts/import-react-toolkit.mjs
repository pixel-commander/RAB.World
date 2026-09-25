import { readFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRabMemory } from '../bridge/rab-memory.mjs';
import { writeArtifactPlan } from '../tools/_artifact-plan.mjs';

const source=await realpath(process.argv[2]??'');
const destination=process.argv[3];
if(!process.argv[2] || !destination || !path.isAbsolute(destination))throw new Error('Usage: node scripts/import-react-toolkit.mjs <original-template-folder> <new-absolute-toolkit-folder>');
const ids=await createRabMemory().allocateIds(8);
const keys={project:'react/projects/stamp-rraabbiitt',grid:'react/grid/seed/stamp-baseline',atoms:'react/atoms/seed/stamp-baseline',components:'react/components/seed/stamp-site-chrome',hooks:'react/hooks/seed/stamp-use-url',list:'react/components/list/seeds',selected:'react/components/seed/selected'};
const files=[],origins=[];
const add=(file,text)=>files.push({path:file,text});
const json=(file,value)=>add(file,JSON.stringify(value,null,2)+'\n');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const owner=relative=>{
  if(relative.startsWith('src/themes/layout/'))return 'grid';
  if(relative.startsWith('src/themes/dark/') || ['src/css/actions.css','src/css/containers.css'].includes(relative) || relative.startsWith('src/atoms/'))return 'atoms';
  if(relative.startsWith('src/components/') || relative==='src/css/dashboard.css')return 'components';
  if(relative.startsWith('src/hooks/'))return 'hooks';
  return 'project';
};
const visit=async(folder,prefix='')=>{
  for(const entry of await readdir(folder,{withFileTypes:true})){
    if(entry.isSymbolicLink())throw new Error('Source templates must not contain links.');
    const relative=prefix+entry.name,full=path.join(folder,entry.name);
    if(entry.isDirectory()){await visit(full,relative+'/');continue;}
    if(!entry.isFile())throw new Error('Unsupported source entry '+full);
    const bytes=await readFile(full),target=`tools/${keys[owner(relative)]}/template/${relative}`;
    let text=bytes.toString('utf8').replaceAll('[name-kebab]','__NPM_NAME__').replaceAll('[name-title]','__PROJECT_TITLE__').replaceAll('[gen:getTime]','__PROJECT_ID__');
    if(relative==='src/css/actions.css'){
      text=text.replace(/  \.action-(main|muted|nav):active \{[^}]*\}\s*/g,'');
      text=text.replaceAll(":is([aria-current='page'], [aria-selected='true'])",":is(:active, .is-active, [aria-current='page'], [aria-selected='true'])");
    }
    if(relative.endsWith('/SiteNav.tsx'))text=text.replace('site-nav__link action-nav','site-nav__link action-nav is-active');
    if(relative==='src/automation/README.txt')text='AUTOMATION SEAT\nProject settings.json supplies custom_toolkit_path. PATHS.json pins project-specific Tool House aliases by id, path and toolkit. The toolkit stays external. This manifest.json is an empty historical seat, not the Magic Box registry.\n';
    if(relative==='RULES.txt')text=text.replace('S6  STATES (hover, active,','S6  STATES (hover, active, .is-active,').replace('Fix a wrong stamp at src/automation/;\r\n    manifest.json is the catalog.','Fix a wrong stamp in the linked toolkit;\r\n    project PATHS.json owns explicit Box overrides.');
    if(relative==='README.txt')text+='\nMAGIC BOX ADAPTER\nThis copy is produced by the linked external toolkit. settings.json records custom_toolkit_path; PATHS.json pins the new-react-project override. Grid, atoms, useURL and SiteChrome are populated by separate runner-tracked seed stamps. Server originals are unchanged.\n';
    files.push(bytes.includes(0)?{path:target,base64:bytes.toString('base64')}:{path:target,text});
    origins.push({source:full,relative,sha256:digest(bytes),copied_to:target,adapted:!bytes.equals(Buffer.from(text))});
  }
};
await visit(source);
json('settings.json',{id:ids[0],name:path.basename(destination),title:'Magic Box Tools',description:'External React project and seed stamps adapted from the house templates.',settings:[],meta:{kind:'toolkit'}});
const inputName={name:'name',type:'text',title:'Project Name',description:'Lowercase kebab project name.',required:true};
const inputFolder={name:'folder',type:'folder',title:'Project Folder',description:'Absolute output folder. For the project stamp, the parent folder.',required:true};
const custom={name:'custom_toolkit_path',type:'folder',title:'Custom Toolkit Path',description:'Optional external toolkit root saved in the new project settings.json; defaults to this toolkit.',required:false};
const titles={project:'New Rraabbiitt React Project',grid:'Seed React Grid',atoms:'Seed React Atoms',components:'Seed SiteChrome',hooks:'Seed useURL',list:'List React Component Seeds',selected:'Seed Selected React Components'};
for(const [index,[kind,key]] of Object.entries(keys).entries()){
  const isList=kind==='list',isSelected=kind==='selected';
  const settings=isList?[]:[inputName,inputFolder,...(kind==='project'?[custom]:[]),...(isSelected?[{name:'components',type:'json',title:'Components',description:'Array of component-seed numeric IDs or full paths from List React Component Seeds. The complete selection is validated before writing.',required:true}]:[])];
  json(`tools/${key}/settings.json`,{id:ids[index+1],name:path.basename(key),title:titles[kind],description:kind==='project'?'Creates a React project using the house starter and separate grid, atom, hook and component seeds.':titles[kind]+'. Uses declared templates and the shared runner.',settings,meta:{domain:'react',authority:isList?'read':'write',...(kind==='components'?{seed:true}:{}),...(kind==='project'?{operation:'create',target_type:'project'}:{})}});
  add(`tools/${key}/README.txt`,`${titles[kind]}\nPath: ${key}\nInputs and questions: settings.json. Output description: contract.json.\nRead the toolkit-root RULES.txt and the Box external-toolkits guide before changing this tool.\n${isList?'Reads the freshly discovered component seeds; does not execute them.':isSelected?'Accepts an array of available component seed IDs or full paths; validates every selection before runner child calls.':kind==='project'?'Creates the skeleton, then runs the grid, atom, hook and component seed tools. Saves custom_toolkit_path and an explicit project override.':'Owns only its declared template. Uses the shared seed executor and artifact writer; existing files are never overwritten.'}\nVerification: scripts/prove-react-toolkit.mjs in the Box, retained output in .rab/temp/test/<id>, and npm run build in the generated project.\n`);
  if(!['project','list','selected'].includes(kind)){
    add(`tools/${key}/${path.basename(key)}.mjs`,"export { run } from '../../../_seed.mjs';\n");
    json(`tools/${key}/contract.json`,{version:'tool-contract/v1',extends:'../../../_seed.contract.json'});
  }
}
json('tools/react/_seed.contract.json',{version:'tool-contract/v1',source:{kind:'template',description:'Copies one declared seed template into a project, refuses existing files, and verifies written bytes.'},result:{status:'string',folder:'path',verification:'object'}});
add('tools/react/_seed.mjs',`import path from 'node:path';
export const run=async({options,tool,helpers})=>{
  if(!path.isAbsolute(options.folder)||!options.name.match(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/))throw Object.assign(new Error('Use an absolute project folder and a lowercase kebab project name.'),{code:'BAD_INPUT'});
  const title=options.name.split('-').map(word=>word[0].toUpperCase()+word.slice(1)).join(' ');
  const files=await helpers.renderTemplateTree(tool.template,{PROJECT_NAME:options.name,PROJECT_TITLE:title,NPM_NAME:options.name});
  const verification=await helpers.writeArtifactPlan({destination:options.folder,allowedRoot:options.folder,uniqueDirectory:false,files});
  return {status:'created',folder:options.folder,verification};
};
`);
add('tools/react/_component-seeds.mjs',`export const available=async helpers=>{
  const catalog=await helpers.listTools({fresh:true});
  return catalog.items.filter(tool=>tool.kind==='stamp'&&tool.key.startsWith('react/components/seed/')&&tool.meta.seed===true);
};
`);
add(`tools/${keys.list}/seeds.mjs`,`import { available } from '../../../_component-seeds.mjs';
export const run=async({helpers})=>{
  const tools=await available(helpers);
  return {items:tools.map(tool=>({id:tool.id,name:tool.name,title:tool.title,path:tool.path,settings:tool.settings,toolkit:tool.toolkit?.id??null}))};
};
`);
add(`tools/${keys.selected}/selected.mjs`,`import { available } from '../../../_component-seeds.mjs';
export const run=async({options,helpers})=>{
  if(!Array.isArray(options.components)||!options.components.length||options.components.length>64)throw Object.assign(new Error('components must be an array of 1 to 64 available seed IDs or paths.'),{code:'BAD_INPUT'});
  const tools=await available(helpers),selected=[],seen=new Set();
  for(const ref of options.components){
    const tool=tools.find(item=>String(item.id)===String(ref)||item.path===ref);
    if(!tool||seen.has(tool.id))throw Object.assign(new Error('Unavailable or duplicate component seed: '+String(ref)),{code:'BAD_INPUT'});
    seen.add(tool.id);
    const supplied={name:options.name,folder:options.folder};
    const bound=helpers.bindSettings(tool,supplied);
    if(bound.missing.length)throw Object.assign(new Error('Selected component needs additional inputs.'),{code:'INPUT_REQUIRED',details:{missing:bound.missing,safe_to_resume:true}});
    selected.push({tool,options:bound.options});
  }
  const results=[];
  try { for(const selectedSeed of selected){const child=await helpers.runTool({key:String(selectedSeed.tool.id),options:selectedSeed.options});results.push({tool:child.tool,result:child.result,execution_id:child.execution.execution_id});} }
  catch(error){error.details={...error.details,completed_seeds:results.map(item=>({id:item.tool.id,execution_id:item.execution_id})),partial:results.length>0};throw error;}
  return {status:'created',components:results};
};
`);
const seedKeys=[keys.grid,keys.atoms,keys.hooks];
add(`tools/${keys.project}/stamp-rraabbiitt.mjs`,`import path from 'node:path';
import { realpath } from 'node:fs/promises';
const seeds=${JSON.stringify(seedKeys)};
export const run=async({options,tool,helpers})=>{
  if(!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(options.name)||!path.isAbsolute(options.folder))throw Object.assign(new Error('Use a lowercase kebab project name and an absolute parent folder.'),{code:'BAD_INPUT'});
  if(!tool.toolkit)throw Object.assign(new Error('This adapter must be loaded from its linked toolkit.'),{code:'BAD_TOOLKIT'});
  if(options.custom_toolkit_path!==undefined){
    const selected=options.custom_toolkit_path;
    if(typeof selected!=='string'||!path.isAbsolute(selected)||path.relative(await realpath(selected),await realpath(tool.toolkit.root))!=='')throw Object.assign(new Error('This project adapter must retain its own toolkit root so its saved override remains resolvable.'),{code:'BAD_TOOLKIT'});
  }
  await helpers.listTools({fresh:true});
  for(const key of [...seeds,${JSON.stringify(keys.components)},${JSON.stringify(keys.selected)}])await helpers.getTool(key);
  const title=options.name.split('-').map(word=>word[0].toUpperCase()+word.slice(1)).join(' ');
  const project=await helpers.runProjectStamp({templateValues:{PROJECT_TITLE:title,TOOLKIT_ID:tool.toolkit.id,PROJECT_STAMP_ID:tool.id,PROJECT_STAMP_PATH:tool.path}});
  const results=[];
  try {
    for(const key of seeds){const child=await helpers.runTool({key,options:{name:options.name,folder:project.project.root}});results.push({tool:child.tool,result:child.result,execution_id:child.execution.execution_id});}
    const child=await helpers.runTool({key:${JSON.stringify(keys.selected)},options:{name:options.name,folder:project.project.root,components:[${JSON.stringify(keys.components)}]}});
    results.push({tool:child.tool,result:child.result,execution_id:child.execution.execution_id});
  }catch(error){error.details={...error.details,project:project.project,completed_seeds:results.map(item=>item.tool.id),partial:true};throw error;}
  return {...project,seeds:results};
};
`);
json(`tools/${keys.project}/contract.json`,{version:'tool-contract/v1',source:{kind:'composite',description:'Creates the project skeleton through the existing project engine; invokes separate grid, atom, hook and selected-component seeds through the shared runner.'},result:{status:'string',project:'object',settings:'object',verification:'object',seeds:['object']}});
json(`tools/${keys.selected}/contract.json`,{version:'tool-contract/v1',source:{kind:'composite'},result:{status:'string',components:['object']}});
json(`tools/${keys.list}/contract.json`,{version:'tool-contract/v1',source:{kind:'internal'},result:{items:[{id:'number',name:'string',title:'string',path:'string',settings:['object'],toolkit:'number or null'}]}});
json(`tools/${keys.project}/template/settings.json`,{id:'__PROJECT_ID__',name:'__PROJECT_NAME__',type:'react',paths:{components:'src/components',pages:'src/pages',atoms:'src/atoms'}});
add(`tools/${keys.project}/template/PATHS.json`,'{"project":{"id":"__PROJECT_ID__","name":"__PROJECT_NAME__","title":"__PROJECT_TITLE__","description":"React project from the external toolkit."},"stamps":{"new-react-project":{"id":__PROJECT_STAMP_ID__,"path":"__PROJECT_STAMP_PATH__","toolkit":__TOOLKIT_ID__}},"tools":{},"catalogs":{}}\n');
add('README.txt','MAGIC BOX TOOLS\nExternal toolkit, loaded by the existing Box Tool House. Read RULES.txt before adding anything.\n\nReact branches: projects, grid/seed, atoms/seed, components/seed, components/list, hooks/seed. Each template-backed leaf is a stamp-* folder. Every stamp/tool uses settings.json and export run({options,context,tool,root,helpers}).\n\nProject settings.json custom_toolkit_path points here; code is not copied into the project. Project PATHS.json pins explicit overrides. To expose this kit without a selected project: node <box>/scripts/toolkits.mjs link C:/magic-box-tools\n\nSource templates were copied from the server; SOURCE_IMPORT.json records the original hashes and local destinations. Originals are never modified. The standalone factory CLI and settings.js are not executed by discovery.\n');
add('RULES.txt','EXTERNAL TOOLKIT RULES\n1. Follow the Box guide at docs/help/tool-kits/external-toolkits/README.txt.\n2. A tool owns one responsibility; a composite calls helpers.runTool. Never copy the runner or artifact writer.\n3. settings.json uses id, name, title, description, settings, meta. Numeric IDs are stable identities; name matches the folder.\n4. Templates belong in stamp-*/template. Executable tools export run(); discovery reads data only.\n5. Components own structure, atoms own skin. Follow the generated React project RULES.txt and narrow HouseKeys types.\n6. Seed copies known defaults. Add-new creates one named artifact. Components each own a folder; lists use arrays of explicit seed IDs or paths.\n7. Refresh the catalog before selecting/executing seeds. Reject duplicate or missing selections before writing.\n8. Use the shared artifact plan writer; never overwrite existing files. Preserve partial failures and runner receipts.\n9. A project override is explicit id/path/toolkit registration, not a guess from a folder name.\n10. Test generated files and a build. Keep source provenance; change only this toolkit copy.\n');
for(const origin of origins)if(digest(await readFile(origin.source))!==origin.sha256)throw new Error('Source changed during copy: '+origin.source);
json('SOURCE_IMPORT.json',{version:'toolkit-import/v1',source,at:new Date().toISOString(),originals_verified_unchanged:true,files:origins});
const result=await writeArtifactPlan({destination,files});
console.log(JSON.stringify({toolkit_id:ids[0],tools:Object.fromEntries(Object.keys(keys).map((key,index)=>[key,{id:ids[index+1],path:keys[key]}])),source_files:origins.length,verification:result},null,2));
