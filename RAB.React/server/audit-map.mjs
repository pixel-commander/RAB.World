import {readFile,open,realpath} from 'node:fs/promises';
import {auditJobQueue} from './audit-jobs.mjs';
import { trackExecution } from '../../RAB.Toolkits/world-audit/audit-runner/history.mjs';
import { readFolderMap, updateFolders, learnAll } from '../../RAB.Toolkits/world-audit/audit-runner/audit-store.mjs';
import path from 'node:path';
import { homedir } from 'node:os';
export const auditMap = () => {
  let busy=false;
  const file=path.join(homedir(),'.rab/worlds/laptop/audits/audits.sqlite');
  const queue=auditJobQueue(file);
  const install=server=>{server.middlewares.use(async (req,res,next)=>{
    const route=new URL(req.url,'http://localhost').pathname;
    if(!['/api/audit-file','/api/audit-map','/api/audit-jobs','/api/audit-history'].includes(route))return next();
    res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
    let owns=false;
    try{
      if(route==='/api/audit-file'){
        if(req.method!=='GET'){res.statusCode=405;return res.end('{}');}
        const query=new URL(req.url,'http://localhost').searchParams;
        const folder=readFolderMap(file).items.find(item=>item.path.toLowerCase()===(query.get('folder')??'').toLowerCase());
        const entry=folder?.files?.find(item=>item.name===query.get('name'));
        if(!entry||path.basename(entry.name)!==entry.name){res.statusCode=404;return res.end(JSON.stringify({error:'File is not in the folder inventory.'}));}
        const target=await realpath(path.join(folder.path,entry.name));
        if(path.dirname(target).toLowerCase()!==(await realpath(folder.path)).toLowerCase())throw new Error('File is outside the selected folder.');
        const handle=await open(target,'r');
        try{const info=await handle.stat();if(!info.isFile()||info.size>2*1024*1024)throw new Error('Preview supports text files up to 2 MB.');
          const buffer=Buffer.alloc(2*1024*1024+1);const {bytesRead}=await handle.read(buffer,0,buffer.length,0);if(bytesRead>2*1024*1024)throw new Error('File is too large.');
          const bytes=buffer.subarray(0,bytesRead);if(bytes.includes(0))throw new Error('Binary files cannot be displayed as code.');
          return res.end(JSON.stringify({value:new TextDecoder('utf-8',{fatal:true}).decode(bytes)}));
        }finally{await handle.close();}
      }
      if(route==='/api/audit-history'){
        if(req.method!=='GET'){res.statusCode=405;return res.end('{}');}
        let source='';try{source=await readFile(path.join(path.dirname(file),'history.jsonl'),'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
        const items=[];let invalid=0;
        for(const line of source.split('\n')){if(!line.trim())continue;try{items.push(JSON.parse(line));}catch{invalid++;}}
        return res.end(JSON.stringify({items:items.reverse(),invalid}));
      }
      if(req.method==='POST'){
        if(req.headers.origin && req.headers.origin!==`http://${req.headers.host}`){res.statusCode=403;return res.end('{}');}
        if(!req.headers['content-type']?.startsWith('application/json')){res.statusCode=415;return res.end('{}');}
        if(busy){res.statusCode=409;return res.end(JSON.stringify({error:'An audit action is already running.'}));}
        busy=true;owns=true;
        let body='';for await(const chunk of req){body+=chunk;if(body.length>16384)throw new Error('Request too large.');}
        const {paths,action,id,inputs}=JSON.parse(body);
        if(route==='/api/audit-jobs'){const result=action==='scan'?queue.scan(inputs):action==='run'?queue.start():action==='remove'?queue.remove(id):action==='supply'?queue.supply(id,inputs):queue.enqueue(paths,action);return res.end(JSON.stringify(result));}
        if(queue.snapshot().running)throw new Error('Wait for running jobs before changing folders.');
        if(!Array.isArray(paths)||!paths.length||paths.length>1000||!paths.every(value=>typeof value==='string'&&value.length>0)||!['ignore','details','learn-all'].includes(action))throw new Error('Invalid audit action.');
        await trackExecution({file:path.join(path.dirname(file),'history.jsonl'),name:action==='learn-all'?'learn-all':action==='details'?'folder-details':'folder-ignore',world:'laptop',options:{paths:[...new Set(paths)],recursive:action==='learn-all'}},()=>action==='learn-all'?learnAll(file,[...new Set(paths)]):updateFolders(file,[...new Set(paths)],action));
      }else if(req.method!=='GET'){res.statusCode=405;return res.end('{}');}
      res.end(JSON.stringify(route==='/api/audit-jobs'?queue.snapshot():readFolderMap(file)));
    }catch(error){res.statusCode=500;res.end(JSON.stringify({error:error.message}));}finally{if(owns)busy=false;}
  });};
  return {name:'audit-map',configureServer:install,configurePreviewServer:install};
};
