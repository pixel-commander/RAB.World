import {DatabaseSync} from 'node:sqlite';
import path from 'node:path';
import {run as countFolderFiles} from '../folder-file-counts/folder-file-counts.mjs';
export const normalizePath=value=>{const result=path.win32.normalize(value);return result.length>path.win32.parse(result).root.length?result.replace(/[\\/]+$/,''):result;};
const key=value=>normalizePath(value).toLowerCase();
const within=(parent,child)=>{const rel=path.win32.relative(parent,child);return !rel||(rel!=='..'&&!rel.startsWith('..\\')&&!path.win32.isAbsolute(rel));};
const upsert=(db,p,parent)=>db.prepare('INSERT INTO folders(path,parent,name) VALUES (?,?,?) ON CONFLICT(path) DO UPDATE SET parent=excluded.parent').run(normalizePath(p),parent==null?null:normalizePath(parent),path.win32.basename(p)||p);
const putMeta=(db,p,meta)=>db.prepare('UPDATE folders SET meta=? WHERE path=?').run(JSON.stringify(meta),normalizePath(p));
const getMeta=(db,p)=>JSON.parse(db.prepare('SELECT meta FROM folders WHERE path=?').get(normalizePath(p))?.meta??'{}');
const activeRun=db=>db.prepare("SELECT * FROM runs WHERE name IN ('folder-list','folder-scan') AND status='completed' ORDER BY date_start DESC LIMIT 1").get();
const link=(db,run,p)=>db.prepare('INSERT OR IGNORE INTO run_folders VALUES (?,?)').run(run,normalizePath(p));
export const ignoredPaths=file=>{const db=new DatabaseSync(file,{readOnly:true});try{return db.prepare("SELECT path FROM folders WHERE json_extract(meta,'$.ignored')=1").all().map(row=>row.path);}finally{db.close();}};
const merge=(db,report,runId,branch)=>{
 const legacy=new Map(report.items.map(row=>[row.id,row.path]));
 const rows=report.items.map(row=>({...row,path:normalizePath(row.path),parent:row.parent!==undefined?row.parent:row.parent_id==null?null:legacy.get(row.parent_id)}));
 const children=new Map();for(const row of rows){if(row.parent!=null){const k=key(row.parent);if(!children.has(k))children.set(k,[]);children.get(k).push(row.path);}}
 for(const row of rows){if(branch&&!within(branch,row.path))throw new Error('Report leaves branch.');if(branch&&key(row.path)===key(branch))continue;upsert(db,row.path,row.parent);}
 for(const row of rows){
  link(db,runId,row.path);const meta=getMeta(db,row.path);
  const errors=[...(report.errors??[]),...(report.skipped??[])].filter(error=>key(error.path)===key(row.path));
  const root=rows[0].path;const depth=path.win32.relative(root,row.path).split(/[\\/]/).filter(Boolean).length;
  const limit=report.options?.recursive?report.options.max_depth:Math.min(report.options?.max_depth??1,1);
  meta.map={date:Date.parse(report.end_date),errors};
  if(!errors.length&&(limit===undefined||depth<limit))meta.map.folders=children.get(key(row.path))??[];
  putMeta(db,row.path,meta);
 }
};
export const importFolderReport=(file,report)=>{
 const db=new DatabaseSync(file);try{db.exec('PRAGMA foreign_keys=ON; BEGIN IMMEDIATE');
 if(report.status!=='completed'||!report.execution_id||db.prepare("SELECT value FROM audit_meta WHERE key='world'").get()?.value!==report.world)throw new Error('Invalid report/world.');
 db.prepare('INSERT OR IGNORE INTO runs(id,name,world,options,date_start,date_end,duration_ms,status,errors) VALUES (?,?,?,?,?,?,?,?,?)').run(report.execution_id,report.name,report.world,JSON.stringify(report.options),Date.parse(report.start_date),Date.parse(report.end_date),report.duration_ms,report.status,JSON.stringify([...(report.errors??[]),...(report.skipped??[])]));
 merge(db,report,report.execution_id);db.exec('COMMIT');return {count:report.items.length,run:report.execution_id};
 }catch(error){db.exec('ROLLBACK');throw error;}finally{db.close();}
};
export const mergeFolderBranch=(file,branch,report)=>{
 const db=new DatabaseSync(file);try{db.exec('PRAGMA foreign_keys=ON; BEGIN IMMEDIATE');const active=activeRun(db);
 if(!active||report.status!=='completed'||report.world!==db.prepare("SELECT value FROM audit_meta WHERE key='world'").get()?.value||key(report.items[0].path)!==key(branch))throw new Error('Invalid branch report.');
 merge(db,report,active.id,branch);db.exec('COMMIT');
 }catch(error){db.exec('ROLLBACK');throw error;}finally{db.close();}
};
export const readFolderMap=file=>{
 const db=new DatabaseSync(file,{readOnly:true});try{const run=activeRun(db);if(!run)return {items:[],run:null};run.options=JSON.parse(run.options);run.errors=JSON.parse(run.errors);
 const items=db.prepare('SELECT f.* FROM folders f JOIN run_folders rf ON rf.folder_path=f.path WHERE rf.run_id=? ORDER BY f.path COLLATE NOCASE').all(run.id);
 const children=new Map();for(const item of items){const k=item.parent==null?null:key(item.parent);if(!children.has(k))children.set(k,[]);children.get(k).push(item.path);}
 const root=items.find(item=>item.parent===null);
 for(const item of items){const meta=JSON.parse(item.meta);delete item.meta;delete item.date;item.ignored=meta.ignored===true;
  const depth=root?path.win32.relative(root.path,item.path).split(/[\\/]/).filter(Boolean).length:0;
  const limit=run.options.recursive?run.options.max_depth:Math.min(run.options.max_depth??1,1);
  const observations=[meta.map,meta.scan].filter(value=>value&&Number.isFinite(value.date));
  if((limit===undefined||depth<limit)&&!run.errors.some(e=>key(e.path)===key(item.path)))observations.push({date:run.date_end,folders:children.get(key(item.path))??[],errors:[]});
  observations.sort((a,b)=>b.date-a.date);const latest=observations[0];
  if(latest){item.date=latest.date;item.errors=latest.errors??[];if(!item.errors.length&&Array.isArray(latest.folders))item.folders=latest.folders;}
  if(meta.scan){item.size=meta.scan.size;if(meta.scan.errors?.length)item.errors=[...(item.errors??[]),...meta.scan.errors];}
  if(item.files!==null && typeof item.files==='string'){item.files=JSON.parse(item.files);item.size=item.files.reduce((n,f)=>n+f.size,0);}else if(!meta.scan?.records){delete item.files;}
  item.coverage=item.errors?.length?'unreadable':item.folders===undefined?'depth-limited':item.folders.length?'scanned':'empty';
 }
 const byPath=new Map(items.map(item=>[key(item.path),item]));
 for(const item of items){
  const seen=new Set(),pending=[item.path];let files=0,size=0,scanned=0,folders=0,complete=true;const types=new Map();let typesComplete=true;
  while(pending.length){const p=pending.pop(),k=key(p);if(seen.has(k)){complete=false;continue;}seen.add(k);const row=byPath.get(k);if(!row){complete=false;continue;}if(row.ignored)continue;folders++;
   if(row.files==null||row.size==null)complete=false;else{files+=row.files.length;size+=row.size;scanned++;if(Array.isArray(row.files)){for(const group of row.files){const total=types.get(group.type)??{type:group.type,count:0,size:0};total.count+=1;total.size+=group.size;types.set(group.type,total);}}else typesComplete=false;}
   if(row.errors?.length)complete=false;if(row.folders===undefined)complete=false;else pending.push(...row.folders);
  }
  item.totals={files,size,scanned,folders,complete,types:[...types.values()],types_complete:complete&&typesComplete};
  let parent=item,depth=0;const parents=new Set();while(parent.parent!==null){if(parents.has(key(parent.path))){depth=undefined;break;}parents.add(key(parent.path));parent=byPath.get(key(parent.parent));if(!parent){depth=undefined;break;}depth++;}item.depth=depth;
 }
 return {items,run};}finally{db.close();}
};
export const updateFolders=async(file,paths,action,onProgress)=>{
 const db=new DatabaseSync(file);const errors=[];
 try{db.exec('PRAGMA foreign_keys=ON');const active=activeRun(db);const ignored=ignoredPaths(file);
 for(const p of paths){const row=db.prepare('SELECT * FROM folders WHERE path=?').get(normalizePath(p));if(!row)throw new Error('Unknown folder path.');const meta=getMeta(db,row.path);
 if(action==='ignore'){meta.ignored=true;putMeta(db,row.path,meta);continue;}
 if(ignored.some(parent=>within(parent,row.path)))continue;
 const output=await countFolderFiles({options:{path:row.path,exclude:ignored},context:{onProgress}});const detail=output.items[0];if(!detail)continue;
 meta.scan={files:detail.files,size:detail.size,date:Date.now(),errors:detail.errors,records:true};errors.push(...detail.errors);
 db.exec('BEGIN IMMEDIATE');try{if(!detail.errors.length){for(const child of detail.folders){upsert(db,child,row.path);if(active)link(db,active.id,child);}meta.scan.folders=detail.folders.map(normalizePath);}const previous=new Map(JSON.parse(row.files??'[]').map(file=>[file.name.toLowerCase(),file.id]));const records=(detail.records??[]).map(file=>({...file,id:previous.get(file.name.toLowerCase())??file.id}));db.prepare('UPDATE folders SET files=? WHERE path=?').run(JSON.stringify(records),row.path);putMeta(db,row.path,meta);db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}
 }return {errors};}finally{db.close();}
};
export const learnAll=async(file,paths,onProgress,onExecution)=>{
 const {run}=await import('./audit-runner.mjs');const {readFile}=await import('node:fs/promises');
 const db=new DatabaseSync(file,{readOnly:true});let world;try{world=db.prepare("SELECT value FROM audit_meta WHERE key='world'").get()?.value;}finally{db.close();}
 const ignored=ignoredPaths(file);const roots=paths.filter(p=>!ignored.some(parent=>within(parent,p))&&!paths.some(other=>key(other)!==key(p)&&within(other,p)));const errors=[];
 for(const root of roots){const result=await run({options:{world,audit_type:'folder-list',path:root,options:{recursive:true}},context:{rab_home:path.resolve(path.dirname(file),'../../..'),onProgress,onExecution}});if(result.status!=='completed')throw new Error(result.execution?.error?.message??'Scan failed.');
 const report=JSON.parse(await readFile(result.report_file,'utf8'));mergeFolderBranch(file,root,report);errors.push(...(report.errors??[]));
 const details=await run({options:{world,audit_type:'folder-details',options:{paths:report.items.map(item=>item.path)}},context:{rab_home:path.resolve(path.dirname(file),'../../..'),onProgress,onExecution}});
 if(details.status!=='completed')throw new Error(details.execution?.error?.message??'File inventory failed.');errors.push(...(details.result?.errors??[]));}

 return {errors};
};

