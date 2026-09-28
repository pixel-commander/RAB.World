import {randomUUID} from 'node:crypto';
import {readdir,stat,realpath} from 'node:fs/promises';
import path from 'node:path';
export const run=async({options={},context={}}={})=>{
 if(typeof options.path!=='string'||!options.path.trim())throw new Error('path is required.');
 if(options.recursive!==undefined&&typeof options.recursive!=='boolean')throw new Error('recursive must be boolean.');
 const exclude=options.exclude??[];if(!Array.isArray(exclude)||exclude.some(x=>typeof x!=='string'))throw new Error('exclude must be paths.');
 const root=await realpath(options.path);if(!(await stat(root)).isDirectory())throw new Error('path must be a folder.');
 const key=p=>path.resolve(p).toLowerCase();const exclusions=exclude.map(p=>key(path.resolve(root,p)));
 const excluded=p=>exclusions.some(x=>key(p)===x||key(p).startsWith(x+path.sep));
 const pending=[root],items=[],errors=[];let count=0,size=0;
 for(const folder of pending){
  if(excluded(folder))continue;
  const groups=new Map(),children=[],issues=[],records=[];
  try{for(const entry of await readdir(folder,{withFileTypes:true})){
   const target=path.join(folder,entry.name);if(entry.name.toLowerCase()==='.gitignore'||(entry.isDirectory()&&['.git','node_modules'].includes(entry.name.toLowerCase()))||entry.isSymbolicLink()||excluded(target))continue;
   if(entry.isDirectory()){children.push(target);if(options.recursive)pending.push(target);continue;}
   if(entry.isFile())try{const info=await stat(target);const type=path.extname(entry.name).toLowerCase();records.push({id:randomUUID(),name:entry.name,type,size:info.size});const group=groups.get(type)??{type,count:0,size:0};group.count++;group.size+=info.size;groups.set(type,group);count++;size+=info.size;context.onProgress?.({folders:items.length,files:count,size,path:target});}catch(error){issues.push({path:target,code:error.code});}
  }}catch(error){issues.push({path:folder,code:error.code});}
  const files=[...groups.values()].sort((a,b)=>a.type.localeCompare(b.type));items.push({path:folder,records,files,folders:children,size:files.reduce((n,x)=>n+x.size,0),errors:issues});errors.push(...issues);
  context.onProgress?.({folders:items.length,files:count,size,path:folder});
 }
 return {path:root,items,errors};
};
