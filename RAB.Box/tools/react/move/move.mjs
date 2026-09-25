import { runDomEdit } from '../_dom-edit.mjs';
export const run=async args=>runDomEdit({mode:`move-${args.tool.name}`,...args});
