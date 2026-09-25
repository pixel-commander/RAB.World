import { readFile } from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
export const run=async args=>{
  const {renderTemplateTree,inspectUiKitTemplate}=args.helpers;
  const starter=args.options.starter??'minimal';
  if(!['minimal','style-guide'].includes(starter))throw Object.assign(new Error('Unknown React starter.'),{code:'BAD_REQUEST'});
  const assets=JSON.parse(await readFile(new URL('./assets/starter.json',import.meta.url),'utf8'));
  const additionalFiles=[...(starter==='style-guide'?assets.files:[]),...(args.options.add_database===true?assets.database:[])].map(file=>file.text===undefined?file:{...file,text:file.text.replaceAll('__PROJECT_NAME__',`{${JSON.stringify(args.options.name)}}`)});
  if(args.options.add_ui_kit===true){
    const kit=await args.helpers.getTool('react/seed/stamp-ui-kit');
    const inspected=await inspectUiKitTemplate(kit.template);
    if(!inspected.files&&!inspected.directories.length)throw Object.assign(new Error('The UI-kit template is empty; add its folders and files before selecting it. No project was created.'),{code:'UI_KIT_TEMPLATE_EMPTY'});
    const base=await renderTemplateTree(fileURLToPath(new URL('./template',import.meta.url)));
    const kitFiles=await renderTemplateTree(kit.template);
    if(!kitFiles.some(file=>file.path.replaceAll('\\','/')==='src/hooks/useURL/useURL.ts'))throw Object.assign(new Error('The React UI kit must include src/hooks/useURL/useURL.ts. No project was created.'),{code:'UI_KIT_URL_HOOK_MISSING'});
    const existing=[...base,...additionalFiles].map(file=>file.path.toLowerCase());
    const kitFilePaths=new Set(kitFiles.map(file=>file.path.toLowerCase()));
    const kitPaths=[...inspected.directories,...kitFiles.map(file=>file.path)];
    const conflict=kitPaths.find(candidate=>{
      const target=candidate.toLowerCase();
      return existing.some(source=>source===target||target.startsWith(`${source}/`)||kitFilePaths.has(target)&&source.startsWith(`${target}/`));
    });
    if(conflict)throw Object.assign(new Error(`UI-kit template conflicts with the React starter at ${conflict}. No project was created.`),{code:'UI_KIT_CONFLICT'});
  }
  const result=await args.helpers.runProjectStamp({additionalFiles});
  try{
    const project=result.project;
    const context={project,rab_home:args.context.rab_home};
    const seed=args.options.add_ui_kit===true?await args.helpers.runTool({key:'react/seed/stamp-ui-kit',options:{},context}):null;
    const final=await args.helpers.runTool({key:'react/seed/finalize-ui-kit',options:{seeded:Boolean(seed)},context});
    return {...result,ui_kit:seed?.result??null,finalization:final.result};
  }catch(error){error.project_created=result.project;throw error;}
};
