import { runArtifactEdit } from '../_artifact-edit.mjs';
export const run=async({options,context,tool})=>runArtifactEdit({mode:'save-as',targetType:tool.meta.target_type,options,context});
