import path from 'node:path';
const safe = value => String(value).replaceAll('\\','/').replace(/^\/+|\/+$/g,'');
export const plan = ({ options }) => {
  const ext=options.save_as_text?'txt':'tsx';
  const classPart=options.class?` className="${options.class}"`:'';
  const code=options.save_as_text
    ? `SUB_COMPONENT ${options.name}\nparent=${options.parent_path}\nclass=${options.class??''}\n`
    : `export const ${options.name} = () => <div${classPart} data-component="${options.name}" />;\n`;
  return {destination:path.posix.join(safe(options.parent_path),options.name),files:[
    {path:`${options.name}.${ext}`,text:code},
    {path:'settings.json',text:JSON.stringify({type:'component',name:options.name,class:options.class??null,parent_path:options.parent_path},null,2)+'\n'},
    {path:'README.txt',text:`Generated nested component ${options.name} under ${options.parent_path}.\n`}
  ]};
};
