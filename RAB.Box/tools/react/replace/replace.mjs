import { runDomEdit } from '../_dom-edit.mjs';
export const run=async args=>runDomEdit({mode:`replace-${args.tool.name}`,...args});
