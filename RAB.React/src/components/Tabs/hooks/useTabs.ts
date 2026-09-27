import { useId, useRef, type KeyboardEvent } from 'react';
import type { TabItem, TabsProps } from '../Tabs.types';
export const useTabs = ({ tabs, selected, side = 'top', handleClick }: Pick<TabsProps, 'tabs' | 'selected' | 'side' | 'handleClick'>) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const names = new Set<string>();
  const ids = new Set<string | number>();
  const items = (Array.isArray(tabs) ? tabs : []).filter((item): item is TabItem => {
    if (!item || (typeof item.id !== 'string' && typeof item.id !== 'number') || typeof item.name !== 'string' || !item.name || !item.View || names.has(item.name) || ids.has(item.id)) return false;
    names.add(item.name); ids.add(item.id); return true;
  });
  const activeName = selected === undefined ? items[0]?.name : selected;
  const activeIndex = items.findIndex(item => item.name === activeName);
  const handleSelect = (name: string) => {
    const item = items.find(tab => tab.name === name);
    if (!item) return;
    handleClick?.(item, 'tab');
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!items.length) return;
    let next: number;
    switch (event.key) {
      case 'ArrowRight': if (side === 'left' || side === 'right') return; next = (index + 1) % items.length; break;
      case 'ArrowLeft': if (side === 'left' || side === 'right') return; next = (index - 1 + items.length) % items.length; break;
      case 'ArrowDown': if (side !== 'left' && side !== 'right') return; next = (index + 1) % items.length; break;
      case 'ArrowUp': if (side !== 'left' && side !== 'right') return; next = (index - 1 + items.length) % items.length; break;
      case 'Home': next = 0; break;
      case 'End': next = items.length - 1; break;
      default: return;
    }
    event.preventDefault();
    rootRef.current?.querySelector<HTMLButtonElement>(`[data-id="tab-${next}"]`)?.focus();
    handleSelect(items[next].name);
  };
  return { rootRef, id, items, activeIndex, handleSelect, handleKeyDown };
};
