import { glob } from 'node:fs/promises';
import path from 'node:path';

const extensions=['ts','tsx','js','jsx','mjs','cjs'];
const excluded=['node_modules/**','.git/**','.rab/**','dist/**','build/**','coverage/**','.next/**','out/**'];

export const run=async({options,context,tool,helpers})=>{
  const sourceFolder=options.folder??context?.project?.root;
  if(!sourceFolder) throw Object.assign(new Error(`${tool.key}: folder or loaded project is required.`),{code:'INPUT_REQUIRED'});
  const folder=path.resolve(sourceFolder);
  const counts={};
  for(const ext of extensions){let count=0;for await(const _ of glob(`**/*.${ext}`,{cwd:folder,exclude:excluded}))count++;counts[ext]=count;}
  const present=extensions.filter(ext=>counts[ext]>0);
  const hasTs=counts.ts+counts.tsx>0,hasJs=counts.js+counts.jsx+counts.mjs+counts.cjs>0;
  const language=hasTs&&hasJs?'mixed':hasTs?'typescript':hasJs?'javascript':'unknown';
  const saved=[];
  if(context?.project&&context?.rab_home){
    saved.push(await helpers.setProjectFact('script_extensions',present,tool.key));
    saved.push(await helpers.setProjectFact('script_language',language,tool.key));
  }
  return{status:'determined',folder,language,extensions:present,counts,saved_to_project:Boolean(saved.length),continuation:{seat:'script_extensions',value:present}};
};
