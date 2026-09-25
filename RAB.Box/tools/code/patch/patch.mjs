import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
const safeTag=value=>{const tag=String(value??'').trim();if(!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(tag))throw Object.assign(new Error('boundary_tag must be a simple deterministic token.'),{code:'BAD_REQUEST'});return tag;};
const count=(text,needle)=>{let n=0,i=0;while((i=text.indexOf(needle,i))>=0){n++;i+=needle.length;}return n;};
export const run=async({options,context,tool})=>{
  const root=context?.project?.root??process.cwd(), file=path.resolve(root,String(options.file)), tag=safeTag(options.boundary_tag), content=String(options.content??'').trim();
  const start=`/* RAB:START ${tag} */`, end=`/* RAB:END ${tag} */`;let source=await readFile(file,'utf8');const starts=count(source,start),ends=count(source,end);
  if(starts!==ends||starts>1||ends>1)throw Object.assign(new Error(`${tool.key}: malformed or duplicate managed boundaries for ${tag}.`),{code:'MALFORMED_BOUNDARY',starts,ends});
  let next,created=false;
  if(starts===0){if(options.create_if_missing===false)throw Object.assign(new Error(`${tool.key}: managed boundary ${tag} does not exist.`),{code:'BOUNDARY_NOT_FOUND'});const base=source.trimEnd();next=`${base}${base?'\n\n':''}${start}\n${content}\n${end}\n`;created=true;}
  else{const si=source.indexOf(start),ei=source.indexOf(end,si+start.length);if(ei<si)throw Object.assign(new Error(`${tool.key}: end boundary occurs before start boundary.`),{code:'MALFORMED_BOUNDARY'});next=source.slice(0,si+start.length)+`\n${content}\n`+source.slice(ei);}
  if(next===source)return{status:'unchanged',file,boundary_tag:tag,created:false,wrote:false};await writeFile(file,next,'utf8');return{status:created?'created-region':'updated',file,boundary_tag:tag,created,wrote:true,provided:{file}};
};
