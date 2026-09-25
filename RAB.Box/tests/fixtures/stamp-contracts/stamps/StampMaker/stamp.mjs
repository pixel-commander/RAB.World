import path from 'node:path';
const safe=v=>String(v).replaceAll('\\','/').replace(/^\/+|\/+$/g,'');
export const plan=({options})=>{
 const types=String(options.data_types??'').split(',').map(x=>x.trim()).filter(Boolean);
 const settings={id:`generated-${options.name}`,name:options.name,title:options.name,description:options.description,data_types:types,options:{}};
 const script=`export const plan = ({ options }) => ({\n  destination: 'output/${options.name}',\n  files: [{ path: 'README.txt', text: 'TODO: implement ${options.name}\\n' }]\n});\n`;
 const registration={name:options.name,settings:`generated-stamps/${options.name}/settings.json`,script:`generated-stamps/${options.name}/stamp.mjs`,language:{verbs:['make','create','run'],names:[options.name]},write_roots:['output']};
 return {destination:path.posix.join(safe(options.location),options.name),files:[
  {path:'settings.json',text:JSON.stringify(settings,null,2)+'\n'},
  {path:'stamp.mjs',text:script},
  {path:'registration.json',text:JSON.stringify(registration,null,2)+'\n'},
  {path:'CHECK_ME.txt',text:'Run the stamp visibility checker before registration. Generated files are a skeleton, not trusted capability truth.\n'}
 ]};
};
