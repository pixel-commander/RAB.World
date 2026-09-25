import { createSignalSettings } from '../_signal.mjs';
const templateUrl=new URL('./template/tmpl.tsx',import.meta.url);
export const run=input=>input.helpers.runReactComponentStamp({templateUrl,parentOption:'location',templateValues:{DEFAULT_CLASS:JSON.stringify(input.options.class_name??'')},
  createSettings:(values,{folder})=>createSignalSettings({templateUrl:new URL('./template/settings.json',import.meta.url),folder,values,options:input.options,context:input.context,helpers:input.helpers})});
