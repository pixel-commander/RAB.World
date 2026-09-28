import './css/styles.css';
import { StyleGuidePage } from './pages/StyleGuidePage/StyleGuidePage';
import { Default } from './pages/Default/Default';
import { SiteShell } from './shell/components/SiteShell';

export const NAV_ITEMS = [{ id: 'style-guide', name: 'style-guide', label: 'Style Guide', View: StyleGuidePage }, { id: 'default', name: 'default', label: 'Home', View: Default }];

export const App = () => {
  return <SiteShell items={NAV_ITEMS} />;
};
