import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const run = async ({options}) => {
  const folder=path.resolve(options.css_path); await mkdir(folder,{recursive:true});
  const file=path.join(folder,'grid.css');
  const text=await readFile(new URL('./template/grid.css',import.meta.url),'utf8');
  await writeFile(file,text,{flag:'wx'});
  return {status:'created',type:'grid-css',file,path:file,provided:{file,path:file}};
};
