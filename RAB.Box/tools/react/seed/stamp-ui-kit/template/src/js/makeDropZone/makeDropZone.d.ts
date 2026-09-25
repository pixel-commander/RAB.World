import type { HandlerKey } from '../../HouseKeys.types.ts';
export interface DropZoneProps {
  handleDrag?: HandlerKey<DragEvent, string, boolean | void>;
  handleDragEnter?: HandlerKey<DragEvent>;
  handleDragOver?: HandlerKey<DragEvent, string, boolean | void>;
  handleDragLeave?: HandlerKey<DragEvent>;
  handleDrop?: HandlerKey<DragEvent>;
}
export type DropZoneRef = HTMLElement | { readonly current: HTMLElement | null } | null | undefined;
export declare function makeDropZone(ref?: DropZoneRef, props?: DropZoneProps): void;
export declare function handleRemove(ref?: DropZoneRef): void;
export default makeDropZone;
