import path from 'node:path';
import { stat } from 'node:fs/promises';
import { checkedAbsolutePath } from '../tools/_artifact-plan.mjs';
import { insist } from '../engine/src/core.mjs';

// Only a runner helper can create this in-process scope; JSON/API callers cannot
// forge it. It permits read-only child tools on one staged source directory.
export const SCRATCH_SCOPE=Symbol('tool-scratch-scope');
const scopes=new WeakSet();
export const createScratchScope=async({folder,rabHome})=>{
  insist(typeof folder==='string'&&path.isAbsolute(folder),'INVALID_SCRATCH','Scratch folder must be absolute.');
  const root=await checkedAbsolutePath(path.join(rabHome,'temp','test'));
  const target=await checkedAbsolutePath(folder),relative=path.relative(root,target).split(path.sep).join('/');
  insist(/^[1-9]\d*\/source$/.test(relative)&&Number.isSafeInteger(Number(relative.split('/')[0])),'INVALID_SCRATCH','Scratch source must be .rab/temp/test/<numeric-id>/source.');
  insist((await stat(target)).isDirectory(),'INVALID_SCRATCH','Scratch source must be a directory.');
  const scope=Object.freeze({folder:target});scopes.add(scope);return scope;
};
export const validateScratchInput=async({scope,tool,options})=>{
  insist(scopes.has(scope)&&String(tool.meta.authority??'read').toLowerCase()==='read','INVALID_SCRATCH','Scratch execution only permits read-only tools.');
  insist(typeof options.folder==='string'&&await checkedAbsolutePath(options.folder)===scope.folder,'INVALID_SCRATCH','The child must inspect the declared scratch source.');
};
