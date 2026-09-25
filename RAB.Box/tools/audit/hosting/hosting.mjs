import path from 'node:path';
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { slash } from '../_shared.mjs';
import { maskComments, maskCommentsAndStrings, allMatches, lineOf, compactSnippet, isCodePosition } from '../_scan-helpers.mjs';

const SKIP_DIRS = new Set(['node_modules','.git','.rab','.cache','coverage','.turbo']);
const DEPLOY_DIRS = new Set(['dist','build','out','public']);
const CODE_EXTS = new Set(['.js','.jsx','.ts','.tsx','.mjs','.cjs','.css','.html','.htm']);

const walkAllFiles = async root => {
  const out=[], stack=[path.resolve(root)];
  while(stack.length){
    const dir=stack.pop();
    let entries=[];
    try{entries=await readdir(dir,{withFileTypes:true});}catch{continue;}
    for(const entry of entries){
      const full=path.join(dir,entry.name);
      if(entry.isDirectory()){
        if(!SKIP_DIRS.has(entry.name)) stack.push(full);
      } else if(entry.isFile()) out.push(full);
    }
  }
  return out;
};

const readText = async file => { try{return await readFile(file,'utf8');}catch{return '';} };
const rel = (root,file) => slash(path.relative(root,file));
const rootIsDeployment = root => DEPLOY_DIRS.has(path.basename(root).toLowerCase()) || path.basename(root).toLowerCase()==='.next';
const deploymentScope = (root,file) => {
  if(rootIsDeployment(root)) return true;
  const parts=rel(root,file).split('/');
  if(parts.some(part=>DEPLOY_DIRS.has(part.toLowerCase()))) return true;
  const next=parts.findIndex(part=>part==='.next');
  return next>=0 && (parts[next+1]==='static' || parts[next+1]==='server');
};
const sourceScope = (root,file) => {
  const name=rel(root,file);
  if(/(?:^|\/)(?:verification)(?:\/|$)/i.test(name)) return 'verification';
  if(/(?:^|\/)(?:tests?|__tests__|fixtures?|mocks?)(?:\/|$)/i.test(name)) return 'test';
  if(/(?:^|\/)tools\/audit(?:\/|$)/i.test(name)) return 'audit-tooling';
  if(deploymentScope(root,file)) return 'deployment';
  return 'source';
};
const row = ({root,file=null,source='',index=0,check,kind,confidence='review',text=null,...extra}) => ({
  file:file?rel(root,file):'.', line:file?lineOf(source,index):null, kind, check, confidence,
  text:text ?? (file?compactSnippet(source,index):''), source_scope:file?sourceScope(root,file):'project', ...extra
});

const sourceMapRows = async ({root,files,check}) => {
  const rows=[];
  for(const file of files){
    if(!deploymentScope(root,file) || !/\.(?:js|css)\.map$/i.test(file)) continue;
    const source=await readText(file);
    let parsed=null;
    try{parsed=JSON.parse(source);}catch{}
    rows.push(row({root,file,source,index:0,check,kind:'hosting-source-map',confidence:'high',text:'Production deployment payload contains a source map.',
      asset:path.basename(file).replace(/\.map$/i,''), sources_count:Array.isArray(parsed?.sources)?parsed.sources.length:null,
      embedded_sources:Array.isArray(parsed?.sourcesContent)&&parsed.sourcesContent.some(value=>typeof value==='string'&&value.length>0),
      classification:'exposure-evidence'}));
  }
  return rows;
};

const declaredDependencies = pkg => {
  const out=new Map();
  for(const section of ['dependencies','devDependencies','optionalDependencies','peerDependencies']){
    for(const [name,spec] of Object.entries(pkg?.[section]??{})) out.set(name,{spec:String(spec),section});
  }
  return out;
};

