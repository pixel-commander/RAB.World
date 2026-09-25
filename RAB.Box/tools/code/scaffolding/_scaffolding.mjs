import { readFile, writeFile, realpath } from 'node:fs/promises';
import path from 'node:path';

const badRequest=message=>Object.assign(new Error(message),{code:'BAD_REQUEST'});
const inputRequired=message=>Object.assign(new Error(message),{code:'INPUT_REQUIRED'});
const slash=value=>String(value).split(path.sep).join('/');

export const resolveArtifactFile=async({options,context})=>{
  const projectRoot=path.resolve(context?.project?.root ?? options.root ?? '.');
  const target=options.file ?? options.path;
  if(!target)throw inputRequired('Provide file or path.');
  const file=path.isAbsolute(target)?path.resolve(target):path.resolve(projectRoot,target);
  if(file!==projectRoot&&!file.startsWith(projectRoot+path.sep))throw badRequest('Target file must stay inside the loaded project.');
  const [projectReal,fileReal]=await Promise.all([realpath(projectRoot),realpath(file)]);
  if(fileReal!==projectReal&&!fileReal.startsWith(projectReal+path.sep))throw badRequest('Target file resolves outside the loaded project.');
  return {projectRoot,file:fileReal,relative:slash(path.relative(projectReal,fileReal))};
};

const attrPattern=/\s+data-rab-seat\s*=\s*(?:"([^"]+)"|'([^']+)'|\{\s*"([^"]+)"\s*\}|\{\s*'([^']+)'\s*\})/g;
const htmlCommentPattern=/<!--\s*\[rab-seat:([^\]]+)\]\s*-->/g;
const jsxCommentPattern=/\{\/\*\s*\[rab-seat:([^\]]+)\]\s*\*\/\}/g;

const collect=(text,re,kind)=>{
  const found=[];
  for(const match of text.matchAll(re)){
    const id=match.slice(1).find(value=>value!==undefined)??null;
    found.push({id,kind,index:match.index,raw:match[0]});
  }
  return found;
};

export const inspectScaffolding=text=>[
  ...collect(text,attrPattern,'attribute'),
  ...collect(text,htmlCommentPattern,'html-comment'),
  ...collect(text,jsxCommentPattern,'jsx-comment')
].sort((a,b)=>a.index-b.index);

export const cleanScaffolding=text=>{
  const markers=inspectScaffolding(text);
  const next=text
    .replace(attrPattern,'')
    .replace(htmlCommentPattern,'')
    .replace(jsxCommentPattern,'');
  return {text:next,markers,changed:next!==text};
};

export const readArtifact=async args=>{
  const resolved=await resolveArtifactFile(args);
  const text=await readFile(resolved.file,'utf8');
  return {...resolved,text};
};

export const writeArtifact=async(file,text)=>writeFile(file,text,'utf8');
