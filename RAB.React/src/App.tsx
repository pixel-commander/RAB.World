import { WorldStats } from './pages/WorldStats/WorldStats';
import { WorldAudit } from "./pages/WorldAudit/WorldAudit";
import { WorldView } from "./pages/WorldView/WorldView";
import './css/style.css';
import { StyleGuidePage } from './pages/StyleGuidePage/StyleGuidePage';
import { ComponentsPage } from './pages/ComponentsPage/ComponentsPage';
import { SiteShell } from './shell/components/SiteShell';
export const NAV_ITEMS = [
  { id: 'world-stats', name: 'world-stats', label: 'World Stats', View: WorldStats },
{ id: 'style-guide', name: 'style-guide', label: 'Style Guide', View: StyleGuidePage },
    { id: 'components', name: 'components', label: 'Components', View: ComponentsPage },
  { id: "world-view", name: "world-view", label: "World View", View: WorldView },
  { id: "world-audit", name: "world-audit", label: "World Audit", View: WorldAudit },
];

export const App = () => {
  return <SiteShell items={NAV_ITEMS} />;
};
