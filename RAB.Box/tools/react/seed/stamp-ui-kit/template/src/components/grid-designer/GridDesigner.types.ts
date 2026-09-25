import type { GridBox, GridState, Track } from './geometry.ts';
import type { HandlerKey } from '../../HouseKeys.types.ts';

export interface GridDrawData {
  box: GridBox;
  state: GridState;
}

export interface GridDesignerProps {
  rows?: number;
  cols?: number;
  boxes?: GridBox[];
  rowTracks?: Track[];
  colTracks?: Track[];
  handleChange?: HandlerKey<GridState>;
  handleDraw?: HandlerKey<GridDrawData>;
  handleSave?: HandlerKey<unknown>;
  validate?: (state: GridState) => string | void;
  cssProvider?: (name: string, state: GridState) => string;
}

export interface GridDesignerHandle {
  getState: () => GridState;
  setState: (state: Partial<GridState>) => void;
  getAtomCss: (name?: string) => string;
  openSave: () => void;
  reset: () => void;
}
