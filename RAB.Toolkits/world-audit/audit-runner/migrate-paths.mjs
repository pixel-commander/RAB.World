import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
export const migratePaths=async file=>{
 const db=new DatabaseSync(file);
 try{
  if(db.prepare('PRAGMA user_version').get().user_version===3)return {status:'existing'};
  if(db.prepare('PRAGMA user_version').get().user_version!==2)throw new Error('Expected schema v2.');
  const backup=file+'.before-paths-'+Date.now()+'.sqlite';db.exec("VACUUM INTO '"+backup.replaceAll("'","''")+"'");
  const rows=db.prepare('SELECT f.*,d.name,d.title,d.description,d.type,d.added_by,d.date_added,d.date,d.settings,d.meta FROM folders f LEFT JOIN folder d ON d.id=f.id').all();
  const links=db.prepare('SELECT * FROM run_folders').all();const runs=db.prepare('SELECT * FROM runs').all();const metadata=db.prepare('SELECT * FROM audit_meta').all();
  const normalize=p=>{const v=path.win32.normalize(p);return v.length>path.win32.parse(v).root.length?v.replace(/[\\/]+$/,''):v;};
  const paths=new Map(rows.map(row=>[row.id,normalize(row.path)]));
  const schema=await readFile(new URL('../scaffolds/add-audit-db/template/schema.sql',import.meta.url),'utf8');
  db.exec('PRAGMA foreign_keys=OFF; BEGIN IMMEDIATE');
  try{
   db.exec('DROP TABLE run_folders; DROP TABLE folder; DROP TABLE folders; DROP TABLE runs; DROP TABLE audit_meta;');db.exec(schema);
   for(const row of metadata)db.prepare('INSERT INTO audit_meta VALUES (?,?)').run(row.key,row.value);
   for(const row of runs){const keys=Object.keys(row);db.prepare(`INSERT INTO runs (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`).run(...keys.map(k=>row[k]));}
   for(const row of rows){const meta=JSON.parse(row.meta??'{}');for(const part of [meta.map,meta.scan])if(part?.folders)part.folders=part.folders.map(id=>paths.get(id)).filter(Boolean);
    db.prepare('INSERT INTO folders(path,parent,name,title,description,type,added_by,date_added,date,settings,meta) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(paths.get(row.id),row.parent==null?null:paths.get(row.parent),row.name??(path.win32.basename(row.path)||row.path),row.title,row.description,row.type??'folder',row.added_by,row.date_added,row.date,row.settings??'[]',JSON.stringify(meta));
   }
   for(const row of links)db.prepare('INSERT INTO run_folders VALUES (?,?)').run(row.run_id,paths.get(row.folder_id));
   if(db.prepare('PRAGMA foreign_key_check').all().length)throw new Error('Foreign key verification failed.');
   if(db.prepare('SELECT count(*) n FROM folders').get().n!==rows.length)throw new Error('Row count mismatch.');
   db.exec('COMMIT; PRAGMA foreign_keys=ON');return {status:'migrated',backup,folders:rows.length};
  }catch(error){db.exec('ROLLBACK');throw error;}
 }finally{db.close();}
};
