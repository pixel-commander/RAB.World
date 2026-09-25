import path from 'node:path';
const safe=value=>String(value).replaceAll('\\','/').replace(/^\/+|\/+$/g,'');
export const plan=({options})=>{
  const name=options.name||'div';
  const ext=options.save_as_text?'txt':'tsx';
  const cls=options.class?` className="${options.class}"`:'';
  const text=options.save_as_text
    ? `DIV ${name}\nparent=${options.parent_path}\nclass=${options.class??''}\n`
    : `export const ${name.replace(/[^A-Za-z0-9_$]/g,'_')} = () => <div${cls} data-rab-div="${name}" />;\n`;
  return {destination:path.posix.join(safe(options.parent_path),name),files:[
    {path:`${name}.${ext}`,text},
    {path:'settings.json',text:JSON.stringify({type:'div',name,parent_path:options.parent_path,class:options.class??null},null,2)+'\n'}
  ]};
};
