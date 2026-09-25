import { runDomEdit } from '../_dom-edit.mjs';
export const run=async args=>runDomEdit({mode:args.tool.name==='class'?'change-class':`change-${args.tool.name}`,...args});
