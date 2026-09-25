import path from 'node:path';
import { scanFiles, read, rel, isCodeFile, maskComments, maskCommentsAndStrings, allMatches, lineOf, compactSnippet, extractBalancedCall, isCodePosition, splitTopLevelArgs } from '../_scan-helpers.mjs';

const sourceScope = (root,file) => {
  const name=rel(root,file);
  if(/(?:^|\/)(?:verification)(?:\/|$)/i.test(name)) return 'verification';
  if(/(?:^|\/)(?:tests?|__tests__|fixtures?|mocks?)(?:\/|$)/i.test(name)) return 'test';
  if(/(?:^|\/)tools\/audit(?:\/|$)/i.test(name)) return 'audit-tooling';
  return 'runtime';
};

const row = ({ root, file, source, index, target, kind = 'security-finding', confidence = 'review', text, evidence = {} }) => ({
  file:rel(root,file), line:lineOf(source,index), kind, target, confidence, source_scope:sourceScope(root,file), text:text ?? compactSnippet(source,index), ...evidence
});

const jwtFindings = ctx => {
  const {source,clean,masked,root,file,target}=ctx, rows=[];
  const hasJwt=/(?:from\s*['"]jsonwebtoken['"]|require\s*\(\s*['"]jsonwebtoken['"]\s*\)|\bjwt\s*\.)/i.test(source);
  if(!hasJwt)return rows;
  const re=/\b(?:jwt\.)?(?:sign|verify)\s*\(\s*[^,]+,\s*(["'])([^\n"']{6,})\1/g;
  for(const m of allMatches(re,clean)) if(isCodePosition(masked,m.index)) rows.push(row({root,file,source,index:m.index,target,confidence:'high',text:'JWT sign/verify call uses an inline literal secret.',evidence:{secret_source:'inline-literal',redacted:true}}));
  return rows;
};

const regexPatterns = (source, masked) => {
  const out=[];
  for(const m of allMatches(/\/(?![/*])((?:\\.|\[(?:\\.|[^\]])*\]|[^/\n])+)\/[dgimsuvy]*/g,source)) if(isCodePosition(masked,m.index)) out.push({index:m.index,pattern:m[1]});
  for(const m of allMatches(/\bnew\s+RegExp\s*\(\s*(["'])(.*?)\1/g,source)) if(isCodePosition(masked,m.index)) out.push({index:m.index,pattern:m[2]});
  return out;
};
const looksNestedQuantified = pattern => /\((?:\?:)?\s*(?:\\.|\.|\[[^\]]+\]|[A-Za-z0-9])\s*(?:\+|\*|\{\d+,\})\s*\)\s*(?:\+|\*|\{\d+,\})/.test(pattern);
const redosFindings = ({source,clean,masked,root,file,target}) => regexPatterns(clean,masked).filter(x=>looksNestedQuantified(x.pattern)).map(x=>row({root,file,source,index:x.index,target,confidence:'review',text:'Regular expression contains a directly nested quantified atom and requires ReDoS review.',evidence:{pattern:x.pattern.slice(0,120)}}));

const tlsFindings = ({source,clean,masked,root,file,target}) => {
  const rows=[];
  for(const m of allMatches(/\brejectUnauthorized\s*:\s*false\b/g,clean)) if(isCodePosition(masked,m.index)) rows.push(row({root,file,source,index:m.index,target,confidence:'high',text:'TLS certificate verification is explicitly disabled.',evidence:{setting:'rejectUnauthorized',value:false}}));
  for(const m of allMatches(/\bNODE_TLS_REJECT_UNAUTHORIZED\b\s*(?:=|:)\s*["']?0["']?/g,clean)) if(isCodePosition(masked,m.index)) rows.push(row({root,file,source,index:m.index,target,confidence:'high',text:'NODE_TLS_REJECT_UNAUTHORIZED is explicitly disabled.',evidence:{setting:'NODE_TLS_REJECT_UNAUTHORIZED',value:'0'}}));
  for(const m of allMatches(/\bminVersion\s*:\s*["']TLSv1(?:\.0)?["']/g,clean)) if(isCodePosition(masked,m.index)) rows.push(row({root,file,source,index:m.index,target,confidence:'review',text:'TLS minimum version permits TLS 1.0.',evidence:{setting:'minVersion',value:'TLSv1'}}));
  return rows;
};

const sqlFindings = ({source,clean,masked,root,file,target}) => {
  const rows=[];
  for(const m of allMatches(/\.(?:query|execute|raw)\s*\(\s*`([\s\S]{0,1200}?\$\{[\s\S]{0,400}?\}[\s\S]{0,1200}?)`/g,clean)) {
    if(isCodePosition(masked,m.index)&&/\b(?:SELECT|INSERT|UPDATE|DELETE|REPLACE|WITH)\b/i.test(m[1])) rows.push(row({root,file,source,index:m.index,target,confidence:'high',text:'Database execution sink receives interpolated SQL template text.',evidence:{sink:'query/execute/raw',dynamic:'template-interpolation'}}));
  }
  for(const m of allMatches(/\.(?:query|execute|raw)\s*\(\s*(["'])([^\n]{0,800}\b(?:SELECT|INSERT|UPDATE|DELETE|REPLACE|WITH)\b[^\n]{0,800})\1\s*\+\s*[A-Za-z_$]/gi,clean)) if(isCodePosition(masked,m.index)) rows.push(row({root,file,source,index:m.index,target,confidence:'high',text:'Database execution sink receives concatenated SQL text.',evidence:{sink:'query/execute/raw',dynamic:'string-concatenation'}}));
  return rows;
};

const shellFindings = ({source,clean,masked,root,file,target}) => {
  const rows=[];
  for(const m of allMatches(/\b(?:exec|execSync)\s*\(\s*`[^`]*\$\{[^}]+\}[^`]*`/g,clean)) if(isCodePosition(masked,m.index)) rows.push(row({root,file,source,index:m.index,target,confidence:'high',text:'Shell execution uses an interpolated command string.',evidence:{sink:m[0].startsWith('execSync')?'execSync':'exec',shell:true,dynamic:true}}));
  for(const m of allMatches(/\b(?:exec|execSync)\s*\(\s*[^,\n]+\+[^,\n]+/g,clean)) if(isCodePosition(masked,m.index)) rows.push(row({root,file,source,index:m.index,target,confidence:'high',text:'Shell execution uses string concatenation.',evidence:{shell:true,dynamic:true}}));
  for(const m of allMatches(/\b(?:spawn|spawnSync)\s*\([\s\S]{0,1200}?\bshell\s*:\s*true/g,clean)) if(isCodePosition(masked,m.index)) rows.push(row({root,file,source,index:m.index,target,confidence:'review',text:'spawn/spawnSync enables shell execution; validate command and argument provenance.',evidence:{sink:'spawn',shell:true}}));
  return rows;
};

const privateKeyFindings = ({source,root,file,target}) => {
  const rows=[];
  const re=/-----BEGIN ((?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY)-----\s+([A-Za-z0-9+/=\r\n]{64,})-----END \1-----/g;
  for(const m of allMatches(re,source)) rows.push(row({root,file,source,index:m.index,target,confidence:'high',text:`-----BEGIN ${m[1]}----- … [redacted]`,evidence:{redacted:true,key_material:'private-key-block'}}));
  return rows;
};

const cookieFindings = ({source,clean,masked,root,file,target}) => {
  const rows=[];
  for(const m of allMatches(/\b(?:res\s*\.\s*cookie|cookie\s*\.\s*serialize|setCookie)\s*\(/g,clean)) {
    if(!isCodePosition(masked,m.index))continue;
    const open=m.index+m[0].lastIndexOf('('), call=extractBalancedCall(source,open);
    if(!call)continue;
    const args=splitTopLevelArgs(call), options=args[2]??null;
    if(!options||!options.trim().startsWith('{')){
      rows.push(row({root,file,source,index:m.index,target,confidence:'review',text:'Cookie options are dynamic or absent; httpOnly/secure flags could not be proven.',evidence:{options:'dynamic-or-missing',unverified:['httpOnly','secure']}}));
      continue;
    }
    const hasHttpOnly=/\bhttpOnly\s*:\s*true\b/.test(options), hasSecure=/\bsecure\s*:\s*true\b/.test(options);
    if(hasHttpOnly&&hasSecure)continue;
    rows.push(row({root,file,source,index:m.index,target,confidence:'high',text:'Inline cookie options are missing one or more hardening flags.',evidence:{httpOnly:hasHttpOnly,secure:hasSecure,missing:[...(!hasHttpOnly?['httpOnly']:[]),...(!hasSecure?['secure']:[])]}}));
  }
  return rows;
};

const prototypeFindings = ({source,clean,root,file,target}) => {
  const assignments=allMatches(/\b([A-Za-z_$][\w$]*)\s*\[\s*([A-Za-z_$][\w$]*)\s*\]\s*(?:=(?!=)|\?\?=|\|\|=|&&=)\s*[^;\n]+/g,clean);
  for(const m of assignments){
    const around=clean.slice(Math.max(0,m.index-1200),Math.min(clean.length,m.index+1200));
    const hasLoop=/(?:for\s*\([^)]*\bin\b[^)]*\)|Object\.keys\s*\([^)]*\)\s*\.\s*forEach|for\s*\([^)]*\bof\b[^)]*Object\.(?:keys|entries))/.test(around);
    const recursive=/\b(?:merge|assign|extend|deepMerge|mergeDeep)\s*\(/i.test(around);
    const guarded=/(?:__proto__|constructor|prototype)[\s\S]{0,240}(?:continue|return|throw)/.test(around);
    if(hasLoop&&recursive&&!guarded)return [row({root,file,source,index:m.index,target,confidence:'review',text:'Recursive/dynamic object assignment lacks an obvious prototype-key guard.',evidence:{dynamic_key:m[2],guard_detected:false}})];
  }
  return [];
};

const dispatch = { 'jwt-secrets':jwtFindings, 'regex-dos':redosFindings, 'unsecure-tls':tlsFindings, 'sql-injection':sqlFindings, 'shell-spawns':shellFindings, 'private-keys':privateKeyFindings, 'cookies-unsecure':cookieFindings, 'prototype-pollution':prototypeFindings };

export const run = async ({options,context,tool}) => {
  const sourceFolder=options.folder??context?.project?.root;
  if(!sourceFolder)throw Object.assign(new Error(`${tool.key}: folder or loaded project is required.`),{code:'INPUT_REQUIRED'});
  const root=path.resolve(sourceFolder), target=tool.meta.target;
  const analyze=dispatch[target];
  if(!analyze)throw Object.assign(new Error(`${tool.key}: unknown security target ${target}.`),{code:'BAD_TOOL'});
  const rows=[]; let filesScanned=0;
  for(const file of await scanFiles(root)){
    if(!isCodeFile(file) && target!=='private-keys')continue;
    filesScanned++;
    const source=await read(file), clean=maskComments(source), masked=maskCommentsAndStrings(source);
    rows.push(...analyze({source,clean,masked,root,file,target}));
  }
  rows.sort((a,b)=>a.file.localeCompare(b.file)||a.line-b.line);
  return {status:'ok',scan:`security-${target}`,root,totals:{files_scanned:filesScanned,matches:rows.length},rows};
};
