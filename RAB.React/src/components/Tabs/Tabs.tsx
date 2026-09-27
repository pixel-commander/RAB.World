import type { TabsProps, TabStylers } from './Tabs.types';
import { useURL } from '../../hooks/useURL/useURL';
import { useTabs } from './hooks/useTabs';
import './css/tabs.css';
export type { TabsProps, TabItem, TabStylers } from './Tabs.types';

export const TAB_STYLERS: Record<'main', TabStylers> = {
  main: {
    tabs: 'container-main',
    tab: 'container-cell',
    nav: 'container-cell container-cell--inset',
    item: 'action-ghost',
  },
};

export const URLTabs = (props: TabsProps) => {
  const [url, handleURL] = useURL();
  const handleClick: TabsProps['handleClick'] = props?.handleClick || ((data, type) => {
    if (!data || type !== 'tab' || typeof data.name !== 'string') return;
    handleURL({ tab: data.name }, 'update-var');
  });
  const selected = props?.selected || (typeof url.url_vars.tab === 'string' ? url.url_vars.tab : undefined);
  props = { ...props, handleClick, selected, use_url: false };
  return <Tabs {...props} />;
};

export const Tabs = (props: TabsProps) => {
  if (props.use_url) return <URLTabs {...props} />;
  return <TabsView {...props} />;
};

const TabsView = ({ tabs = [], selected, side = 'top', styler: stylerName = 'main', stylers = {}, use_url = false, handleClick, className, children, ...domProps }: TabsProps) => {
  const { rootRef, id, items, activeIndex, handleSelect, handleKeyDown } = useTabs({ tabs, selected, side, handleClick });
  const styler = { ...TAB_STYLERS[stylerName], ...(stylers || {}) };
  return <div {...domProps} ref={rootRef} data-component="Tabs" className={`tabs tabs--${side} ${styler?.tabs || ''} ${className || ''}`}>
    <nav data-area="nav" role="tablist" aria-orientation={side === 'left' || side === 'right' ? 'vertical' : 'horizontal'} aria-label="Tabs" className={`tabs-nav ${styler?.nav || ''}`}>
      {items.map((item, index) => <button key={item.id} type="button" role="tab" data-id={`tab-${index}`}
        id={`${id}-tab-${index}`} aria-controls={`${id}-panel-${index}`} aria-selected={index === activeIndex}
        tabIndex={index === (activeIndex < 0 ? 0 : activeIndex) ? 0 : -1}
        className={`tabs-item ${styler?.item || ''}${index === activeIndex ? ' is-active' : ''}`}
        onClick={() => handleSelect(item.name)} onKeyDown={event => handleKeyDown(event, index)}>{item.name}</button>)}
    </nav>
    <div data-area="main" className={`tab-container scroll-y ${styler?.tab || ''}`}>
    {items.map(({ id: itemId, View }, index) => <div key={itemId} role="tabpanel" id={`${id}-panel-${index}`}
      aria-labelledby={`${id}-tab-${index}`} hidden={index !== activeIndex} tabIndex={0}
      className={`tabs-tab ${styler?.tab || ''}`}><View /></div>)}
    {children}
    </div>
  </div>;
};
