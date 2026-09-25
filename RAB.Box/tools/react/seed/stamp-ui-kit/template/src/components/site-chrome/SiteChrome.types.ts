import type { ReactNode } from 'react';

export interface SiteChromeProps {
  can_move?: boolean;
  header?: ReactNode;
  children?: ReactNode;
}
