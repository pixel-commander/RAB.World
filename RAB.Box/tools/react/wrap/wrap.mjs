import { runDomEdit } from '../_dom-edit.mjs';
export const run=async args=>runDomEdit({mode:`wrap-${args.tool.name}`,...args});
