import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import { writeArtifactPlan } from '../../_artifact-plan.mjs';
import { containedPath } from '../../../engine/src/core.mjs';
export const run=async({options,context})=>{
  if(!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(String(options.name??'')))throw Object.assign(new Error('Atom name must be one lowercase kebab-case class name.'),{code:'BAD_REQUEST'});
  let styles=options.styles;
  if(styles===undefined&&options.token!==undefined){
    if(!/^--[A-Za-z][A-Za-z0-9_-]*$/.test(options.token))throw Object.assign(new Error('Invalid CSS token.'),{code:'BAD_REQUEST'});
    const root=context?.project?.root;
    if(!root)throw Object.assign(new Error('A loaded project is required to validate a registered token.'),{code:'PROJECT_CONTEXT_REQUIRED'});
    const manifest=JSON.parse(await readFile(await containedPath(root,'PATHS.json'),'utf8'));
    const catalog=manifest.catalogs?.tokens;
    if(catalog?.kind!=='json')throw Object.assign(new Error('Project needs a registered JSON token catalog.'),{code:'INPUT_REQUIRED',details:{safe_to_resume:true,missing:[{name:'styles',type:'textarea',title:'CSS declarations'}]}});
    const tokens=JSON.parse(await readFile(await containedPath(root,catalog.path),'utf8'));
    if(!tokens.values?.includes(options.token))throw Object.assign(new Error('Token is not registered in this project.'),{code:'BAD_REQUEST'});
    styles=`background: var(--${options.name}-background, var(${options.token}));`;
  }
  if(styles===undefined)throw Object.assign(new Error('Supply CSS declarations or a registered background token.'),{code:'INPUT_REQUIRED',details:{safe_to_resume:true,missing:[{name:'styles',type:'textarea',title:'CSS declarations'}]}});
  if(/[{}]/.test(String(styles)))throw Object.assign(new Error('Atom styles must be declarations, without rule blocks.'),{code:'BAD_REQUEST'});
  let text=await readFile(new URL('./template/tmpl.css',import.meta.url),'utf8');
  text=text.replaceAll('__ATOM_NAME__',options.name).replaceAll('__ATOM_STYLES__',String(styles).split(/\r?\n/).map(x=>`  ${x}`).join('\n'));
  const file=path.join(path.resolve(options.location),`${options.name}.css`);
  const verification=await writeArtifactPlan({destination:path.dirname(file),allowedRoot:path.dirname(file),uniqueDirectory:false,files:[{path:path.basename(file),text}]});
  return{status:'created',type:'atom',name:options.name,path:file,verification};
};
