import type { ComponentType, ReactNode } from 'react';
import './css/style-guide-page.css';
import { useStyleGuidePage } from './hooks/useStyleGuidePage';
import type { AtomCategory } from './StyleGuidePage.types';

const SURFACES = [
  'surface-app', 'surface-main', 'surface-inset', 'surface-float', 'surface-hover',
  'surface-active', 'surface-selected', 'accent-default', 'accent-soft',
  'danger-default', 'danger-soft',
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
    <Section title="Surfaces" note="theme tokens from themes/colors/dark/colors.css; every fill in the system uses one of these" grid>
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
  typography: () => (
    <Section title="Typography" note="type tokens from themes/layout/layout.css; content colors from the theme">
      <div className="demo-example demo-stack">
        <span className="type-sample type-sample--heading">--type-heading Â· The quick brown fox</span>
        <span className="type-sample type-sample--body">--type-body Â· The quick brown fox jumps over the lazy dog</span>
        <span className="type-sample type-sample--label">--type-label Â· THE QUICK BROWN FOX</span>
        <span className="type-sample type-sample--code">--type-code Â· const fox = &apos;quick&apos;;</span>
        <span className="type-sample type-sample--main">--color-main · Main text</span>
        <span className="type-sample type-sample--negative">--color-negative · Opposite text</span>
        <span className="type-sample type-sample--muted">--content-muted Â· secondary copy</span>
        <span className="type-sample type-sample--accent">--content-accent Â· highlighted copy</span>
        <span className="type-sample type-sample--danger">--content-danger Â· error copy</span>
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

};

const AtomExamples = ({ category }: { category: AtomCategory }) => {
  return <Section title={category.title} grid>
    {category.items.length === 0 && <p>No atoms are listed in this manifest.</p>}
    {category.items.map((item) => {
      const Demo = item.Demo;
      return <article key={item.path} className="demo-example demo-stack">
        <h3>{item.title}</h3>
        {item.description && <p className="demo-note">{item.description}</p>}
        {Demo ? <Demo /> : <p className="demo-note">Demo not available.</p>}
      </article>;
    })}
  </Section>;
};

export const StyleGuidePage = () => {
  const { group, nav, name, category, handleURL } = useStyleGuidePage();
  const Body = group === 'theme' ? SECTIONS[name] : undefined;
  return (
    <section className="style-guide-page" data-grid="side-left" data-rows="1">
      <aside data-area="side"><div className="inner pad">
        <nav className="style-guide__tabs" data-cols="2" aria-label="Style guide categories">
          {(['theme', 'atoms'] as const).map((key) => (
            <a key={key} className="action-nav-alt" href={`/style-guide/${key}`}
              aria-selected={group === key}
              onClick={(event) => {
                if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
                event.preventDefault(); handleURL({ page: 'style-guide', group: key }, 'update-path');
              }}>{key === 'theme' ? 'Theme' : 'Atoms'}</a>
          ))}
        </nav>
        <nav className="style-guide__nav" aria-label={group === 'theme' ? 'Theme sections' : 'Atom manifests'}>
          {nav.map(([key, label]) => (
            <a key={key} className="action-nav-alt" href={`/style-guide/${group}/${encodeURIComponent(key)}`}
              aria-selected={name === key}
              onClick={(event) => {
                if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
                event.preventDefault(); handleURL({ page: 'style-guide', group, section: key }, 'update-path');
              }}>{label}</a>
          ))}
        </nav>
      </div></aside>
      <div data-area="main"><div className="inner pad scroll">
        {Body ? <Body /> : category ? <AtomExamples category={category} /> : <p>No atom manifests are available.</p>}
      </div></div>
    </section>
  );
};
