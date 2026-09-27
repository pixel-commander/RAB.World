import { WorldView } from "./pages/WorldView/WorldView";
import './css/style.css';
import { StyleGuidePage } from './pages/StyleGuidePage/StyleGuidePage';
import { ComponentsPage } from './pages/ComponentsPage/ComponentsPage';
import { SiteShell } from './shell/components/SiteShell';
export const NAV_ITEMS = [
{ id: 'style-guide', name: 'style-guide', label: 'Style Guide', View: StyleGuidePage },
    { id: 'components', name: 'components', label: 'Components', View: ComponentsPage },
  { id: "world-view", name: "world-view", label: "World View", View: WorldView },
];

export const App = () => {
  return <SiteShell items={NAV_ITEMS} />;
};
