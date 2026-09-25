import './css/layout-designer.css';
import { LayoutDesigner as Designer } from '../../components/layout-designer/LayoutDesigner.tsx';

export const LayoutDesigner = () => (
  <section className="layout-designer-page" data-rows="1" aria-label="LayoutDesigner">
    <Designer />
  </section>
);
