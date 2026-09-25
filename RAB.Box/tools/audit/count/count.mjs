import path from 'node:path';
import { glob } from 'node:fs/promises';
import { CODE_EXTS, walkFilesByExt, readText, rel, slash } from '../_shared.mjs';
import { buildClassIndex } from '../_engines/class-search.mjs';

const excluded=['node_modules/**','.git/**','.rab/**','dist/**','build/**','coverage/**','.next/**','out/**'];

export const run=async({options,context,tool,helpers})=>{
  const sourceFolder=options.folder??context?.project?.root;
  if(!sourceFolder)throw Object.assign(new Error(`${tool.key}: folder or loaded project is required.`),{code:'INPUT_REQUIRED'});
  const folder=path.resolve(sourceFolder);
  if(tool?.meta?.target_type==='class'){
    const definitions=await helpers.runTool({key:'find-class-definitions',options:{folder},context});
    const assignments=await helpers.runTool({key:'find-class-names',options:{folder},context});
    const defined=definitions.result.source_snapshot?.files,assigned=assignments.result.source_snapshot?.files;
    const sourceHashes=new Map((assigned??[]).map(item=>[item.file,item.sha256]));
    const definitionHashes=new Map((defined??[]).map(item=>[item.file,item.sha256]));
    const consistent=Boolean(defined&&assigned)&&defined.every(item=>sourceHashes.get(item.file)===item.sha256)&&assigned.filter(item=>['.css','.scss','.sass','.less'].includes(path.extname(item.file).toLowerCase())).every(item=>definitionHashes.get(item.file)===item.sha256);
    const skipped=[...new Map([...(definitions.result.skipped??[]),...(assignments.result.skipped??[])].map(item=>[JSON.stringify(item),item])).values()];
    return{status:'ok',scan:tool.address??tool.key,folder:slash(folder),...buildClassIndex(definitions.result,assignments.result),
      scope:{definitions:definitions.result.scope,assignments:assignments.result.scope},skipped,
      source_snapshot:{version:'captured-source/v1',algorithm:'sha256',consistent,files:assigned??[],meaning:'Hashes of captured input bytes; matching shared stylesheet inputs across child scans. Not an atomic filesystem snapshot.'},
      sources:['find-class-definitions','find-class-names']};
  }
  if(tool.meta.aggregate_from){
    const child=await helpers.runTool({key:tool.meta.aggregate_from,options:{folder},context});
    const counts=child.result.counts??[];
    return{status:'ok',scan:tool.address??tool.key,folder:slash(folder),count:counts.reduce((n,row)=>n+row.count,0),unique:counts.length,counts,source:tool.meta.aggregate_from};
  }
  if(tool.meta.target_type==='line'){
    const files=await walkFilesByExt(folder,CODE_EXTS);const rows=[];let count=0;
    for(const file of files){const text=await readText(file);const lines=text===''?0:text.split(/\r?\n/).length;count+=lines;rows.push({file:rel(folder,file),count:lines});}
    rows.sort((a,b)=>a.file.localeCompare(b.file));
    return{status:'ok',scan:tool.address??tool.key,folder:slash(folder),count,files_scanned:files.length,rows};
  }
  let count=0;for await(const entry of glob('**/*',{cwd:folder,exclude:excluded,withFileTypes:true}))if(entry.isFile())count++;
  return{status:'ok',count,folder};
};
