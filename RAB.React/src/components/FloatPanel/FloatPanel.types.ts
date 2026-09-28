import type {HandlerKey} from '../../HouseKeys.types';
import type { HTMLAttributes, ReactNode } from 'react';

export type Edge = 't' | 'r' | 'b' | 'l' | 'tl' | 'tr' | 'bl' | 'br';

export interface FloatPanelStylers {
  container: string;
}

export interface FloatPanelProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  styler?: 'main';
  stylers?: Partial<FloatPanelStylers>;
  data?: unknown;
  handleClose?: HandlerKey<unknown, 'float-panel'>;
  title?: ReactNode;
  children?: ReactNode;
  hidden?: boolean;
  collapsed?: boolean;
  resizable?: boolean;
  docked?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

