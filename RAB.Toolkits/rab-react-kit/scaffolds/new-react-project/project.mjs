import { readFile } from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
export const run=async args=>{
  const {renderTemplateTree,writeArtifactPlan}=args.helpers;
  const assets=JSON.parse(await readFile(new URL('./assets/starter.json',import.meta.url),'utf8'));
  const additionalFiles=[...(args.options.add_database===true?assets.database:[])].map(file=>file.text===undefined?file:{...file,text:file.text.replaceAll('__PROJECT_NAME__',`{${JSON.stringify(args.options.name)}}`)});
  const target=path.resolve(args.options.path??path.resolve(args.options.folder,args.options.name));
  const template=fileURLToPath(new URL('./template',import.meta.url));
  const rendered=await renderTemplateTree(template,{PROJECT_NAME:args.options.name,NPM_NAME:String(args.options.name).toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^[._-]+/,'')||'app'});
  const stampedAt=new Date().toISOString();
  const shellSettings=await args.helpers.createSignalSettings({
    name:'site-shell', title:`${args.options.title} shell`,
    description:`Site shell where pages and dashboards load for the ${args.options.name} React project. Navigation lives in components/SiteNav.tsx; the selected page or dashboard renders in the main area.`,
    type:'site shell', settings:[], transmitting:true, signal:true,
  });
  const defaultPageSettings=await args.helpers.createItemSettings({name:'Default',title:args.options.title,description:args.options.description,type:'page',settings:[],meta:{kind:'page'},indexed:true});
  const files=[...rendered,...additionalFiles].map(file=>{
    if(file.text===undefined)return file;
    if(file.path==='src/shell/settings.json')return {...file,text:JSON.stringify(shellSettings,null,2)+'\n'};
    if(file.path==='src/pages/Default/settings.json')return {...file,text:JSON.stringify(defaultPageSettings,null,2)+'\n'};
    if(file.path==='settings.json'){
      const settings=JSON.parse(file.text);
      return {...file,text:JSON.stringify({...settings,id:args.options.id,name:args.options.name,title:args.options.title,description:args.options.description,path:target},null,2)+'\n'};
    }
    if(file.path==='PATHS.json'){
      const paths=JSON.parse(file.text);
      Object.assign(paths.project,{id:args.options.id,name:args.options.name,title:args.options.title,description:args.options.description,path:target});
      return {...file,text:JSON.stringify(paths,null,2)+'\n'};
    }
    if(file.path.split(/[\\/]/).at(-1)==='beacon.json'){
      const beacon=JSON.parse(file.text);
      if(beacon._scaffold===true){
        delete beacon._scaffold;
        Object.assign(beacon,{beacon:'on',date_added:stampedAt,path:path.resolve(target,path.dirname(file.path)),project_name:args.options.name});
        return {...file,text:JSON.stringify(beacon,null,2)+'\n'};
      }
    }
    return file;
  });
  const verification=await writeArtifactPlan({destination:target,files});
  const settings=JSON.parse(files.find(file=>file.path==='settings.json').text);
  return {status:'created',project:{id:args.options.id,name:args.options.name,title:args.options.title,description:args.options.description,path:target,root:target,type:settings.type},settings,verification};
};
