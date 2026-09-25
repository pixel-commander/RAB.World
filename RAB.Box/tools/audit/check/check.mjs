import { access, realpath } from 'node:fs/promises';
import path from 'node:path';
import { walkFiles, readText, rel, slash } from '../_shared.mjs';
const exists=async file=>{try{await access(file);return true;}catch{return false;}};
export const run=async({options,context,tool})=>{
  if(tool.name!=='generated-files')throw Object.assign(new Error(`Unsupported audit check: ${tool.name}`),{code:'BAD_TOOL'});
  const projectRoot=path.resolve(context?.project?.root??options.folder??'.');
  const raw=options.generated_root;
  if(!raw)throw Object.assign(new Error('Provide generated_root.'),{code:'INPUT_REQUIRED'});
  const generatedRoot=path.isAbsolute(raw)?path.resolve(raw):path.resolve(projectRoot,raw);
  if(generatedRoot!==projectRoot&&!generatedRoot.startsWith(projectRoot+path.sep))throw Object.assign(new Error('generated_root must stay inside the loaded project/folder.'),{code:'INVALID_PATH'});
  if(!(await exists(generatedRoot)))throw Object.assign(new Error(`Generated root does not exist: ${raw}`),{code:'TARGET_NOT_FOUND'});
  const [projectReal,generatedReal]=await Promise.all([realpath(projectRoot),realpath(generatedRoot)]);
  if(generatedReal!==projectReal&&!generatedReal.startsWith(projectReal+path.sep))throw Object.assign(new Error('generated_root resolves outside the loaded project/folder.'),{code:'INVALID_PATH'});
  const allowed=new Set(String(options.allowed_extensions??'.tsx,.jsx,.ts,.js,.css').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean).map(x=>x.startsWith('.')?x:`.${x}`));
  const marker=String(options.provenance_marker??'').trim();
  const files=await walkFiles(generatedReal);const rows=[];
  for(const file of files){
    const fileRel=rel(projectReal,file);const ext=path.extname(file).toLowerCase();
    if(!allowed.has(ext))rows.push({file:fileRel,kind:'generated-extension-violation',extension:ext,allowed:[...allowed].sort()});
    if(marker){const text=await readText(file);if(!text.includes(marker))rows.push({file:fileRel,kind:'generated-provenance-missing',marker});}
  }
  rows.sort((a,b)=>a.file.localeCompare(b.file)||a.kind.localeCompare(b.kind));
  return{status:rows.length?'violations':'ok',scan:'check-generated-files',root:slash(generatedReal),policy:{allowed_extensions:[...allowed].sort(),provenance_marker:marker||null},totals:{files_scanned:files.length,violations:rows.length},rows};
};
