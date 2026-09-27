import type { ComponentType, HTMLAttributes } from 'react';
import type { HandleClick } from '../../HouseKeys.types';
export interface TabItem { id: string | number; name: string; View: ComponentType; }
export interface TabStylers { tabs: string; tab: string; nav: string; item: string; }
export interface TabsProps extends HTMLAttributes<HTMLDivElement> {
  tabs?: TabItem[];
  selected?: string;
  side?: 'top' | 'left' | 'right' | 'bottom';
  styler?: 'main';
  stylers?: Partial<TabStylers>;
  use_url?: boolean;
  handleClick?: HandleClick<TabItem>;
}
