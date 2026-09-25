import type { RefObject } from 'react';
import type { HandlerKey } from '../../HouseKeys.types.ts';
export interface CodePreviewProps {
  sourceRef?: RefObject<HTMLElement>;
  sourceId?: string;
  handleChange?: HandlerKey<HTMLElement, string, string>;
}
