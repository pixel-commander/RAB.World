import path from 'node:path';
import { stat } from 'node:fs/promises';
import { scanFiles, read, rel, lineOf, compactSnippet } from '../_scan-helpers.mjs';

const slash=value=>String(value).replaceAll('\\','/');
const VOID=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
const RAW=new Set(['script','style','textarea']);
const exists=async file=>{try{return(await stat(file)).isFile();}catch{return false;}};
const row=({root,file,source,index=0,rule,severity='error',...extra})=>({authority:'rraabbiitt-standards',file:rel(root,file),line:lineOf(source,index),kind:'standards-conformance',rule,severity,text:compactSnippet(source,index),...extra});
const stripRaw=source=>source.replace(/<!--[\s\S]*?-->/g,m=>' '.repeat(m.length)).replace(/<(script|style|textarea)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,m=>m.replace(/[^\n\r]/g,' '));
const attrPairs=text=>{const out=[];const re=/([^\s=/>]+)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/g;for(const m of text.matchAll(re))out.push({name:m[1].toLowerCase(),index:m.index});return out;};
const markupAudit=({root,file,source,svg=false})=>{
  const rows=[], ids=new Map(), stack=[], masked=stripRaw(source), tagRe=/<\s*(\/?)\s*([A-Za-z][\w:-]*)\b([^<>]*?)(\/?)\s*>/g;
  let firstElement=null;
  for(const m of masked.matchAll(tagRe)){
    const closing=Boolean(m[1]), tag=m[2], lower=tag.toLowerCase(), attrs=m[3]??'', self=Boolean(m[4])||VOID.has(lower), idx=m.index??0;
    if(!firstElement&&!closing)firstElement=lower;
    if(closing){
      if(VOID.has(lower)){rows.push(row({root,file,source,index:idx,rule:svg?'SVG006':'HTML005',message:`Void element ${tag} must not have an end tag.`}));continue;}
      if(!stack.length||stack.at(-1).tag!==lower){rows.push(row({root,file,source,index:idx,rule:svg?'SVG004':'HTML002',message:`Closing tag </${tag}> does not match the current open element.`,expected:stack.at(-1)?.tag??null}));const found=stack.map(x=>x.tag).lastIndexOf(lower);if(found>=0)stack.length=found;continue;}
      stack.pop(); continue;
    }
    const attrsFound=attrPairs(attrs), seen=new Set();
    for(const a of attrsFound){if(seen.has(a.name))rows.push(row({root,file,source,index:idx,rule:svg?'SVG005':'HTML004',attribute:a.name,message:`Duplicate attribute ${a.name}.`}));seen.add(a.name);}
    const idMatch=attrs.match(/\bid\s*=\s*["']([^"']+)["']/i);if(idMatch){const id=idMatch[1];if(ids.has(id))rows.push(row({root,file,source,index:idx,rule:svg?'SVG002':'HTML001',id,message:`Duplicate id ${id}.`,first_line:ids.get(id)}));else ids.set(id,lineOf(source,idx));}
    if(!svg&&lower==='img'&&!/\balt\s*=/.test(attrs))rows.push(row({root,file,source,index:idx,rule:'HTML006',severity:'warning',message:'img is missing an explicit alt attribute.'}));
    if(!self&&!RAW.has(lower))stack.push({tag:lower,index:idx});
  }
  for(const open of stack)rows.push(row({root,file,source,index:open.index,rule:svg?'SVG004':'HTML003',message:`Unclosed element <${open.tag}>.`}));
  if(svg&&firstElement!=='svg')rows.push(row({root,file,source,index:0,rule:'SVG001',message:'Standalone SVG document must use <svg> as its root element.'}));
  if(svg){
    for(const m of source.matchAll(/(?:url\(\s*#([^\s)]+)\s*\)|(?:href|xlink:href)\s*=\s*["']#([^"']+)["'])/gi)){const id=m[1]??m[2];if(id&&!ids.has(id))rows.push(row({root,file,source,index:m.index??0,rule:'SVG003',reference:id,message:`Broken local SVG reference #${id}.`}));}
  }
  return rows;
};
const cssAudit=({root,file,source})=>{
  const rows=[];let depth=0,quote=null,comment=false,start=0;
  for(let i=0;i<source.length;i++){
    const ch=source[i], next=source[i+1];
    if(comment){if(ch==='*'&&next==='/'){comment=false;i++;}continue;}
    if(quote){if(ch==='\\'){i++;continue;}if(ch===quote)quote=null;continue;}
    if(ch==='/'&&next==='*'){comment=true;i++;continue;} if(ch==='"'||ch==="'"){quote=ch;continue;}
    if(ch==='{'){if(depth===0)start=i;depth++;}else if(ch==='}'){if(depth===0)rows.push(row({root,file,source,index:i,rule:'CSS001',message:'Unexpected closing brace.'}));else depth--;}
  }
  if(comment)rows.push(row({root,file,source,index:Math.max(0,source.lastIndexOf('/*')),rule:'CSS004',message:'Unclosed CSS comment.'}));
  if(depth>0)rows.push(row({root,file,source,index:start,rule:'CSS001',message:'Unclosed CSS block.'}));
  for(const m of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)){
    const selector=m[1].trim(), body=m[2], base=(m.index??0)+m[0].indexOf('{')+1;
    if(!selector)rows.push(row({root,file,source,index:m.index??0,rule:'CSS003',message:'CSS rule has an empty selector.'}));
    for(const part of body.split(';')){const text=part.trim();if(!text||text.startsWith('@'))continue;const colon=text.indexOf(':');if(colon<=0)rows.push(row({root,file,source,index:base+body.indexOf(part),rule:'CSS002',message:'Malformed declaration; expected property: value.'}));else if(!/^(--[\w-]+|[A-Za-z][\w-]*)$/.test(text.slice(0,colon).trim()))rows.push(row({root,file,source,index:base+body.indexOf(part),rule:'CSS002',message:'Malformed CSS property name.'}));}
  }
  return rows;
};
const idsIn=source=>new Set([...source.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map(x=>x[1]));
const referenceAudit=async({root,file,source})=>{
  const rows=[], localIds=idsIn(source), ext=path.extname(file).toLowerCase();
  const scanSource=['.html','.htm'].includes(ext)?source.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,m=>m.replace(/[^\n\r]/g,' ')):source;
  const patterns=ext==='.css'?[/\burl\(\s*["']?([^"')]+)["']?\s*\)/gi]:[/\b(?:href|src)\s*=\s*["']([^"']+)["']/gi];
  for(const re of patterns)for(const m of scanSource.matchAll(re)){
    const raw=(m[1]??'').trim();if(!raw||/^(?:https?:|data:|mailto:|tel:|javascript:|\/\/)/i.test(raw))continue;
    if(raw.startsWith('#')){const id=raw.slice(1);if(id&&!localIds.has(id))rows.push(row({root,file,source,index:m.index??0,rule:'REF002',reference:raw,message:`Local fragment ${raw} does not exist in this file.`}));continue;}
    const clean=raw.split('?')[0].split('#')[0];if(!clean)continue;
    const target=clean.startsWith('/')?path.resolve(root,'.'+clean):path.resolve(path.dirname(file),clean);
    if(!(await exists(target)))rows.push(row({root,file,source,index:m.index??0,rule:'REF001',reference:raw,target:slash(path.relative(root,target)),message:`Local reference target does not exist: ${raw}`}));
  }
  return rows;
};
export const run=async({options,context,tool})=>{
  const sourceFolder=options.folder??context?.project?.root;if(!sourceFolder)throw Object.assign(new Error(`${tool.key}: folder or loaded project is required.`),{code:'INPUT_REQUIRED'});
  const root=path.resolve(sourceFolder), standard=tool.meta.standard, files=await scanFiles(root), rows=[];let filesScanned=0;
  for(const file of files){if(/(?:^|\/)template(?:\/|$)/i.test(rel(root,file)))continue;const ext=path.extname(file).toLowerCase();const eligible=standard==='html'?['.html','.htm'].includes(ext):standard==='css'?ext==='.css':standard==='svg'?ext==='.svg':['.html','.htm','.svg','.css'].includes(ext);if(!eligible)continue;filesScanned++;const source=await read(file);if(standard==='html')rows.push(...markupAudit({root,file,source}));else if(standard==='css')rows.push(...cssAudit({root,file,source}));else if(standard==='svg')rows.push(...markupAudit({root,file,source,svg:true}));else rows.push(...await referenceAudit({root,file,source}));}
  rows.sort((a,b)=>a.file.localeCompare(b.file)||a.line-b.line||a.rule.localeCompare(b.rule));return{status:'ok',scan:`standards-${standard}`,standard,root,totals:{files_scanned:filesScanned,matches:rows.length},rows};
};
