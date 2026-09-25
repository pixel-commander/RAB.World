import { runSecurityVerification } from '../_verify.mjs';
export const run=async({tool,root})=>runSecurityVerification({root,check:tool.meta?.config?.check??'all'});
