import {pathValue} from '../../../../../bridge/project-paths.mjs';
import path from 'node:path';
import { readdir, readFile } from 'node:fs/promises';
import { loadProject } from '../../../../../engine/src/project.mjs';
import { createSeatParser } from '../../../../../bridge/seat-parser.mjs';
import { createCapabilityRegistry, compareShape } from '../../../../../bridge/capabilities.mjs';

const readJson = async file => JSON.parse(await readFile(file,'utf8'));
const safeRead = async file => { try { return await readJson(file); } catch { return null; } };

export const run = async ({ options, context, root }) => {
  const projectRoot=options.folder??context?.project?.root;
  if(!projectRoot){const error=new Error('Project folder is required.');error.code='INPUT_REQUIRED';throw error;}
  const project=await loadProject(projectRoot);
  const parser=await createSeatParser({languageRoot:path.join(root,'language')});
  const registry=await createCapabilityRegistry({projectRoot,seatParser:parser});
  const registered=new Set(registry.stamps.map(x=>x.name));
  const stamps=registry.stamps.map(cap=>{
    const neighbors=registry.stamps
      .filter(other=>other.name!==cap.name)
      .map(other=>({name:other.name,...compareShape({seats:cap.shape,data_types:cap.data_types},other)}))
      .filter(x=>!x.rejected&&x.score>0)
      .sort((a,b)=>b.score-a.score||b.ratio-a.ratio||a.name.localeCompare(b.name))
      .slice(0,5)
      .map(x=>({name:x.name,score:x.score,ratio:+x.ratio.toFixed(3),matches:x.matches.map(m=>m.seat)}));
    return {name:cap.name,registered:true,executable:cap.executable!==false,description:cap.description,description_complete:cap.descriptionParse?.complete===true,shape:cap.shape,data_types:cap.data_types,neighbors};
  });
  const projectSettings=await safeRead(path.join(projectRoot,'settings.json'))??{};
  const generatedRel=pathValue(projectSettings?.paths?.generated_stamps)??'generated-stamps';
  const generatedRoot=path.join(projectRoot,generatedRel);
  const generated=[];
  try{
    for(const entry of (await readdir(generatedRoot,{withFileTypes:true})).filter(e=>e.isDirectory()).sort((a,b)=>a.name.localeCompare(b.name))){
      const registration=await safeRead(path.join(generatedRoot,entry.name,'registration.json'));
      const settings=await safeRead(path.join(generatedRoot,entry.name,'settings.json'));
      const requested=registration?.name??settings?.name??entry.name;
      generated.push({folder:entry.name,name:requested,registered:registered.has(requested),registration,settings_present:!!settings});
    }
  }catch{}
  const report={version:'stamp-visibility-report/v0.9',project:{id:project.id,root:projectRoot},summary:{registered_stamps:stamps.length,description_complete:stamps.filter(x=>x.description_complete).length,generated_unregistered:generated.filter(x=>!x.registered).length},stamps,generated};
  return {status:'ok',report,provided:{seats:{report}}};
};
