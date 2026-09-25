import path from 'node:path';
const safe=v=>String(v).replaceAll('\\','/').replace(/^\/+|\/+$/g,'');
export const plan=({options})=>({destination:path.posix.join(safe(options.parent_path),`note-${options.name}`),files:[{path:`${options.name}.txt`,text:String(options.content)+'\n'}]});