const npmLockRows = ({root,pkg,lock,check}) => {
  const rows=[];
  const declared=declaredDependencies(pkg);
  const rootEntry=lock?.packages?.[''];
  if(rootEntry){
    const locked=declaredDependencies(rootEntry);
    for(const [name,{spec,section}] of declared){
      const got=locked.get(name);
      if(!got) rows.push(row({root,check,kind:'hosting-lockfile-drift',confidence:'high',text:`Declared ${section} dependency is missing from package-lock root metadata.`,package:name,declared:spec,locked:null,manager:'npm'}));
      else if(got.spec!==spec) rows.push(row({root,check,kind:'hosting-lockfile-drift',confidence:'high',text:`Declared dependency spec does not match package-lock root metadata.`,package:name,declared:spec,locked:got.spec,manager:'npm'}));
    }
    return {rows,verification:'package-lock-root-specs'};
  }
  const top=lock?.dependencies??{};
  for(const [name,{spec,section}] of declared){
    if(!Object.hasOwn(top,name)) rows.push(row({root,check,kind:'hosting-lockfile-drift',confidence:'high',text:`Declared ${section} dependency is missing from legacy package-lock dependency metadata.`,package:name,declared:spec,locked:null,manager:'npm'}));
  }
  return {rows,verification:'package-lock-v1-name-presence'};
};

