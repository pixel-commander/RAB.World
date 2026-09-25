import path from 'node:path';
import {readFile,writeFile,rename,unlink,realpath} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {collectScriptFiles} from '../../_source-glob.mjs';

const fail=(code,message)=>Object.assign(new Error(message),{code});
const kitMarker=/\s+data-rab-kit-class\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
const openingTag=/<[A-Za-z][^<>]*>/g;
const classAttribute=/\s+className\s*=\s*(?:"([^"]*)"|'([^']*)')/;
const classToken=/^[A-Za-z][A-Za-z0-9_-]*(?:\s+[A-Za-z][A-Za-z0-9_-]*)*$/;

export const finalizeKitText=(text,seeded)=>{
  let changed=false,removed=0;
  const next=text.replace(openingTag,tag=>{
    const markers=[...tag.matchAll(kitMarker)];
    if(!markers.length)return tag;
    if(markers.length!==1)throw fail('BAD_KIT_MARKER','Each element may have only one data-rab-kit-class marker.');
    const value=markers[0][1]??markers[0][2];
    if(!classToken.test(value))throw fail('BAD_KIT_MARKER',`Invalid UI-kit class marker: ${value}`);
    let updated=tag.replace(markers[0][0],'');
    if(seeded){
      const classes=updated.match(classAttribute);
      if(classes){
        const current=classes[1]??classes[2];
        const joined=[...new Set([...current.split(/\s+/),...value.split(/\s+/)].filter(Boolean))].join(' ');
        updated=updated.replace(classes[0],` className="${joined}"`);
      }else if(/\bclassName\s*=/.test(updated))throw fail('BAD_KIT_MARKER','UI-kit class marker needs a literal className or no className.');
      else updated=updated.replace(/\s*\/?\s*>$/,ending=>` className="${value}"${ending}`);
    }
    changed=true;removed++;
    return updated;
  });
  if(/data-rab-kit-[A-Za-z0-9_-]*/.test(next))throw fail('UNKNOWN_KIT_MARKER','Unresolved or unsupported UI-kit marker remains.');
  return {text:next,changed,removed};
};

export const run=async({options,context})=>{
  if(!context?.project?.root)throw fail('PROJECT_CONTEXT_REQUIRED','Select a React project to finalize.');
  const root=await realpath(context.project.root);
  const settings=JSON.parse(await readFile(path.join(root,'settings.json'),'utf8'));
  if(settings.type!=='react')throw fail('BAD_PROJECT','UI-kit finalization requires a React project.');
  const source=await collectScriptFiles(path.join(root,'src'),['tsx','jsx']);
  const changes=[];let removed=0;
  for(const relative of source.files){
    const file=path.join(source.cwd,relative),actual=await realpath(file);
    if(actual!==root&&!actual.startsWith(root+path.sep))throw fail('INVALID_PATH','UI-kit source file leaves the project.');
    const before=await readFile(actual,'utf8'),after=finalizeKitText(before,options.seeded);
    if(after.changed){changes.push({file:actual,relative:path.relative(root,actual).split(path.sep).join('/'),text:after.text});removed+=after.removed;}
  }
  for(const change of changes){
    const temporary=`${change.file}.${randomUUID()}.tmp`;
    try{await writeFile(temporary,change.text,{flag:'wx'});await rename(temporary,change.file);}
    finally{await unlink(temporary).catch(error=>{if(error.code!=='ENOENT')throw error;});}
    if(await readFile(change.file,'utf8')!==change.text)throw fail('VERIFICATION_FAILED',`UI-kit finalization verification failed: ${change.relative}`);
  }
  return {status:changes.length?'finalized':'unchanged',type:'ui-kit',seeded:options.seeded,markers_removed:removed,files:changes.map(change=>change.relative)};
};
