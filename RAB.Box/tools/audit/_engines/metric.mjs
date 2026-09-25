import path from 'node:path';
import { CODE_EXTS, walkFilesByExt, readText, rel, slash } from '../_shared.mjs';

const functionSpanCandidates=(text,threshold,file,root)=>{
  const lines=text.split(/\r?\n/),rows=[]; let start=null,depth=0;
  for(let i=0;i<lines.length;i++){
    const line=lines[i];
    if(start===null && (/\bfunction\b/.test(line)||/=>\s*\{/.test(line)) && line.includes('{')) {start=i;depth=(line.match(/\{/g)||[]).length-(line.match(/\}/g)||[]).length;continue;}
    if(start!==null){depth+=(line.match(/\{/g)||[]).length-(line.match(/\}/g)||[]).length;if(depth<=0){const span=i-start+1;if(span>threshold)rows.push({file:rel(root,file),line:start+1,value:span,kind:'huge-function-candidate',heuristic:true});start=null;depth=0;}}
  } return rows;
};

export const runMetric=async({sourceFolder,tool})=>{
  const cfg=tool.meta.config??{},files=await walkFilesByExt(sourceFolder,CODE_EXTS),rows=[];
  for(const file of files){const text=await readText(file),lines=text.split(/\r?\n/);
    if(cfg.metric==='large-files'&&lines.length>cfg.threshold)rows.push({file:rel(sourceFolder,file),value:lines.length,kind:'large-file'});
    else if(cfg.metric==='long-lines')lines.forEach((line,i)=>{if(line.length>cfg.threshold)rows.push({file:rel(sourceFolder,file),line:i+1,value:line.length,kind:'long-line',text:line.slice(0,160)});});
    else if(cfg.metric==='deep-nesting')lines.forEach((line,i)=>{const spaces=(line.match(/^\s*/)?.[0]??'').replace(/\t/g,'    ').length;if(spaces>=cfg.threshold&&/^\s*(?:if|for|while|switch|try|catch)\b/.test(line))rows.push({file:rel(sourceFolder,file),line:i+1,value:spaces,kind:'deep-nesting-candidate',text:line.trim(),heuristic:true});});
    else if(cfg.metric==='conditional-density')lines.forEach((line,i)=>{const count=(line.match(/&&|\|\||\?(?!\.)/g)||[]).length;if(count>=cfg.threshold)rows.push({file:rel(sourceFolder,file),line:i+1,value:count,kind:'conditional-operator-density',text:line.trim(),heuristic:true});});
    else if(cfg.metric==='huge-functions')rows.push(...functionSpanCandidates(text,cfg.threshold,file,sourceFolder));
  }
  rows.sort((a,b)=>a.file.localeCompare(b.file)||(a.line??0)-(b.line??0));return{status:'ok',scan:tool.address??tool.key,root:slash(path.resolve(sourceFolder)),heuristic:rows.some(x=>x.heuristic),totals:{files_scanned:files.length,matches:rows.length},rows};
};
