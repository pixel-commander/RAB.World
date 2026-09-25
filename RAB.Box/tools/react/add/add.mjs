import { runDomEdit } from '../_dom-edit.mjs';
export const run=async args=>runDomEdit({mode:args.tool.name==='element'?'add-element':args.tool.name==='class'?'add-class':`add-${args.tool.name}`,...args});
