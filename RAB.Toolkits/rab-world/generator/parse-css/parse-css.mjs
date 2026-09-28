import {run as tokens} from './tokens/tokens.mjs';
import {run as classes} from './classes/classes.mjs';
import {run as resolveTokens} from './resolve-tokens/resolve-tokens.mjs';
import {readFile} from 'node:fs/promises';
export const run=async({options={},context={},helpers={}}={})=>{
 const call=async(name,execute,input)=>{if(!helpers.runTool)return execute({options:input,context,helpers});const settings=JSON.parse(await readFile(new URL(`./${name}/settings.json`,import.meta.url),'utf8'));const result=await helpers.runTool({key:String(settings.id),options:input,context});return result.result??result;};
 const tokenResult=await call('tokens',tokens,{paths:options.paths??[]});
 const classResult=await call('classes',classes,{path:options.path});
 return call('resolve-tokens',resolveTokens,{tokens:tokenResult,classes:classResult});
};
