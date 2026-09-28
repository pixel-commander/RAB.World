import {readRules} from '../_parse.mjs';
export const run=async({options={}}={})=>{return readRules(options.path);};
