import { runDomEdit } from '../_dom-edit.mjs';
export const run=async args=>runDomEdit({mode:args.tool.name==='class'?'remove-class':`remove-${args.tool.name}`,...args});
