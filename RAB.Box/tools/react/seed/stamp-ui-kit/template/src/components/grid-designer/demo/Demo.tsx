import { GridDesigner } from '../GridDesigner.tsx';

// presence is registration: this file landing here puts grid-designer in the
// style guide. Static exemplar only -- no fetches, no stores.

export const Demo = () => (
  <div className="grid-designer-demo">
    <GridDesigner
      rows={4}
      cols={4}
      boxes={[{ id: 1, r1: 1, c1: 1, r2: 2, c2: 2, area: 'hero' }]}
    />
  </div>
);

export default Demo;
