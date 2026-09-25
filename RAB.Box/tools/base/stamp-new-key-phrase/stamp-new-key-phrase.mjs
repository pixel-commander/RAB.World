import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const slug=v=>String(v??'').trim().toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80);
const csv=v=>String(v??'').split(',').map(x=>x.trim()).filter(Boolean);
export const run=async({options,root,tool})=>{
  const dir=path.join(root,'language','user','key-phrases'); await mkdir(dir,{recursive:true});
  const name=slug(options.phrase)||`phrase-${Date.now()}`,target=path.join(dir,`${name}.json`);
  const template=JSON.parse(await readFile(path.join(tool.root,'template','phrase.json'),'utf8'));
  const record={...template,id:Date.now(),text:options.phrase,types:csv(options.types),senses:csv(options.senses),reviewed:true};
  await writeFile(target,JSON.stringify(record,null,2)+'\n',{flag:'wx'});
  return {status:'created',path:path.relative(root,target).replaceAll('\\','/'),record};
};