export const saveFolderScan=(file,report)=>{
 const db=new DatabaseSync(file);try{db.exec('PRAGMA foreign_keys=ON; BEGIN IMMEDIATE');
 if(report.status!=='completed'||report.world!==db.prepare("SELECT value FROM audit_meta WHERE key='world'").get()?.value)throw new Error('Invalid scan report.');
 const active=activeRun(db);const runId=active?.id??report.execution_id;
 if(!active)db.prepare('INSERT INTO runs(id,name,world,options,date_start,date_end,duration_ms,status,errors) VALUES (?,?,?,?,?,?,?,?,?)').run(runId,'folder-scan',report.world,JSON.stringify({recursive:true,max_depth:0}),Date.parse(report.start_date),Date.parse(report.end_date),report.duration_ms,'completed',JSON.stringify(report.errors??[]));
 for(const item of report.items){const old=db.prepare('SELECT * FROM folders WHERE path=?').get(normalizePath(item.path));upsert(db,item.path,item.parent??old?.parent??null);link(db,runId,item.path);
  for(const child of item.folders??[]){upsert(db,child,item.path);link(db,runId,child);}
  const meta=getMeta(db,item.path);const issues=(report.errors??[]).filter(error=>key(error.path)===key(item.path)||key(path.win32.dirname(error.path))===key(item.path));
  meta.map={date:Date.parse(report.end_date),errors:issues};if(item.folders)meta.map.folders=item.folders.map(normalizePath);
  if(item.files!==undefined){const previous=new Map(JSON.parse(old?.files??'[]').map(f=>[f.name.toLowerCase(),f.id]));const records=item.files.map(f=>({...f,id:previous.get(f.name.toLowerCase())??f.id}));db.prepare('UPDATE folders SET files=? WHERE path=?').run(JSON.stringify(records),normalizePath(item.path));meta.scan={date:Date.parse(report.end_date),errors:issues,records:true,size:records.reduce((n,f)=>n+f.size,0),folders:item.folders};}
  putMeta(db,item.path,meta);
 }
 db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}finally{db.close();}
};
