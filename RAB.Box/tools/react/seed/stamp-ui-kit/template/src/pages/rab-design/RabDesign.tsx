import './css/rab-design.css';
import { AtomDesigner } from '../../components/AtomDesigner/AtomDesigner.tsx';
import { GridDesigner } from '../../components/grid-designer/GridDesigner.tsx';
import { useURL } from '../../hooks/useURL/useURL.ts';

const TABS = ['Components', 'Atoms', 'Grids', 'Layouts'];

export const RabDesign = () => {
  const [url, handleURL] = useURL();
  const current = TABS.some((label) => label.toLowerCase() === url.section) ? url.section : 'components';
  return (
  <section className="rab-design container-grid-area" data-grid="shell" aria-label="RABDesign">
    <header data-area="header">
      <div className="inner">
        <nav className="rab-design__tabs container-main" aria-label="RABDesign sections">
          {TABS.map((label) => {
            const section = label.toLowerCase();
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
    <div data-area="main">
      <div className="inner scroll">
        <div className="rab-design__view rab-design__view--fill" data-rows="1" hidden={current !== 'atoms'}>
          <AtomDesigner />
        </div>
        <div className="rab-design__view" hidden={current !== 'grids'}>
          <GridDesigner />
        </div>
      </div>
    </div>
    <footer data-area="footer">
      <div className="inner rab-design__actions">
        <button type="button" className="action-fill-alt rab-design__button">ship-it</button>
      </div>
    </footer>
  </section>
  );
};
