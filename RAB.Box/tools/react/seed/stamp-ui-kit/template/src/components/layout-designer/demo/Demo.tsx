import { LayoutDesigner } from '../LayoutDesigner.tsx';
import StatCardDemo from '../../stat-card/demo/Demo.tsx';

/* live demo: the real board; the first seed arrives loaded the way a
   palette drop lands */
export default () => (
  <LayoutDesigner
    initialBoxes={[
      { id: 'seed-1', r1: 0, c1: 0, r2: 1, c2: 1, content: { name: 'stat-card' } },
      { id: 'seed-2', r1: 3, c1: 2, r2: 4, c2: 3 },
    ]}
    renderContent={(spec) => (spec.name === 'stat-card' ? <StatCardDemo /> : null)}
  />
);
