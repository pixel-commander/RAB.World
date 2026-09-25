import path from 'node:path';
const safe = value => String(value).replaceAll('\\','/').replace(/^\/+|\/+$/g,'');
export const plan = ({ options }) => {
  const ext = options.save_as_text ? 'txt' : 'tsx';
  const classPart = options.class ? ` className="${options.class}"` : '';
  const code = options.save_as_text
    ? `COMPONENT ${options.name}\nclass=${options.class ?? ''}\n`
    : `export const ${options.name} = () => <div${classPart} data-component="${options.name}" />;\n`;
  const destination = path.posix.join(safe(options.location), options.name);
  return { destination, files:[
    { path:`${options.name}.${ext}`, text:code },
    { path:'settings.json', text:JSON.stringify({type:'component',name:options.name,class:options.class??null,parent:null},null,2)+'\n' },
    { path:'README.txt', text:`Generated top-level component ${options.name}.\n` }
  ]};
};
