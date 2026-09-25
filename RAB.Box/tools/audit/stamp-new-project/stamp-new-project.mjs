import { runProjectStamp } from '../../_stamp-engines.mjs';
import { createRabMemory } from '../../../bridge/rab-memory.mjs';
import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';

export const run=async args=>{
  const {options,context}=args;
  let folder;
  try{
    if(!path.isAbsolute(options.folder))throw new Error('Use the full path to the folder to audit.');
    folder=await realpath(options.folder);
    if(!(await stat(folder)).isDirectory())throw new Error('The audit target must be an existing folder.');
  }catch(error){throw Object.assign(new Error(`Choose an existing folder to audit: ${error.message}`),{code:'BAD_INPUT',field:'folder'});}
  const memory=createRabMemory({rabHome:context.rab_home});
  const projectId=await memory.allocateId();
  const destination=memory.newProjectPath(options.name);
  const relative=path.relative(memory.rabHome,folder);
  if(relative===''||(!relative.startsWith(`..${path.sep}`)&&relative!=='..'&&!path.isAbsolute(relative)))throw Object.assign(new Error('Choose source files outside .rab storage. A drive or parent folder containing .rab is allowed; .rab itself is excluded from auditing.'),{code:'BAD_INPUT',field:'folder'});
  let result;
  try{result=await runProjectStamp({...args,destination,projectId,templateValues:{AUDIT_FOLDER:folder}});}
  catch(error){
    if(error.code==='EEXIST')throw Object.assign(new Error(`Project folder already exists: ${destination}. Load that project or choose a different name.`),{code:'EEXIST',field:'name'});
    throw error;
  }
  return result;
};