const parsePnpmRootSpecifiers = source => {
  const lines=source.split(/\r?\n/), specs=new Map();
  let inImporters=false,inRoot=false,section=null,current=null,rootIndent=-1,sectionIndent=-1,currentIndent=-1;
  for(const line of lines){
    if(/^importers:\s*$/.test(line)){inImporters=true;continue;}
    if(!inImporters) continue;
    const indent=line.match(/^\s*/)?.[0].length??0;
    const trimmed=line.trim();
    if(!trimmed||trimmed.startsWith('#')) continue;
    if(!inRoot){
      const m=line.match(/^(\s*)\.:\s*$/);
      if(m){inRoot=true;rootIndent=m[1].length;}
      continue;
    }
    if(indent<=rootIndent && !/^\s+/.test(line)) break;
    const sec=line.match(/^(\s*)(dependencies|devDependencies|optionalDependencies|peerDependencies):\s*$/);
    if(sec&&sec[1].length>rootIndent){section=sec[2];sectionIndent=sec[1].length;current=null;continue;}
    if(section){
      if(indent<=sectionIndent){section=null;current=null;continue;}
      const dep=line.match(/^(\s*)([^:#][^:]*):\s*$/);
      if(dep&&dep[1].length>sectionIndent){current=dep[2].trim().replace(/^['"]|['"]$/g,'');currentIndent=dep[1].length;continue;}
      const spec=line.match(/^\s*specifier:\s*(.+?)\s*$/);
      if(current&&spec&&indent>currentIndent) specs.set(current,{spec:spec[1].trim().replace(/^['"]|['"]$/g,''),section});
    }
  }
  return specs;
};

const lockfileRows = async ({root,check}) => {
  const rows=[];
  const packageFile=path.join(root,'package.json');
  if(!existsSync(packageFile)) return {rows,verification:'no-package-json'};
  let pkg;
  try{pkg=JSON.parse(await readText(packageFile));}catch{
    rows.push(row({root,check,kind:'hosting-package-manifest-invalid',confidence:'high',text:'package.json could not be parsed as JSON.'}));
    return {rows,verification:'package-json-invalid'};
  }
  const npmFile=path.join(root,'package-lock.json'), pnpmFile=path.join(root,'pnpm-lock.yaml'), yarnFile=path.join(root,'yarn.lock');
  if(!existsSync(npmFile)&&!existsSync(pnpmFile)&&!existsSync(yarnFile)){
    rows.push(row({root,check,kind:'hosting-missing-lockfile',confidence:'high',text:'package.json exists but no supported package-manager lockfile was found.'}));
    return {rows,verification:'missing'};
  }
  if(existsSync(npmFile)){
    try{
      const lock=JSON.parse(await readText(npmFile));
      return npmLockRows({root,pkg,lock,check});
    }catch{
      rows.push(row({root,check,kind:'hosting-lockfile-invalid',confidence:'high',text:'package-lock.json could not be parsed as JSON.',manager:'npm'}));
      return {rows,verification:'package-lock-invalid'};
    }
  }
  if(existsSync(pnpmFile)){
    const source=await readText(pnpmFile), locked=parsePnpmRootSpecifiers(source), declared=declaredDependencies(pkg);
    if(!locked.size&&declared.size){
      rows.push(row({root,check,kind:'hosting-lockfile-unverified-format',confidence:'review',text:'pnpm-lock.yaml exists, but root importer specifiers could not be deterministically extracted by this static checker.',manager:'pnpm'}));
      return {rows,verification:'pnpm-format-unverified'};
    }
    for(const [name,{spec,section}] of declared){
      const got=locked.get(name);
      if(!got) rows.push(row({root,check,kind:'hosting-lockfile-drift',confidence:'high',text:`Declared ${section} dependency is missing from pnpm root importer metadata.`,package:name,declared:spec,locked:null,manager:'pnpm'}));
      else if(got.spec!==spec) rows.push(row({root,check,kind:'hosting-lockfile-drift',confidence:'high',text:'Declared dependency spec does not match pnpm root importer metadata.',package:name,declared:spec,locked:got.spec,manager:'pnpm'}));
    }
    return {rows,verification:'pnpm-root-specifiers'};
  }
  rows.push(row({root,check,kind:'hosting-lockfile-presence-only',confidence:'informational',text:'yarn.lock is present. This checker does not claim static manifest-spec integrity for Yarn lock syntax.',manager:'yarn'}));
  return {rows,verification:'yarn-presence-only'};
};

const manifestRows = async ({root,files,check}) => {
  const rows=[];
  for(const file of files){
    if(!deploymentScope(root,file)) continue;
    const base=path.basename(file), lower=base.toLowerCase();
    let classification=null,confidence='review',reason='';
    if(/^\.env(?:\..+)?$/i.test(base) && !/^\.env\.(?:example|sample|template)$/i.test(base)){
      classification='environment-file';confidence='high';reason='Environment-value file is present inside the deployment payload.';
    } else if(/^(?:secrets?|credentials?)\.json$/i.test(base) || /service[-_.]?account.*\.json$/i.test(base) || /^(?:kubeconfig|kube\.config)$/i.test(base)){
      classification='credential-manifest';confidence='high';reason='Credential- or cluster-oriented manifest is present inside the deployment payload.';
    } else if(/^serverless\.ya?ml$/i.test(base)){
      classification='infrastructure-manifest';reason='Infrastructure manifest is present in a client/deployment payload; review whether it is intentionally published.';
    } else if(lower==='web.config'){
      classification='server-config';confidence='informational';reason='web.config is present in the deployment payload. This may be required by IIS; review content and intent rather than treating presence as a leak.';
    } else if(/\.tfstate(?:\.backup)?$/i.test(base)){
      classification='infrastructure-state';confidence='high';reason='Terraform state is present in the deployment payload and may contain infrastructure metadata or secrets.';
    }
    if(classification) rows.push(row({root,file,source:'',index:0,check,kind:'hosting-manifest-in-payload',confidence,text:reason,classification}));
  }
  return rows;
};

const debugRows = async ({root,files,check}) => {
  const rows=[];
  const patterns=[
    {re:/\b(?:allowInsecureHTTP|disableProductionAuth|mockAuthToken|bypassAuth|disableAuth)\b/g,kind:'auth-or-transport-bypass',confidence:'high'},
    {re:/\b(?:enableDebugRoutes|debugRoutesEnabled|exposeDebug|enableTestEndpoints)\b/g,kind:'debug-toggle',confidence:'review'}
  ];
  for(const file of files){
    if(!deploymentScope(root,file) || !/\.(?:[cm]?js|jsx|ts|tsx)$/i.test(file)) continue;
    const source=await readText(file), clean=maskComments(source), masked=maskCommentsAndStrings(source);
    for(const pattern of patterns){
      for(const match of allMatches(pattern.re,clean)){
        if(!isCodePosition(masked,match.index)) continue;
        rows.push(row({root,file,source,index:match.index,check,kind:'hosting-debug-code',confidence:pattern.confidence,text:'Deployment-bound code contains an explicit debug or bypass control identifier.',indicator:match[0],classification:pattern.kind}));
      }
    }
  }
  return rows;
};

const minificationRows = async ({root,files,check}) => {
  const rows=[];
  for(const file of files){
    if(!deploymentScope(root,file) || !/\.(?:js|css)$/i.test(file) || /\.min\.(?:js|css)$/i.test(file)) continue;
    let buf;
    try{buf=await readFile(file);}catch{continue;}
    if(buf.length<50_000) continue;
    const source=buf.toString('utf8'), lines=source.split(/\r?\n/), nonempty=lines.filter(x=>x.trim()), avg=nonempty.length?source.length/nonempty.length:source.length;
    const whitespace=(source.match(/\s/g)?.length??0)/Math.max(1,source.length);
    const likelyUnminified=nonempty.length>40 && avg<220 && whitespace>0.08;
    if(likelyUnminified) rows.push(row({root,file,source,index:0,check,kind:'hosting-bundle-optimization-review',confidence:'review',text:'Large deployment bundle appears structurally unminified. This is a performance finding, not a security boundary.',classification:'performance',bytes:buf.length,lines:nonempty.length,average_line_length:Number(avg.toFixed(1)),whitespace_ratio:Number(whitespace.toFixed(3))}));
  }
  return rows;
};

const cspRows = async ({root,files,check}) => {
  const rows=[];
  const evidence=[];
  for(const file of files){
    const scope=sourceScope(root,file);
    if(scope==='test' || scope==='verification' || scope==='audit-tooling') continue;
    const ext=path.extname(file).toLowerCase(), base=path.basename(file).toLowerCase();
    if(!CODE_EXTS.has(ext) && !/^(?:_headers|netlify\.toml|vercel\.json|nginx\.conf|caddyfile|web\.config|.*config\.(?:js|mjs|cjs|ts|json))$/i.test(base)) continue;
    const source=await readText(file), clean=maskComments(source);
    const patterns=[
      {re:/Content-Security-Policy/gi,mechanism:'header-or-meta-literal'},
      {re:/\bhelmet\s*\.\s*contentSecurityPolicy\s*\(/g,mechanism:'helmet-contentSecurityPolicy'},
      {re:/\bhelmet\s*\(\s*\)/g,mechanism:'helmet-defaults'}
    ];
    for(const pattern of patterns){
      for(const match of allMatches(pattern.re,clean)) evidence.push({file,source,index:match.index,mechanism:pattern.mechanism});
    }
  }
  const seen=new Set();
  for(const item of evidence){
    const key=`${item.file}:${item.index}:${item.mechanism}`;
    if(seen.has(key)) continue; seen.add(key);
    rows.push(row({root,file:item.file,source:item.source,index:item.index,check,kind:'hosting-csp-evidence',confidence:item.mechanism==='helmet-defaults'?'review':'high',text:'Content Security Policy configuration evidence was detected.',mechanism:item.mechanism,classification:'evidence'}));
  }
  if(!rows.length) rows.push(row({root,check,kind:'hosting-csp-not-detected',confidence:'review',text:'No CSP configuration evidence was detected in the scanned project files. CSP may still be injected by an external CDN, reverse proxy, or hosting control plane.',classification:'not-detected-here'}));
  return rows;
};

export const run = async ({ options, context, tool }) => {
  const sourceFolder=options.folder ?? context?.project?.root;
  if(!sourceFolder) throw Object.assign(new Error(`${tool.key}: folder or loaded project is required.`),{code:'INPUT_REQUIRED'});
  const root=path.resolve(sourceFolder), check=tool.meta.check, files=await walkAllFiles(root);
  let rows=[], verification=null;
  if(check==='sourcemaps') rows=await sourceMapRows({root,files,check});
  else if(check==='lockfile'){const out=await lockfileRows({root,check});rows=out.rows;verification=out.verification;}
  else if(check==='manifests') rows=await manifestRows({root,files,check});
  else if(check==='debug-code') rows=await debugRows({root,files,check});
  else if(check==='minification') rows=await minificationRows({root,files,check});
  else if(check==='csp-headers') rows=await cspRows({root,files,check});
  else throw Object.assign(new Error(`${tool.key}: unsupported hosting check ${check}`),{code:'BAD_TOOL'});
  rows.sort((a,b)=>String(a.file).localeCompare(String(b.file))||(a.line??0)-(b.line??0));
  return {status:'ok',scan:`hosting-${check}`,root,totals:{files_scanned:files.length,matches:rows.length},...(verification?{verification}:{}),rows};
};
