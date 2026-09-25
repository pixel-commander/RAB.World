import path from 'node:path';
import { CODE_EXTS, walkFilesByExt, readText, rel, slash, lineNumberAt } from '../_shared.mjs';

const rowsForLineRegex = (sourceFolder,file,text,regex,kind) => {
  const rows=[];
  text.split(/\r?\n/).forEach((line,i)=>{ regex.lastIndex=0; for(const m of line.matchAll(regex)) rows.push({file:rel(sourceFolder,file),line:i+1,column:(m.index??0)+1,kind,text:line.trim()}); });
  return rows;
};

const balancedBlock = (text,start) => {
  const open=text.indexOf('{',start); if(open<0)return null;
  let depth=0, quote=null, esc=false;
  for(let i=open;i<text.length;i++){
    const c=text[i];
    if(quote){ if(esc)esc=false; else if(c==='\\')esc=true; else if(c===quote)quote=null; continue; }
    if(c==='"'||c==="'"||c==='`'){quote=c;continue;}
    if(c==='{')depth++; else if(c==='}'&&--depth===0)return{open,close:i,body:text.slice(open+1,i)};
  }
  return null;
};

export const runSyntax = async ({sourceFolder,tool}) => {
  const type=tool.meta.config?.type;
  const files=await walkFilesByExt(sourceFolder,CODE_EXTS); const rows=[];
  for(const file of files){
    const text=await readText(file);
    if(type==='empty-catch'){
      const re=/catch\s*(?:\([^)]*\))?\s*\{\s*\}/g; for(const m of text.matchAll(re)) rows.push({file:rel(sourceFolder,file),line:lineNumberAt(text,m.index??0),kind:'empty-catch',text:m[0].trim()});
    } else if(type==='swallowed-errors'){
      const re=/catch\s*\(\s*([A-Za-z_$][\w$]*)\s*\)/g; for(const m of text.matchAll(re)){const block=balancedBlock(text,(m.index??0)+m[0].length);if(block&&!new RegExp(`\\b${m[1]}\\b`).test(block.body))rows.push({file:rel(sourceFolder,file),line:lineNumberAt(text,m.index??0),kind:'swallowed-error-candidate',text:m[0],heuristic:true});}
    } else if(type==='eval') rows.push(...rowsForLineRegex(sourceFolder,file,text,/\beval\s*\(/g,'eval-usage'));
    else if(type==='ts-any') rows.push(...rowsForLineRegex(sourceFolder,file,text,/:\s*any\b|\bas\s+any\b|<any>/g,'typescript-any'));
    else if(type==='process-exit') rows.push(...rowsForLineRegex(sourceFolder,file,text,/\bprocess\.exit\s*\(/g,'process-exit'));
    else if(type==='dynamic-import') rows.push(...rowsForLineRegex(sourceFolder,file,text,/\b(?:require|import)\s*\(\s*(?!['"`])/g,'dynamic-import-candidate').map(x=>({...x,heuristic:true})));
    else if(type==='inner-html') rows.push(...rowsForLineRegex(sourceFolder,file,text,/\.(?:innerHTML|outerHTML)\s*=/g,'raw-html-assignment'));
    else if(type==='weak-crypto') rows.push(...rowsForLineRegex(sourceFolder,file,text,/\bcreateHash\s*\(\s*['"](?:md5|sha1)['"]|\bcreateCipher\s*\(/gi,'weak-crypto-candidate'));
    else if(type==='cors-wildcard') rows.push(...rowsForLineRegex(sourceFolder,file,text,/Access-Control-Allow-Origin[^\n]*['"]\*['"]|origin\s*:\s*['"]\*['"]/gi,'cors-wildcard-candidate'));
    else if(type==='floating-promises'){
      text.split(/\r?\n/).forEach((line,i)=>{if(/\bfetch\s*\(/.test(line)&&!/^\s*(?:await|return|void)\b/.test(line)&&!/[.]then\s*\(|[.]catch\s*\(/.test(line))rows.push({file:rel(sourceFolder,file),line:i+1,kind:'floating-promise-candidate',text:line.trim(),heuristic:true});});
    } else if(type==='multiple-defaults'){
      const matches=[...text.matchAll(/\bexport\s+default\b/g)]; if(matches.length>1)matches.forEach(m=>rows.push({file:rel(sourceFolder,file),line:lineNumberAt(text,m.index??0),kind:'multiple-default-export',text:'export default'}));
    } else if(type==='shadowed-globals') rows.push(...rowsForLineRegex(sourceFolder,file,text,/\b(?:const|let|var|function|class)\s+(?:window|document|process|console|globalThis|fetch|URL|setTimeout|setInterval)\b/g,'shadowed-global-candidate'));
    else if(type==='missing-returns'){
      const re=/\.(?:map|filter|reduce)\s*\(\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*\{/g; for(const m of text.matchAll(re)){const block=balancedBlock(text,(m.index??0)+m[0].length-1);if(block&&!/\breturn\b/.test(block.body))rows.push({file:rel(sourceFolder,file),line:lineNumberAt(text,m.index??0),kind:'missing-return-candidate',text:m[0].trim(),heuristic:true});}
    } else if(type==='loose-equality') rows.push(...rowsForLineRegex(sourceFolder,file,text,/(?<![=!])==(?!=)|(?<![!])!=(?!=)/g,'loose-equality'));
    else if(type==='magic-numbers'){
      text.split(/\r?\n/).forEach((line,i)=>{if(/^\s*(?:\/\/|\*)/.test(line)||/\bconst\s+[A-Za-z_$][\w$]*\s*=\s*-?\d+(?:\.\d+)?\s*;?\s*$/.test(line))return;for(const m of line.matchAll(/(?<![\w.])-?\b\d{2,}(?:\.\d+)?\b/g))rows.push({file:rel(sourceFolder,file),line:i+1,column:(m.index??0)+1,kind:'magic-number-candidate',value:m[0],text:line.trim(),heuristic:true});});
    }
  }
  rows.sort((a,b)=>a.file.localeCompare(b.file)||a.line-b.line||(a.column??0)-(b.column??0));
  return{status:'ok',scan:tool.address??tool.key,root:slash(path.resolve(sourceFolder)),heuristic:rows.some(x=>x.heuristic),totals:{files_scanned:files.length,matches:rows.length},rows};
};
