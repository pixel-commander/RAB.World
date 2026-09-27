import { useState } from 'react';
import { FloatPanel } from '../FloatPanel.tsx';

export default () => {
  const [collapsed, setCollapsed] = useState(false);
  return <FloatPanel title="Live css" collapsed={collapsed} onCollapsedChange={setCollapsed}><span className="demo-note">collapsible · draggable · fixed over the page</span></FloatPanel>;
};
