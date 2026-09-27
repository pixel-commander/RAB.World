import type { ShellViewProps } from '../../shell/components/SiteShell';

export interface WorldViewProps extends Partial<ShellViewProps> {
  path?: string;
}

export interface WorldSettings {
  id: number;
  name: string;
  title?: string;
  description?: string;
  date_added?: string;
  paths?: Array<{ id: number; name: string; title?: string; path: string }>;
}
