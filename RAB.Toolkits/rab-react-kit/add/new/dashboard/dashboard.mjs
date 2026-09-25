import { readFile } from 'node:fs/promises';

export const run=async({options,helpers})=>{
  const mold=JSON.parse(await readFile(new URL('./template/dashboard.json',import.meta.url),'utf8'));
  const layout=String(options.layout??mold.layout);const navName=String(options.nav_name??mold.nav_component);const navArea=String(options.nav_area??mold.nav_area);
  const pageLocation=await helpers.resolveProjectFolder({explicit:options.page_location,key:'pages',fallback:'src/pages'});
  const componentLocation=await helpers.resolveProjectFolder({explicit:options.component_location,key:'components',fallback:'src/components'});
  const page=await helpers.runTool({key:'react/add/new/page',options:{name:options.name,location:pageLocation}});
  const grid=await helpers.runTool({key:'react/apply/grid-layout',options:{file:page.result.file,layout}});
  let navCreated=true;
  try{await helpers.runTool({key:'react/add/new/navigation',options:{name:navName,location:componentLocation,rows:[{id:options.name,name:options.name,path:'/'}]}});}catch(error){if(error.code!=='EEXIST')throw error;navCreated=false;}
  const inserted=await helpers.runTool({key:'react/insert/component-into-area',options:{component:navName,file:page.result.file,area:navArea}});
  return {status:'created',type:'dashboard',name:options.name,page:{name:options.name,file:page.result.file},layout:grid.result.layout,nav:{name:navName,area:navArea,created:navCreated},construction_seats:grid.result.construction_seats,provided:{seats:{file:page.result.file,page:options.name,dashboard:options.name,nav_component:navName}}};
};
