import { fileURLToPath } from 'node:url';
const templateUrl=new URL('./template/tmpl.tsx',import.meta.url);
export const run=input=>input.helpers.runReactComponentStamp({templateUrl,templateDirectory:fileURLToPath(new URL('./template',import.meta.url)),parentOption:'location',templateValues:{DEFAULT_CLASS:JSON.stringify(input.options.class_name??'')}});
