import path from 'node:path';

const GROUPS={
  theme:['find-theme-tokens','find-theme-variables','find-class-names','find-class-definitions','find-component-definitions','find-component-usage','count-components','count-class-usage','count-component-usage','count-theme-token-usage'],
  'generated-code':['find-file-write-sinks','find-user-filename-usage','find-formdata-file-handling','find-executable-file-writes','find-svg-upload-handling','find-public-upload-serving','find-generated-directory-usage','find-generated-provenance-markers','find-path-input-joins'],
  'security-surface':['find-fts5-match-queries','find-fts5-raw-match-concatenation','find-sqlite-open','find-sqlite-extension-loading','find-mysql-query-calls','find-sql-string-interpolation','find-child-process-exec','find-child-process-spawn','find-shell-true','find-command-string-composition','find-wildcard-bindings','find-lan-addresses','find-docker-socket-mounts','find-privileged-containers','find-host-network-mode','find-root-container-user','find-database-port-exposure','find-cleartext-local-protocols','find-admin-routes']
};

export const run=async({options,context,tool,helpers})=>{
  const sourceFolder=options.folder??context?.project?.root;
  if(!sourceFolder)throw Object.assign(new Error(`${tool.key}: folder or loaded project is required.`),{code:'INPUT_REQUIRED'});
  const folder=path.resolve(sourceFolder),group=tool.name,refs=GROUPS[group];
  if(!refs)throw Object.assign(new Error(`Unknown inspect group: ${group}`),{code:'BAD_TOOL'});
  const reports={};
  for(const ref of refs){const child=await helpers.runTool({key:ref,options:{folder},context});reports[ref]=child.result;}
  if(group==='theme'){
    const classUses=reports['count-class-usage']?.counts??reports['find-class-names']?.counts??[];
    const componentUses=reports['count-component-usage']?.counts??reports['find-component-usage']?.counts??[];
    const tokenUses=reports['count-theme-token-usage']?.counts??reports['find-theme-tokens']?.counts??[];
    return{status:'ok',scan:'inspect-theme',root:folder,summary:{declared_components:reports['count-components']?.count??0,unique_classes:classUses.length,unique_components_used:componentUses.length,unique_tokens:tokenUses.length},reports,provided:{seats:{theme_report:{classUses,componentUses,tokenUses}}}};
  }
  const totalMatches=Object.values(reports).reduce((sum,r)=>sum+(r?.totals?.matches??0),0);
  const heuristicMatches=Object.values(reports).reduce((sum,r)=>sum+(r?.heuristic?(r?.totals?.matches??0):0),0);
  return{status:'ok',scan:`inspect-${group}`,root:folder,summary:{tools:refs.length,total_matches:totalMatches,heuristic_matches:heuristicMatches},reports,provided:{seats:{[`${group.replaceAll('-','_')}_report`]:reports}}};
};
