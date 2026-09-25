import path from 'node:path';
import {readdir,readFile,lstat,mkdir,realpath} from 'node:fs/promises';
import {renderTemplateTree,writeArtifactPlan,checkedAbsolutePath} from '../../../_artifact-plan.mjs';

const fail=(code,message)=>Object.assign(new Error(message),{code});
const inside=(root,file)=>{const relative=path.relative(root,file);return relative===''||(!relative.startsWith(`..${path.sep}`)&&relative!=='..'&&!path.isAbsolute(relative));};

export const inspectUiKitTemplate=async template=>{
  const directories=[];let files=0;
  const walk=async(folder,prefix='',depth=0)=>{
    if(depth>64)throw fail('BAD_TEMPLATE','UI-kit template exceeds the depth limit.');
    for(const entry of await readdir(folder,{withFileTypes:true})){
      if(entry.isSymbolicLink())throw fail('BAD_TEMPLATE','UI-kit template cannot contain links.');
      const relative=prefix?`${prefix}/${entry.name}`:entry.name;
      if(entry.isDirectory()){directories.push(relative);await walk(path.join(folder,entry.name),relative,depth+1);}
      else if(entry.isFile())files++;
      else throw fail('BAD_TEMPLATE',`Unsupported UI-kit template entry: ${relative}`);
      if(files+directories.length>20000)throw fail('BAD_TEMPLATE','UI-kit template exceeds the entry limit.');
    }
  };
  await walk(template);
  return {directories,files};
};

export const run=async({context,tool})=>{
  if(!context?.project?.root)throw fail('PROJECT_CONTEXT_REQUIRED','Select a React project before seeding its UI kit.');
  const root=await realpath(context.project.root);
  const settings=JSON.parse(await readFile(path.join(root,'settings.json'),'utf8'));
  if(settings.type!=='react')throw fail('BAD_PROJECT','The UI-kit seed requires a React project.');
  const template=tool.template??path.join(tool.root,'template');
  const inspected=await inspectUiKitTemplate(template);
  if(!inspected.files&&!inspected.directories.length)throw fail('UI_KIT_TEMPLATE_EMPTY','The UI-kit template is empty; add its folders and files before selecting it.');
  const files=await renderTemplateTree(template);
  for(const relative of inspected.directories){
    const target=await checkedAbsolutePath(path.join(root,relative));
    if(!inside(root,target))throw fail('BAD_TEMPLATE','UI-kit destination leaves the project.');
    try{if(!(await lstat(target)).isDirectory())throw fail('UI_KIT_CONFLICT',`UI-kit folder conflicts with a file: ${relative}`);}
    catch(error){if(error.code!=='ENOENT')throw error;}
  }
  const verification=files.length?await writeArtifactPlan({destination:root,allowedRoot:root,uniqueDirectory:false,files}):{status:'verified',files:[]};
  for(const relative of inspected.directories)await mkdir(path.join(root,relative),{recursive:true});
  for(const relative of inspected.directories)if(!(await lstat(path.join(root,relative))).isDirectory())throw fail('VERIFICATION_FAILED',`UI-kit folder was not created: ${relative}`);
  return {status:'seeded',type:'ui-kit',project:root,files:verification.files.map(file=>path.relative(root,file.path).split(path.sep).join('/')),folders:inspected.directories};
};
