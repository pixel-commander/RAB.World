import path from 'node:path';
const safe=v=>String(v).replaceAll('\\','/').replace(/^\/+|\/+$/g,'');
export const plan=({options})=>{
 const ext=options.save_as_text?'txt':'tsx'; const text=options.content??'';
 const code=options.save_as_text?`PAGE ${options.name}\n${text}\n`:`export const ${options.name} = () => <main data-page="${options.name}">${JSON.stringify(text)}</main>;\n`;
 return {destination:path.posix.join(safe(options.location),options.name),files:[{path:`${options.name}.${ext}`,text:code},{path:'settings.json',text:JSON.stringify({type:'page',name:options.name,content:text},null,2)+'\n'}]};
};
