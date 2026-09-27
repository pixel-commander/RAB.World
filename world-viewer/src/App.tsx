import { Beacon } from './pages/Beacon/Beacon';
import { Default } from './pages/Default/Default';
import { World } from './pages/World/World';
import { SiteShell } from './shell/components/SiteShell';
import './css/styles.css';

export const App = () => {
  return <SiteShell items={[
    { id: 'default', name: 'default', label: 'Home', View: Default },
    { id: 'world', name: 'world', label: 'World', View: World },
    { id: 'beacon', name: 'beacon', label: 'Beacon', View: Beacon },
  ]} />;
};
