import { SiteChrome } from '../SiteChrome.tsx';

// presence is registration: this file landing here puts site-chrome in the
// style guide. Static exemplar only -- no fetches, no stores.

export const Demo = () => (
  <SiteChrome header={<span>Site navigation</span>}>
    <div className="container-cell container-cell--inset pad" data-rows="1">
      <span>Scrollable site content renders here.</span>
    </div>
  </SiteChrome>
);

export default Demo;
