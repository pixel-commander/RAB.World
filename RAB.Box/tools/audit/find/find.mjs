import path from 'node:path';
import { runLinePattern } from '../_engines/line-pattern.mjs';
import { runSyntax } from '../_engines/syntax.mjs';
import { runMetric } from '../_engines/metric.mjs';
import { runStructure } from '../_engines/structure.mjs';
import { scanTheme } from '../_engines/theme.mjs';

export const run=async({options,context,tool})=>{
  const sourceFolder=options.folder??context?.project?.root;
  if(!sourceFolder)throw Object.assign(new Error(`${tool.key}: folder or loaded project is required.`),{code:'INPUT_REQUIRED'});
  const folder=path.resolve(sourceFolder),engine=tool.meta.engine;
  if(engine==='line')return runLinePattern({sourceFolder:folder,tool});
  if(engine==='syntax')return runSyntax({sourceFolder:folder,tool});
  if(engine==='metric')return runMetric({sourceFolder:folder,tool});
  if(engine==='structure')return runStructure({sourceFolder:folder,tool});
  if(engine==='theme')return {...await scanTheme({sourceFolder:folder,type:tool.meta.config?.type}),scan:tool.address??tool.key};
  throw Object.assign(new Error(`${tool.key}: unknown audit engine ${engine}`),{code:'BAD_TOOL'});
};
