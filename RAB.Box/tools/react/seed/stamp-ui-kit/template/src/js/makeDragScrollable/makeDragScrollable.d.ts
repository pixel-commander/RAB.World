import type { HandlerKey } from '../../HouseKeys.types.ts';
export interface DragScrollableOptions {
  size?: number;
  label?: string;
  /** Return false when another interaction owns this gesture. */
  handleDragStart?: HandlerKey<PointerEvent, 'scroll', boolean | void>;
  handlePointerDown?: HandlerKey<PointerEvent>;
  handlePointerMove?: HandlerKey<PointerEvent>;
  handlePointerUp?: HandlerKey<PointerEvent>;
  handlePointerCancel?: HandlerKey<PointerEvent>;
  handleKeyDown?: HandlerKey<KeyboardEvent>;
  handleMouseEnter?: HandlerKey<PointerEvent>;
  handleMouseLeave?: HandlerKey<PointerEvent>;
  handleFocus?: HandlerKey<FocusEvent>;
  handleBlur?: HandlerKey<FocusEvent>;
}
export declare function makeDragScrollable(element?: HTMLElement | null, options?: DragScrollableOptions): void;
export declare function handleRemove(element?: HTMLElement | null): void;
export default makeDragScrollable;
