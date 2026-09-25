import type { ComponentType, ReactNode } from 'react';
import './style-guide.css';
import { useURL } from '../../hooks/useURL/useURL.ts';
import { demoIndex } from '../../demoRegistry.ts';

const SURFACES = [
  'surface-app', 'surface-main', 'surface-inset', 'surface-float', 'surface-hover',
  'surface-active', 'surface-selected', 'accent-default', 'accent-soft',
  'accent-secondary', 'danger-default', 'danger-soft',
];
const BORDERS = ['border-subtle', 'border-default', 'border-strong', 'border-focus', 'border-danger'];
const SPACES = ['2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl'];

const Section = ({
  title,
  note,
  children,
  grid = false,
}: {
  title: string;
  note?: string;
  children?: ReactNode;
  grid?: boolean;
}) => (
  <section className="style-guide__section demo-stack">
    <h2>{title}</h2>
    {note && <p className="demo-note">{note}</p>}
    <div className={grid ? 'demo-grid' : 'demo-stack'}>{children}</div>
  </section>
);

const SECTIONS: Record<string, ComponentType> = {
  surfaces: () => (
    <Section title="Surfaces" note="theme tokens from themes/dark/colors.css; every fill in the system uses one of these" grid>
      {SURFACES.map((token) => (
        <div key={token} className="swatch">
          <span className={`swatch__chip swatch__chip--${token}`} />
          <span className="swatch__label">{`--${token}`}</span>
        </div>
      ))}
    </Section>
  ),
  borders: () => (
    <Section title="Borders" grid>
      {BORDERS.map((token) => (
        <div key={token} className="swatch">
          <span className={`swatch__chip swatch__chip--${token}`} />
          <span className="swatch__label">{`--${token}`}</span>
        </div>
      ))}
    </Section>
  ),
  containers: () => (
    <Section
      title="Containers"
      note="atom skins from css/containers.css; stack the class on any element — the atom owns skin only, never padding or structure"
      grid
    >
      {['container-main', 'container-inset', 'container-float'].map((atom) => (
        <div key={atom} className={`${atom} pad`}>
          <span className="swatch__label">{atom}</span>
        </div>
      ))}
    </Section>
  ),
  rows: () => (
    <Section title="Actions" note="action atoms from css/actions.css; the DOM role never enters the atom name">
      <button type="button" className="action-main pad">action-main</button>
      <button type="button" className="action-fill-alt pad">action-fill-alt</button>
      <button type="button" className="action-muted pad">action-muted</button>
      <button type="button" className="action-nav pad">action-nav</button>
      <button type="button" className="action-nav-alt pad">action-nav-alt</button>
      <button type="button" className="action-nav pad" aria-current="page">action-nav · aria-current=&quot;page&quot;</button>
      <button type="button" className="action-main pad" disabled>action-main · disabled</button>
    </Section>
  ),
  typography: () => (
    <Section title="Typography" note="type tokens from themes/layout/layout.css; content colors from the theme">
      <div className="demo-example demo-stack">
        <span className="type-sample type-sample--heading">--type-heading · The quick brown fox</span>
        <span className="type-sample type-sample--body">--type-body · The quick brown fox jumps over the lazy dog</span>
        <span className="type-sample type-sample--label">--type-label · THE QUICK BROWN FOX</span>
        <span className="type-sample type-sample--code">--type-code · const fox = &apos;quick&apos;;</span>
        <span className="type-sample type-sample--muted">--content-muted · secondary copy</span>
        <span className="type-sample type-sample--accent">--content-accent · highlighted copy</span>
        <span className="type-sample type-sample--danger">--content-danger · error copy</span>
      </div>
    </Section>
  ),
  spacing: () => (
    <Section title="Spacing" note="space tokens from themes/layout/layout.css; pad, gap, and data-gap all resolve to these">
      <div className="demo-example demo-stack">
        {SPACES.map((step) => (
          <div key={step} className="space-sample">
            <span className={`space-sample__bar space-sample__bar--${step}`} />
            <span className="swatch__label">{`--space-${step}`}</span>
          </div>
        ))}
      </div>
    </Section>
  ),
  components: () => (
    <Section
      title="Components"
      note="auto-indexed from components/*/demo/Demo.tsx; give a component a demo and it appears here"
      grid
    >
      {demoIndex.map(({ path, Demo }) => (
        <div key={path} className="demo-example demo-stack">
          <span className="demo-note">{path}</span>
          <Demo />
        </div>
      ))}
    </Section>
  ),
};

const NAV: Array<[string, string]> = [
  ['surfaces', 'Surfaces'],
  ['borders', 'Borders'],
  ['containers', 'Containers'],
  ['rows', 'Rows'],
  ['typography', 'Typography'],
  ['spacing', 'Spacing'],
  ['components', 'Components'],
];

export const StyleGuidePage = () => {
  const [url, handleURL] = useURL();
  const section = url.section as string;
  const name = SECTIONS[section] ? section : 'surfaces';
  const Body = SECTIONS[name];
  return (
    <section className="style-guide-page" data-grid="side-left">
      <aside data-area="side">
        <div className="inner pad">
          <div className="style-guide__brand">
            <span className="style-guide__name">RAB UI</span>
            <span>tokens · components · react + ts</span>
          </div>
          <nav className="style-guide__nav">
            {NAV.map(([key, label]) => (
              <a
                key={key}
                className="action-nav"
                href={`/style-guide/${key}`}
                aria-current={key === name ? 'page' : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  handleURL({ section: key }, 'update-path');
                }}
              >
                {label}
              </a>
            ))}
          </nav>
        </div>
      </aside>
      <div data-area="main">
        <div className="inner pad scroll">
          <Body />
        </div>
      </div>
    </section>
  );
};
