import type { HandlerKey, HandleSubmit } from '../../HouseKeys.types.ts';
import type { ReactNode, RefObject } from 'react';

export type FormFieldElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
/** FormData entries stay strings or Files; collection does not coerce their types. */
export type FormValues = Record<string, FormDataEntryValue>;

/**
 * A generated field's bag. Types describe understood values, not trusted input:
 * receivers still guard runtime data and preserve valid false, zero, and ''.
 */
export interface InputGroupBaseProps {
  /** Collection key. Give unrelated fields distinct names. */
  name: string;
  id?: string;
  type?: string;
  label?: ReactNode;
  helper_text?: string;
  error_message?: string;
  tab_index?: number;
  is_required?: boolean;
  is_disabled?: boolean;
  placeholder?: string;
  /** Initial uncontrolled value; default_value takes precedence when non-nullish. */
  value?: string | number | boolean;
  /** An explicit false, 0, or empty string is a seed, not a missing value. */
  default_value?: string | number | boolean;
  options?: string[];
  /** Store id while displaying name; options uses the same string for both. */
  items?: { id: string; name: string }[];
  /** Presence replaces the control with spacer content, including an empty string. */
  spacer?: string;
  /** Falsy means valid; a message means invalid. Thrown validators fail validation. */
  validate?: (value?: string | number) => ReactNode;

  // House keys never change at a boundary. Local wrapper function names may.
  // HandlerKey keeps (data?, type?) optional: the second slot is dispatch,
  // e.g. 'input' or 'select', never a props bag. These field payloads are values.
  handleBlur?: HandlerKey<string>;
  handleFocus?: HandlerKey<string>;
  handleChange?: HandlerKey<string>;
  /** Generated selects currently report { [name]: value } through this handler. */
  handleSelect?: HandlerKey<Record<string, unknown>>;

  /** Room for additional keys without pretending their contents are understood. */
  [key: string]: unknown;
}

export interface StatelessInputGroupProps extends InputGroupBaseProps {
  /** Optional rendering seams; supplied components still receive house handler keys. */
  Container?: (props?: Record<string, unknown>) => React.JSX.Element;
  Components?: {
    /** Reserved legacy slot; the renderer currently uses Container for the wrapper. */
    GroupContainer?: (props?: Record<string, unknown>) => React.JSX.Element;
    Label?: (props?: Record<string, unknown>) => React.JSX.Element;
    Input?: (props?: Record<string, unknown>) => React.JSX.Element;
    Message?: (props?: Record<string, unknown>) => React.JSX.Element;
  };
  className?: string;
  /** Displays generated values; arbitrary composed children retain their own behavior. */
  view_mode?: boolean;
  children?: ReactNode;
}

/** The form owns collection and validation; it augments handlers before forwarding. */
export interface StatelessFormProps {
  name?: string;
  id?: string;
  /** Dispatch for form submit/blur. Changes preserve the child's dispatch type. */
  type?: string;
  /** Flat fields, tabbed fields, and composed children may be used together. */
  form_fields?: StatelessInputGroupProps[];
  form_tabs?: Record<string, StatelessInputGroupProps[]>;
  children?: ReactNode;
  container_ref?: RefObject<HTMLFormElement>;

  /** Called with the collected bag only after validation succeeds. */
  handleSubmit?: HandleSubmit<FormValues>;
  /**
   * The form sends its collected bag and the child's dispatch type upstream.
   * A local handleInputChange function is still passed down as handleChange.
   */
  handleChange?: HandlerKey<FormValues>;
  handleBlur?: HandlerKey<FormValues>;
  handleCancel?: HandlerKey;
  handleFocus?: HandlerKey<string>;
  /** Defaults for generated fields; an individual field's handler takes precedence.
   * Pick keeps this subset tied to the actual field props instead of a second contract.
   */
  inputGroupHandlers?: Pick<
    StatelessInputGroupProps,
    'handleBlur' | 'handleFocus' | 'handleChange' | 'handleSelect'
  >;

  className?: string;
  view_mode?: boolean;
  /** Site class composition; component CSS tokens provide per-property overrides. */
  form_class?: string;
  input_group_class?: string;
  submit_class?: string;
  cancel_class?: string;
  tabs_class?: string;
  tab_nav_class?: string;
  tab_button_class?: string;
  tab_class?: string;
  button_text?: {
    submit?: string;
    cancel?: ReactNode;
  };
}
