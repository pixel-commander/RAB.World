import './css/grid-designer.css';
import { GridDesigner as Designer } from '../../components/grid-designer/GridDesigner.tsx';

export const GridDesigner = () => (
  <section className="grid-designer-page" data-rows="1" aria-label="GridDesigner">
    <Designer />
  </section>
);
