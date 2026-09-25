import type { ReactNode } from 'react';
import type { HandlerKey } from '../../../HouseKeys.types.ts';

export interface InputGroupProps {
  name?: string;
  id?: string;
  default_value?: string | number | boolean;
  color?: string;
  label?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  className?: string;
  is_required?: boolean;
  is_visible?: boolean;
  [key: string]: unknown;
  value?: string | number | boolean;
  placeholder?: string;
  input_type?: string;
  field_class?: string;
  children?: ReactNode;
  is_disabled?: boolean;
  handleChange?: HandlerKey<string>;
  handleFocus?: HandlerKey<boolean>;
}
