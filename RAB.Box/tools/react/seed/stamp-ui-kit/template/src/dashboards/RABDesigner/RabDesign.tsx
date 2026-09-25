import './css/rab-design.css';
import { AtomDesigner } from '../../pages/AtomDesigner/AtomDesigner.tsx';
import { ComponentDesigner } from '../../pages/ComponentDesigner/ComponentDesigner.tsx';
import { LayoutDesigner } from '../../pages/LayoutDesigner/LayoutDesigner.tsx';
import { GridDesigner } from '../../pages/GridDesigner/GridDesigner.tsx';
import { useURL } from '../../hooks/useURL/useURL.ts';

const TABS = [
  { label: 'ComponentDesigner', section: 'components' },
  { label: 'AtomDesigner', section: 'atoms' },
  { label: 'GridDesigner', section: 'grids' },
  { label: 'LayoutDesigner', section: 'layouts' },
];

export const RabDesign = () => {
  const [url, handleURL] = useURL();
  const current = TABS.some(({ section }) => section === url.section) ? url.section : 'components';
  return (
  <section className="rab-design container-grid-area" data-grid="header-main" aria-label="RABDesign">
    <header data-area="header">
      <div className="inner">
        <nav className="rab-design__tabs container-main" aria-label="RABDesign sections">
          {TABS.map(({ label, section }) => {
            return (
              <a key={section} className="action-nav-alt rab-design__tab"
                href={`/rab-design/${section}`} aria-current={current === section ? 'page' : undefined}
                onClick={(event) => {
                  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                  event.preventDefault();
                  handleURL({ section }, 'update-path');
                }}>{label}</a>
            );
          })}
        </nav>
      </div>
    </header>
    <div data-area="main" className="rab-design__views">
        <div className="rab-design__view" hidden={current !== 'components'}>
          <ComponentDesigner />
        </div>
        <div className="rab-design__view" hidden={current !== 'layouts'}>
          <LayoutDesigner />
        </div>
        <div className="rab-design__view" hidden={current !== 'atoms'}>
          <AtomDesigner />
        </div>
        <div className="rab-design__view" hidden={current !== 'grids'}>
          <GridDesigner />
        </div>
    </div>
  </section>
  );
};
