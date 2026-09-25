import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const safeName = value => {
  const name=String(value??'grid').trim();
  if(!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name)) throw Object.assign(new Error('Grid name must be a simple file name.'),{code:'BAD_REQUEST'});
  return name.replace(/\.html?$/i,'');
};

export const run = async ({options}) => {
  const resource=JSON.parse(await readFile(new URL('../grids.json',import.meta.url),'utf8'));
  const layout=String(options.layout??'shell');
  const shape=resource.layouts?.[layout];
  if(!shape) throw Object.assign(new Error(`Unknown grid layout ${layout}. Choose: ${Object.keys(resource.layouts??{}).join(', ')}`),{code:'BAD_REQUEST'});
  const gap=String(options.gap??'content');
  if(!(resource.gaps??[]).includes(gap)) throw Object.assign(new Error(`Unknown grid gap ${gap}. Choose: ${(resource.gaps??[]).join(', ')}`),{code:'BAD_REQUEST'});
  const location=path.resolve(options.location); await mkdir(location,{recursive:true});
  const constructionSeats=shape.areas.map(area=>({id:`area-${area}:a1`,role:'area',area}));
  const areas=constructionSeats.map(seat=>`  <section data-area="${seat.area}" data-rab-seat="${seat.id}">\n    <!-- [rab-seat:${seat.id}] -->\n  </section>`).join('\n');
  let text=await readFile(new URL('./template/tmpl.html',import.meta.url),'utf8');
  text=text.replaceAll('__GRID_LAYOUT__',layout).replaceAll('__GRID_GAP__',gap).replaceAll('__GRID_AREAS__',areas);
  const file=path.join(location,`${safeName(options.name)}.html`);
  await writeFile(file,text,{flag:'wx'});
  return {status:'created',type:'grid',layout,gap,areas:shape.areas,construction_seats:constructionSeats,file,path:file,provided:{file,path:file}};
};
