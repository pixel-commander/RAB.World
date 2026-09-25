import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const slash=value=>String(value).split(path.sep).join('/');
export const run=async({options})=>{
  const source=path.resolve(options.file), entry=path.resolve(options.entry);
  if(source===entry) throw Object.assign(new Error('CSS source and entry must be different files.'),{code:'BAD_REQUEST'});
  let relative=slash(path.relative(path.dirname(entry),source));
  if(!relative.startsWith('.')) relative=`./${relative}`;
  const line=`@import '${relative}';`;
  const text=await readFile(entry,'utf8');
  const normalized=text.replaceAll('"',"'");
  if(normalized.includes(line)) return {status:'already-imported',file:source,entry,import:line,relative};
  const next=`${line}\n${text}`;
  await writeFile(entry,next,'utf8');
  return {status:'imported',file:source,entry,import:line,relative,provided:{file:entry}};
};
