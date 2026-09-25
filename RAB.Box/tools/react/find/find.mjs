import path from 'node:path';
import { findNativeCalls, findReactHookCalls } from '../_source-glob.mjs';

const resolveExtensions=async({folder,options,context,helpers})=>{
  const direct=options?.script_extensions??context?.script_extensions;
  if(Array.isArray(direct)&&direct.length)return{extensions:direct,source:'context'};
  if(context?.project&&context?.rab_home){
    const fact=await helpers.getProjectFact('script_extensions');
    if(Array.isArray(fact?.value)&&fact.value.length)return{extensions:fact.value,source:'project-fact'};
  }
  const child=await helpers.runTool({key:'base/determine/script-type',options:{folder},context});
  return{extensions:child.result.extensions,source:'base/determine/script-type',dependency:child};
};

export const run=async({options,context,tool,helpers})=>{
  const sourceFolder=options.folder??context?.project?.root;
  if(!sourceFolder) throw Object.assign(new Error(`${tool.key}: folder or loaded project is required.`),{code:'INPUT_REQUIRED'});
  const folder=path.resolve(sourceFolder);
  const resolved=await resolveExtensions({folder,options,context,helpers});
  const symbol=options.hook??tool.meta.native_symbol??null;
  if(symbol){
    const scan=await findNativeCalls({folder,extensions:resolved.extensions,symbol});
    let matches=scan.files.flatMap(row=>row.matches.map(match=>({file:row.file,symbol,line:match.line,column:match.column,index:match.index})));
    if(tool.meta.quantifier==='one')matches=matches.slice(0,1);
    return{status:'ok',matches,total:matches.length,symbol,files_scanned:scan.files_scanned,extensions:scan.extensions,extension_source:resolved.source,dependency:resolved.dependency?.tool?{tool:resolved.dependency.tool,result:resolved.dependency.result}:null};
  }
  const scan=await findReactHookCalls({folder,extensions:resolved.extensions});
  const matches=scan.files.flatMap(row=>row.matches.map(match=>({file:row.file,...match})));
  return{status:'ok',matches,total:matches.length,symbol:null,files_scanned:scan.files_scanned,extensions:scan.extensions,extension_source:resolved.source,dependency:resolved.dependency?.tool?{tool:resolved.dependency.tool,result:resolved.dependency.result}:null};
};
