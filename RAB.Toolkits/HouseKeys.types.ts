/*
  HOUSE KEYS — shared vocabulary, never a universal component contract.

  This file says which shared names belong to the house. It intentionally
  leaves contracts open. Each owner narrows the keys it uses in its own types
  file, where the real data, event, and return shapes are known.

  Import only the narrow handler exports an owner needs. There is no aggregate
  HouseKeys export.
*/

/**
 * Every house handler keeps the same two-slot shape. Both slots stay optional
 * under receiver law: expect nothing and guard anything that arrives.
 * data carries the thing; type is the final dispatch slot.
 */
export type HandlerKey<Data = unknown, Type extends string = string, Result = unknown> = (
  data?: Data,
  type?: Type,
) => Result;

/**
 * data carries the selected row/value.
 * type is the reserved final dispatch slot when one caller serves more than
 * one owned action or return shape.
 */
export type HandleClick<Data = unknown> = HandlerKey<Data>;

/**
 * data carries the form's collected values.
 * type lets one caller dispatch submissions from multiple owned forms.
 */
export type HandleSubmit<Data = unknown> = HandlerKey<Data>;

/* any is intentional here: this interface validates vocabulary without forcing
   one owner's payload contract onto another. Owners narrow with HandlerKey<Data>. */
export interface HandlerKeys {
  handleClick?: HandleClick<any>;
  handleClickOutside?: HandlerKey<any>;
  handleChange?: HandlerKey<any>;
  handleDraw?: HandlerKey<any>;
  handleInputChange?: HandlerKey<any>;
  handleSubmit?: HandleSubmit<any>;
  handleSave?: HandlerKey<any>;
  handleCancel?: HandlerKey<any>;
  handleClose?: HandlerKey<any>;
  handleToggle?: HandlerKey<any>;
  handleFilter?: HandlerKey<any>;
  handleFocus?: HandlerKey<any>;
  handleBlur?: HandlerKey<any>;
  handleKeyDown?: HandlerKey<any>;
  handleSelect?: HandlerKey<any>;
  handleInsert?: HandlerKey<any>;
  handleRemove?: HandlerKey<any>;
  handleClear?: HandlerKey<any>;
  handleZoom?: HandlerKey<any>;
  handleURL?: HandlerKey<any>;
  handleTransfer?: HandlerKey<any>;
  handleMove?: HandlerKey<any>;

  handleDrag?: HandlerKey<any>;
  handleDrop?: HandlerKey<any>;
  handleDragOver?: HandlerKey<any>;
  handleDragEnter?: HandlerKey<any>;
  handleDragLeave?: HandlerKey<any>;
  handleDragStart?: HandlerKey<any>;
  handleDragEnd?: HandlerKey<any>;

  handlePointerDown?: HandlerKey<any>;
  handlePointerMove?: HandlerKey<any>;
  handlePointerUp?: HandlerKey<any>;
  handlePointerCancel?: HandlerKey<any>;

  handleMouseEnter?: HandlerKey<any>;
  handleMouseLeave?: HandlerKey<any>;
  handleMouseMove?: HandlerKey<any>;
  handleMouseUp?: HandlerKey<any>;
  handleMouseDown?: HandlerKey<any>;
}
/* The shared doorway for every DB/JSON record. Owners add their specific keys
   locally without renaming this base shape. New record IDs and date fields
   prefer Date.now() epoch milliseconds. A collision exposes duplicate work;
   fix the repeated trigger or reload instead of adding entropy. string remains
   accepted for inherited IDs. Receivers still guard everything that arrives. */
export interface DataKeys {
  id?: string | number;
  // short one or two words, can be heiphenated
  name?: string;
  // short sentence for seats with more space.
  title?: string;
  // can be any length, this gets displayed on full layout
  description?: string;
  added_by?: string | number;
  count?: number;
  date?: number;
  date_start?: number;
  date_added?: number;
  date_end?: number;
}

/** Shared event collection; each owner extends DataKeys for its event fields. */
export interface EventsKeys<Event extends DataKeys = DataKeys> {
  events?: Event[];
}
