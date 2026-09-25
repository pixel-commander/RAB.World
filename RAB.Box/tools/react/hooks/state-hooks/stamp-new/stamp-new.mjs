import { runReactHookStamp } from '../../../../_stamp-engines.mjs';
const templateUrl=new URL('./template/tmpl.tsx',import.meta.url);
export const run=({options})=>runReactHookStamp({options,templateUrl,nativeSymbol:'useState',seats:['state-logic'],templateValues:{INITIAL_VALUE:options.initial_value}});
