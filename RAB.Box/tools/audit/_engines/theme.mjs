import path from 'node:path';
import { createHash } from 'node:crypto';
import { open } from 'node:fs/promises';
import { CODE_EXTS, STYLE_EXTS, SKIP_DIRS, walkFiles, walkFilesByExt, readText, rel, slash } from '../_shared.mjs';
import { findAssignedClasses, findDefinedClasses } from './class-search.mjs';
const countBy=(rows,key)=>{
  const counts=new Map();for(const row of rows){const value=row[key];if(value)counts.set(value,(counts.get(value)??0)+1);}
  return [...counts].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));
};

const searchText=async file=>{
  const handle=await open(file,'r');
  try{
    const buffer=Buffer.alloc(8192),{bytesRead}=await handle.read(buffer,0,buffer.length,0),prefix=buffer.subarray(0,bytesRead);
    if(prefix?.includes(0))return null;
    try{new TextDecoder('utf-8',{fatal:true}).decode(prefix,{stream:true});}catch{return null;}
    const bytes=await handle.readFile();
    try{return {text:new TextDecoder('utf-8',{fatal:true}).decode(bytes),sha256:createHash('sha256').update(bytes).digest('hex')};}catch{return null;}
  }finally{await handle.close();}
};

export const scanTheme=async({sourceFolder,type})=>{
  const rows=[],skipped=[],excluded=[],snapshot=[];let files=[];
  const walkOptions={onSkipped:item=>(item.reason==='excluded-directory'?excluded:skipped).push(item)};
  const excerpt=(line,index)=>line.slice(Math.max(0,index-40),Math.max(0,index-40)+180).trim();
  if(type==='theme-tokens'||type==='theme-variables'){
    files=await walkFilesByExt(sourceFolder,new Set([...STYLE_EXTS,...CODE_EXTS]));
    for(const file of files){const text=await readText(file),lines=text.split(/\r?\n/);lines.forEach((line,i)=>{
      for(const m of line.matchAll(/(--[a-zA-Z0-9_-]+)\s*:/g))rows.push({file:rel(sourceFolder,file),line:i+1,column:(m.index??0)+1,kind:'token-declaration',token:m[1],text:excerpt(line,m.index??0)});
      for(const m of line.matchAll(/var\(\s*(--[a-zA-Z0-9_-]+)/g))rows.push({file:rel(sourceFolder,file),line:i+1,column:(m.index??0)+1,kind:'token-usage',token:m[1],text:excerpt(line,m.index??0)});
      if(type==='theme-tokens')for(const m of line.matchAll(/(?<![\w/'".-])\b(?:theme|tokens)\.([A-Za-z_$][\w$.-]*)/g))rows.push({file:rel(sourceFolder,file),line:i+1,column:(m.index??0)+1,kind:'theme-property-usage',token:m[1],text:excerpt(line,m.index??0),heuristic:true});
    });}
  } else if(type==='class-names'||type==='class-definitions'){
    files=type==='class-names'?await walkFiles(sourceFolder,walkOptions):await walkFilesByExt(sourceFolder,STYLE_EXTS,walkOptions);
    for(const file of files){
      let captured;try{captured=await searchText(file);}catch(error){skipped.push({file:rel(sourceFolder,file),reason:'read-error',code:error.code});continue;}
      if(captured===null){skipped.push({file:rel(sourceFolder,file),reason:'binary-or-non-utf8'});continue;}
      snapshot.push({file:rel(sourceFolder,file),sha256:captured.sha256});
      const found=type==='class-names'?findAssignedClasses(captured.text,rel(sourceFolder,file),{javascript:CODE_EXTS.has(path.extname(file).toLowerCase())}):findDefinedClasses(captured.text,rel(sourceFolder,file));
      for(const row of found)rows.push(row);
    }
  } else if(type==='component-definitions'){
    files=await walkFilesByExt(sourceFolder,CODE_EXTS);for(const file of files){const text=await readText(file),lines=text.split(/\r?\n/);lines.forEach((line,i)=>{
      const patterns=[/\bfunction\s+([A-Z][A-Za-z0-9_$]*)\s*\(/g,/\b(?:const|let)\s+([A-Z][A-Za-z0-9_$]*)\s*=\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)?\s*=>/g,/\bclass\s+([A-Z][A-Za-z0-9_$]*)\s+extends\s+(?:React\.)?Component\b/g];
      for(const re of patterns)for(const m of line.matchAll(re))rows.push({file:rel(sourceFolder,file),line:i+1,kind:'component-definition',component:m[1],text:line.trim(),heuristic:true});
    });}
  } else if(type==='component-usage'){
    files=await walkFilesByExt(sourceFolder,CODE_EXTS);for(const file of files){const text=await readText(file),lines=text.split(/\r?\n/);lines.forEach((line,i)=>{for(const m of line.matchAll(/<([A-Z][A-Za-z0-9_$.-]*)\b/g))rows.push({file:rel(sourceFolder,file),line:i+1,kind:'component-usage',component:m[1],text:line.trim()});});}
  }
  rows.sort((a,b)=>a.file.localeCompare(b.file)||(a.line??0)-(b.line??0)||String(a.token??a.className??a.component??'').localeCompare(String(b.token??b.className??b.component??'')));
  const classScan=['class-names','class-definitions'].includes(type);
  return{status:'ok',root:slash(path.resolve(sourceFolder)),type,heuristic:rows.some(x=>x.heuristic),totals:{files_scanned:classScan?snapshot.length:files.length,matches:rows.length},rows,counts:type==='class-names'||type==='class-definitions'?countBy(rows,'className'):(type==='component-usage'||type==='component-definitions')?countBy(rows,'component'):countBy(rows,'token'),
    ...(classScan?{scope:{files:type==='class-names'?'UTF-8 text files':[...STYLE_EXTS],excluded_directories:[...SKIP_DIRS],excluded,unsupported_resolution:['runtime expressions','CSS modules','classList calls','spreads','preprocessor expansion']},skipped,source_snapshot:{version:'captured-source/v1',algorithm:'sha256',files:snapshot}}:{} )};
};
