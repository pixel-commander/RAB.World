import './demos.css';
import { useURL } from '../../hooks/useURL/useURL.ts';
import { demoIndex } from '../../demoRegistry.ts';

export const DemosPage = () => {
  const [url, handleURL] = useURL();
  const section = url.section as string;
  const indexed = demoIndex.filter((entry) => entry.indexed);
  const current = indexed.some((entry) => entry.name === section) ? section : null;
  const shown = current ? indexed.filter((entry) => entry.name === current) : indexed;

  return (
    <section className="demos-page" data-grid="side-left">
      <aside data-area="side">
        <div className="inner pad">
          <nav className="demos__nav">
            <a
              className="action-nav"
              href="/demos"
              aria-current={current ? undefined : 'page'}
              onClick={(event) => {
                event.preventDefault();
                handleURL({ section: undefined }, 'update-path');
              }}
            >
              All components
            </a>
            {indexed.map((entry) => (
              <a
                key={entry.path}
                className="action-nav"
                href={`/demos/${entry.name}`}
                aria-current={entry.name === current ? 'page' : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  handleURL({ section: entry.name }, 'update-path');
                }}
              >
                {entry.path}
              </a>
            ))}
          </nav>
        </div>
      </aside>
      <div data-area="main">
        <div className="inner pad scroll" data-rows="1">
          <section className="demos__section demo-stack">
            <h2>{current && shown[0] ? shown[0].path : 'Demos'}</h2>
            <p className="demo-note">auto-collected from components/*/settings.ts — indexed: true</p>
            <div className="demo-grid">
              {shown.map(({ path, Demo }) => (
                <div key={path} data-grid="header-main">
                  <span className="demo-note" data-area="header">{path}</span>
                  <div data-area="main">
                    <Demo />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
};
