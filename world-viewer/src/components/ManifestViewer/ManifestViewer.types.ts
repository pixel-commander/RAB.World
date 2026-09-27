import type { HTMLAttributes } from 'react';
import type { BaseKeys } from '../../HouseKeys.types';

export interface ManifestEntry extends BaseKeys {
  type?: string;
  key?: string;
  authority?: string | null;
  files?: string[];
  items?: ManifestEntry[] | Record<string, ManifestEntry>;
}
export interface ManifestData extends ManifestEntry {
  items: ManifestEntry[] | Record<string, ManifestEntry>;
  generated_at?: string;
}
export type ManifestViewerProps = Omit<HTMLAttributes<HTMLDivElement>, 'id'> & BaseKeys & { manifest?: ManifestData; onOpenFile?: (path: string) => void };
