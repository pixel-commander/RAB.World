import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
const queues = new Map();
export const appendHistory = async (file, record) => {
  const key=path.resolve(file);
  const previous=queues.get(key) ?? Promise.resolve();
  const pending=previous.catch(()=>{}).then(async()=>{
    await mkdir(path.dirname(key),{recursive:true});
    await appendFile(key,JSON.stringify({...record,error_count:(record.errors??[]).length})+'\n','utf8');
  });
  queues.set(key,pending);
  try{await pending;}finally{if(queues.get(key)===pending)queues.delete(key);}
};
export const trackExecution = async ({file,name,world,options}, execute) => {
  const record={id:randomUUID(),name,world,options,date_start:Date.now(),date_end:null,duration_ms:null,status:'running',errors:[]};
  const started=performance.now();
  try{
    const result=await execute(record);
    record.errors=result?.errors ?? [];
    record.status=record.errors.length?'partial':'completed';
    return result;
  }catch(error){record.status='failed';record.errors.push({message:error.message,code:error.code??null});throw error;}
  finally{
    record.date_end=Date.now();record.duration_ms=Math.max(0,performance.now()-started);
    await appendHistory(file,record);
  }
};
