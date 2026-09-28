import type { ComponentType } from 'react';
import { useURL } from '../../hooks/useURL/useURL';
import type { HandleURL, UrlState } from '../../hooks/useURL/useURL';
import { SiteNav } from './SiteNav';
import project from '../../../settings.json';
import '../css/shell.css';

export type NavItem = {
  id: string;
  name: string;
  label: string;
  View: ComponentType<ShellViewProps>;
};

export type ShellViewProps = {
  url: UrlState;
  handleURL: HandleURL;
  selected: string;
};

export type SiteShellProps = {
  items: NavItem[];
};

export const SiteShell = ({ items }: SiteShellProps) => {
  const [url, handleURL] = useURL();
  const page = typeof url.page === 'string' ? url.page : '';
  const selected = items.some((item) => item.name === page) ? page : items[0]?.name ?? '';
  const active = items.find((item) => item.name === selected);
  const View = active?.View;

  return (
    <section data-grid="shell" data-component="SiteShell" className="site-shell">
      <header data-area="header" className="site-header container-cell">
        <div className="site-brand"><span className="brand-mark" aria-hidden="true">R</span><strong>{project.name}</strong></div>
        <SiteNav items={items} selected={selected} handleClick={(name) => handleURL({ page: name }, 'set-path')} />
      </header>
      <div data-area="main">
        {View ? <View url={url} handleURL={handleURL} selected={selected} /> : <p>No page is available.</p>}
      </div>
      <footer data-area="footer" className="site-footer">{project.name}</footer>
    </section>
  );
};
