import path from 'node:path';
import { createRephraser } from '../../../bridge/rephrase.mjs';
import { createSeatParser } from '../../../bridge/seat-parser.mjs';

export const run = async ({ options, root, context }) => {
  const languageRoot=path.join(root,'language');
  const rephraser=createRephraser({languageRoot});
  const result=await rephraser.rephrase(options.text);
  const parser=await createSeatParser({languageRoot,projectOverrideFile:context?.project_language_override??null});
  return {...result,compiler:parser.parse(options.text,{context:{domain:context?.domain??null},knownEntities:[]})};
};
