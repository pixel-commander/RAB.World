import { glob, readFile } from 'node:fs/promises';
import path from 'node:path';

const allowed = new Set(['ts','tsx','js','jsx','mjs','cjs']);
const excluded = ['node_modules/**','.git/**','.rab/**','dist/**','build/**','coverage/**','.next/**','out/**'];
const cleanExtensions = extensions => [...new Set((extensions ?? []).map(x=>String(x).replace(/^\./,'').toLowerCase()).filter(x=>allowed.has(x)))];
const escaped = text => String(text).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

export const collectScriptFiles = async (folder, extensions) => {
  const cwd=path.resolve(folder);
  const exts=cleanExtensions(extensions);
  const files=new Set();
  for(const ext of exts){
    for await (const relative of glob(`**/*.${ext}`,{cwd,exclude:excluded})) files.add(relative);
  }
  return {cwd,extensions:exts,files:[...files].sort()};
};

export const findNativeCalls = async ({folder,extensions,symbol}) => {
  const source=await collectScriptFiles(folder,extensions);
  const rows=[];
  const re=new RegExp(`\\b${escaped(symbol)}\\s*\\(`,'g');
  const files=source.files;
  for(let start=0;start<files.length;start+=64){
    const batch=files.slice(start,start+64);
    const results=await Promise.all(batch.map(async relative=>{
      const text=await readFile(path.join(source.cwd,relative),'utf8');
      const matches=[]; let match;
      re.lastIndex=0;
      while((match=re.exec(text))){
        const before=text.slice(0,match.index);
        const line=before.split('\n').length;
        const column=match.index-(before.lastIndexOf('\n')+1)+1;
        matches.push({line,column,index:match.index});
      }
      return matches.length?{file:relative,count:matches.length,matches}:null;
    }));
    rows.push(...results.filter(Boolean));
  }
  return {folder:source.cwd,extensions:source.extensions,symbol,total:rows.reduce((n,row)=>n+row.count,0),files_scanned:files.length,files:rows};
};

const indexToLineColumn=(text,index)=>{
  const before=text.slice(0,index);
  return {line:before.split('\n').length,column:index-(before.lastIndexOf('\n')+1)+1,index};
};

export const findReactHookCalls=async({folder,extensions})=>{
  const source=await collectScriptFiles(folder,extensions);
  const rows=[];
  const re=/\b(use[A-Z][A-Za-z0-9_$]*)\s*\(/g;
  for(let start=0;start<source.files.length;start+=64){
    const batch=source.files.slice(start,start+64);
    const results=await Promise.all(batch.map(async relative=>{
      const text=await readFile(path.join(source.cwd,relative),'utf8');
      const matches=[];let match;re.lastIndex=0;
      while((match=re.exec(text))) matches.push({symbol:match[1],...indexToLineColumn(text,match.index)});
      return matches.length?{file:relative,count:matches.length,matches}:null;
    }));
    rows.push(...results.filter(Boolean));
  }
  return {folder:source.cwd,extensions:source.extensions,total:rows.reduce((n,row)=>n+row.count,0),files_scanned:source.files.length,files:rows};
};

export const countReactComponents=async({folder,extensions})=>{
  const source=await collectScriptFiles(folder,extensions);
  const names=new Set(); const rows=[];
  const patterns=[
    /\b(?:export\s+)?(?:default\s+)?function\s+([A-Z][A-Za-z0-9_$]*)\s*\(/g,
    /\b(?:export\s+)?(?:const|let|var)\s+([A-Z][A-Za-z0-9_$]*)\s*=\s*(?:\([^)]*\)|[A-Za-z_$][A-Za-z0-9_$]*)\s*=>/g,
    /\bclass\s+([A-Z][A-Za-z0-9_$]*)\s+extends\s+(?:React\.)?(?:Component|PureComponent)\b/g
  ];
  for(const relative of source.files){
    const text=await readFile(path.join(source.cwd,relative),'utf8'); const fileNames=[];
    for(const re of patterns){let match;re.lastIndex=0;while((match=re.exec(text))){names.add(match[1]);fileNames.push(match[1]);}}
    if(fileNames.length)rows.push({file:relative,names:[...new Set(fileNames)]});
  }
  return {folder:source.cwd,extensions:source.extensions,count:names.size,names:[...names].sort(),files_scanned:source.files.length,files:rows};
};
