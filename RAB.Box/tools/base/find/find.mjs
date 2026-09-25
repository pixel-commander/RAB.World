import path from 'node:path';
import { glob, lstat } from 'node:fs/promises';

const excluded=['node_modules/**','.git/**','.rab/**','dist/**','build/**','coverage/**','.next/**','out/**'];
const clean=value=>String(value??'').trim().replaceAll('\\','/');

export const run=async({options,context,tool})=>{
  const sourceFolder=options.folder??context?.project?.root;
  if(!sourceFolder) throw Object.assign(new Error(`${tool.key}: folder or loaded project is required.`),{code:'INPUT_REQUIRED'});
  const folder=path.resolve(sourceFolder);
  const name=clean(options.name);
  if(!name) throw Object.assign(new Error(`${tool.key}: name is required.`),{code:'INPUT_REQUIRED'});
  const wantFolder=tool.meta.target_type==='folder';
  const out=[];
  for await(const relative of glob('**/*',{cwd:folder,exclude:excluded,withFileTypes:true})){
    const matches=relative.name===name || relative.name.toLowerCase()===name.toLowerCase();
    if(!matches) continue;
    if(wantFolder ? relative.isDirectory() : relative.isFile()) { const parent=relative.parentPath??folder; out.push({name:relative.name,path:path.join(path.isAbsolute(parent)?parent:path.join(folder,parent),relative.name)}); }
  }
  return {status:'ok',target_type:tool.meta.target_type,name,matches:out,total:out.length,...(out.length===1?{provided:{path:out[0].path,value:out[0].path}}:{})};
};
