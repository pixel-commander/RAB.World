// Explicit ledger conversion for the storage recovery. Scan one file at a
// time; isolated test homes and backups are not live allocation owners.
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createReadStream} from 'node:fs';
import {readFile,writeFile,mkdir,readdir,rename,open} from 'node:fs/promises';
import {withMemoryLock} from '../bridge/rab-memory-lock.mjs';
import {convertLegacyIdState,assertNumericId} from '../bridge/rab-id.mjs';

export const collectOwnedIds = async home => {
  const ids=new Set(),files=[];
  const add=value=>{const id=Number(value);if(Number.isSafeInteger(id)&&id>0)ids.add(id);};
  const visit=async(relative='')=>{
    for(const entry of await readdir(path.join(home,relative),{withFileTypes:true})){
      if(!relative&&['temp','backups','.memory-locks'].includes(entry.name))continue;
      const next=path.join(relative,entry.name);
      if(entry.isSymbolicLink())throw new Error(`ID inventory refuses a link: ${next}`);
      if(/^\d+(?:\.json)?$/.test(entry.name))add(entry.name.replace(/\.json$/,''));
      if(entry.isDirectory())await visit(next);
      else if(entry.isFile()&&/\.jsonl?$/.test(entry.name))files.push(next);
    }
  };
  await visit();
  for(const relative of files){
    let carry='';
    for await(const chunk of createReadStream(path.join(home,relative),{encoding:'utf8'})){
      const text=carry+chunk;
      for(const match of text.matchAll(/"(?:id|[A-Za-z_]*_id|[A-Za-z_]*Id|project_key)"\s*:\s*"?(\d{1,16})(?=[",\s}\]])/g))add(match[1]);
      for(const match of text.matchAll(/"(\d{1,16})"\s*:/g))add(match[1]);
      carry=text.slice(-256);
    }
  }
  return {ids:[...ids].sort((a,b)=>a-b),files:files.length};
};

export const migrateIdState = async ({home,sourceHome,backupDirectory,extraIds=[]}) => withMemoryLock(path.join(home,'.memory-locks','ids'),async()=>{
  const file=path.join(home,'id-state.json'), before=await readFile(file), legacy=JSON.parse(before);
  const local=await collectOwnedIds(home), imported=sourceHome?await collectOwnedIds(sourceHome):{ids:[],files:0};
  for(const id of extraIds)assertNumericId(id);
  await mkdir(backupDirectory,{recursive:true});
  const backupPath=path.join(backupDirectory,'id-state.before.json');
  await writeFile(backupPath,before,{flag:'wx'});
  const state=convertLegacyIdState({legacy,knownIds:[...local.ids,...imported.ids,...extraIds],backupPath});
  const temp=file+`.conversion-${process.pid}.tmp`, handle=await open(temp,'wx');
  try{await handle.writeFile(JSON.stringify(state,null,2)+'\n');await handle.sync();}finally{await handle.close();}
  await rename(temp,file);
  const report={version:state.version,home,backupPath,local_files:local.files,source_files:imported.files,known_ids:new Set([...local.ids,...imported.ids,...extraIds]).size,reserved_ranges:state.reserved.length,legacy_highWater:state.legacy_highWater,limitation:state.legacy_limitation};
  await writeFile(path.join(backupDirectory,'id-conversion.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  return report;
});
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await migrateIdState(JSON.parse(await readFile(process.argv[2],'utf8'))),null,2));
