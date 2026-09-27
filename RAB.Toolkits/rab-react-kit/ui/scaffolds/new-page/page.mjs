import { readFile, lstat, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const exists=async target=>{try{await lstat(target);return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}};
const pageName=value=>{const name=String(value??'').trim();if(!/^[A-Z][A-Za-z0-9_$]*$/.test(name))throw Object.assign(new Error('Page name must be a valid capitalized React identifier.'),{code:'BAD_REQUEST'});return name;};
const slug=value=>String(value).replace(/([A-Z]+)([A-Z][a-z])/g,'$1-$2').replace(/([a-z0-9])([A-Z])/g,'$1-$2').replace(/[^A-Za-z0-9-]+/g,'-').replace(/^-+|-+$/g,'').toLowerCase();

export const run=async({options,helpers})=>{
  const {resolveProjectFolder,writeArtifactPlan}=helpers;
  const name=pageName(options.name);
  const pages=await resolveProjectFolder({explicit:options.location,key:'pages',fallback:'src/pages'});
  const folder=path.join(pages,name);
  if(await exists(folder))throw Object.assign(new Error(`Target already exists: ${folder}`),{code:'EEXIST'});
  const seatId=`page-${slug(name)}:p1`;
  const templateRoot=new URL(options.dashboard_template === true ? '../new-dashboard/template/page/' : './template/',import.meta.url);
  const template=await readFile(new URL('tmpl.tsx',templateRoot),'utf8');
  const title=options.title??name;
  const description=options.description??`React page ${name}.`;
  const text=template.replaceAll('__PAGE_NAME__',name).replaceAll('__PAGE_SLUG__',slug(name)).replaceAll('__PAGE_TITLE__',JSON.stringify(title)).replaceAll('__PAGE_DESCRIPTION__',JSON.stringify(description)).replaceAll('__PAGE_CONTENT__',JSON.stringify(options.content??''));
  const ext=options.save_as_text?'.txt':'.tsx';
  const file=path.join(folder,`${name}${ext}`);
  const settings=await helpers.createItemSettings({
    name,
    title,
    description,
    settings:[],
    meta:{kind:'page'},
    type:'page',
    content:options.content??'',
    ...(options.indexed===undefined?{}:{indexed:options.indexed})
  });
  const supporting=(await helpers.renderTemplateTree(fileURLToPath(templateRoot),{PAGE_NAME:name,PAGE_SLUG:slug(name)})).filter(item=>item.path!=='tmpl.tsx').map(item=>({...item,path:item.path.replaceAll('__PAGE_NAME__',name).replaceAll('__PAGE_SLUG__',slug(name))}));
  const verification=await writeArtifactPlan({destination:folder,allowedRoot:pages,files:[{path:`${name}${ext}`,text},...supporting,{path:'settings.json',text:JSON.stringify(settings,null,2)+'\n'},{path:'README.txt',text:`Generated page ${name}. Layout lives in css/${slug(name)}.css; helpers belong in js/.\n`}]});
  if(options.dashboard_template === true) await mkdir(path.join(folder,'js'));
  return {status:'created',type:'page',id:settings.id,name,title:settings.title,description:settings.description,settings,file,path:file,folder,verification,construction_seats:[{id:seatId,role:'page-root',owner:name}],provided:{seats:{file,path:file,page:name,page_root_seat:seatId}}};
};
