import { readFile } from 'node:fs/promises';

const childTarget=options=>({component:options.component,file:options.file,path:options.path,seat_id:options.seat_id,data_area:options.area});
const seatSuffix=options=>{
  const raw=options.seat_id??(options.area?`area-${options.area}`:'');
  if(!raw)return '';
  const scope=String(raw).trim().replace(/[^A-Za-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'')||'nested';
  return `--in-${scope}`;
};
const runChild=(helpers,key,options)=>helpers.runTool({key,options});

export const run=async({options,helpers})=>{
  const catalog=JSON.parse(await readFile(new URL('../../../html/add/grid/grids.json',import.meta.url),'utf8'));
  const layout=String(options.layout??'header-main');
  const shape=catalog.layouts?.[layout];
  if(!shape)throw Object.assign(new Error(`Unknown grid layout ${layout}. Choose: ${Object.keys(catalog.layouts??{}).join(', ')}`),{code:'BAD_REQUEST'});
  const gap=String(options.gap??'content');
  if(!(catalog.gaps??[]).includes(gap))throw Object.assign(new Error(`Unknown grid gap ${gap}. Choose: ${(catalog.gaps??[]).join(', ')}`),{code:'BAD_REQUEST'});
  const target=childTarget(options);const suffix=seatSuffix(options);

  await runChild(helpers,'react/add/attribute',{...target,attribute_name:'data-grid',attribute_value:layout,dry_run:true});
  await runChild(helpers,'react/add/attribute',{...target,attribute_name:'data-gap',attribute_value:gap,dry_run:true});
  for(const area of shape.areas)await runChild(helpers,'react/add/element',{...target,tag:'div',new_data_area:area,new_seat_id:`area-${area}:a1${suffix}`,dry_run:true});

  const grid=await runChild(helpers,'react/add/attribute',{...target,attribute_name:'data-grid',attribute_value:layout});
  await runChild(helpers,'react/add/attribute',{...target,attribute_name:'data-gap',attribute_value:gap});
  const areas=[];
  for(const area of shape.areas){
    await runChild(helpers,'react/add/element',{...target,tag:'div',new_data_area:area,new_seat_id:`area-${area}:a1${suffix}`});
    areas.push({id:`area-${area}:a1${suffix}`,role:'area',area});
  }
  return {status:'updated',type:'grid-layout',layout,gap,file:grid.result.file,component:grid.result.component??options.component??null,target:{seat_id:options.seat_id??null,area:options.area??null,defaulted_to_root:!options.seat_id&&!options.area},areas:shape.areas,construction_seats:areas,provided:{seats:{file:grid.result.file,grid_layout:layout}}};
};
