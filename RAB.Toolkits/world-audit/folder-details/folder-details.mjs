import path from 'node:path';
import {updateFolders} from '../audit-runner/audit-store.mjs';
export const run=async({options,context})=>{
 if(!Array.isArray(options.paths)||!options.paths.length||!options.paths.every(value=>typeof value==='string'&&value.length>0))throw new Error('Folder paths required.');
 return updateFolders(path.join(context.rab_home,'worlds',options.world,'audits/audits.sqlite'),options.paths,'details',context.onProgress);
};
