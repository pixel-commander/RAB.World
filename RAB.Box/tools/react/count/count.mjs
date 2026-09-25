import path from 'node:path';
import { findNativeCalls, findReactHookCalls, countReactComponents } from '../_source-glob.mjs';

const resolveExtensions=async({folder,context,helpers})=>{
  const direct=context?.script_extensions;
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
  const resolved=await resolveExtensions({folder,context,helpers});
  if(tool.meta.target_type==='component'){
    const scan=await countReactComponents({folder,extensions:resolved.extensions});
    return{status:'ok',count:scan.count,names:scan.names,files_scanned:scan.files_scanned,files:scan.files,extensions:scan.extensions,extension_source:resolved.source,dependency:resolved.dependency?.tool?{tool:resolved.dependency.tool,result:resolved.dependency.result}:null};
  }
  const symbol=tool.meta.native_symbol??null;
  const scan=symbol?await findNativeCalls({folder,extensions:resolved.extensions,symbol}):await findReactHookCalls({folder,extensions:resolved.extensions});
  return{status:'ok',count:scan.total,symbol,files_scanned:scan.files_scanned,files:scan.files,extensions:scan.extensions,extension_source:resolved.source,dependency:resolved.dependency?.tool?{tool:resolved.dependency.tool,result:resolved.dependency.result}:null};
};
