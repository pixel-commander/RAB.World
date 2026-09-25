import { inspectScaffolding, readArtifact } from '../_scaffolding.mjs';

export const run=async({options,context})=>{
  const artifact=await readArtifact({options,context});
  const markers=inspectScaffolding(artifact.text);
  return {
    status:'inspected',
    file:artifact.relative,
    construction_seats:markers.map(({id,kind,index})=>({id,kind,index})),
    count:markers.length
  };
};
