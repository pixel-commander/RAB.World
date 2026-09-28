import {readdir,realpath,stat} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
export const run=async({options={},context={}}={})=>{
 if(typeof options.path!=='string'||!options.path.trim())throw new Error('path is required.');
 const depth=options.depth??0;const limit=depth==='all'?Infinity:Number(depth);
 if(depth!=='all'&&(!Number.isInteger(limit)||limit<0))throw new Error('depth must be a nonnegative integer or all.');
 const scanFiles=options.scan_files??true;if(typeof scanFiles!=='boolean')throw new Error('scan_files must be boolean.');
 const exclude=options.exclude??[];if(!Array.isArray(exclude)||exclude.some(p=>typeof p!=='string'))throw new Error('exclude must be paths.');
 const root=await realpath(options.path);if(!(await stat(root)).isDirectory())throw new Error('path must be a directory.');
 const key=p=>path.resolve(p).toLowerCase();const excluded=exclude.map(p=>key(path.resolve(root,p)));const skip=p=>excluded.some(x=>key(p)===x||key(p).startsWith(x+path.sep));
 const pending=[{path:root,parent:null,depth:0}],items=[],errors=[],skipped=[];let files=0,size=0;
 for(const row of pending){if(skip(row.path)){skipped.push({path:row.path,reason:'excluded'});continue;}
  const item={path:row.path,parent:row.parent,name:path.basename(row.path)||row.path};items.push(item);
  let entries;try{entries=await readdir(row.path,{withFileTypes:true});}catch(error){errors.push({path:row.path,code:error.code});continue;}
  item.folders=[];if(scanFiles)item.files=[];
  for(const entry of entries){const target=path.join(row.path,entry.name);if(entry.name.toLowerCase()==='.gitignore'||(entry.isDirectory()&&['.git','node_modules'].includes(entry.name.toLowerCase()))||entry.isSymbolicLink()||skip(target)){skipped.push({path:target,reason:entry.isSymbolicLink()?'link':'excluded'});continue;}
   if(entry.isDirectory()){item.folders.push(target);if(row.depth<limit)pending.push({path:target,parent:row.path,depth:row.depth+1});}
   else if(scanFiles&&entry.isFile())try{const info=await stat(target);item.files.push({id:randomUUID(),name:entry.name,type:path.extname(entry.name).toLowerCase(),size:info.size});files++;size+=info.size;}catch(error){errors.push({path:target,code:error.code});}
  }
  context.onProgress?.({folders:items.length,files,size,path:row.path});
 }
 return {name:'folder-scan',path:root,items,errors,skipped};
};
