import { cleanScaffolding, readArtifact, writeArtifact } from '../_scaffolding.mjs';

export const run=async({options,context})=>{
  const artifact=await readArtifact({options,context});
  const cleaned=cleanScaffolding(artifact.text);
  if(cleaned.changed&&!options.dry_run)await writeArtifact(artifact.file,cleaned.text);
  return {
    status:options.dry_run?'preview':cleaned.changed?'cleaned':'unchanged',
    file:artifact.relative,
    changed:cleaned.changed,
    removed:cleaned.markers.map(({id,kind,index})=>({id,kind,index})),
    removed_count:cleaned.markers.length
  };
};
