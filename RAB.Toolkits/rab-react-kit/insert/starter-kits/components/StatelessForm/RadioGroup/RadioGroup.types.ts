import type { ReactNode } from 'react';
import type { HandlerKey } from '../../../HouseKeys.types.ts';

export interface RadioGroupProps {
  name?: string;
  id?: string;
  default_value?: string | number | boolean | string[];
  color?: string;
  label?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  className?: string;
  is_required?: boolean;
  is_visible?: boolean;
  is_disabled?: boolean;
  [key: string]: unknown;
  value?: string | number | boolean;
  mode?: string;
  options?: string[] | string;
  can_scroll?: boolean;
  has_search?: boolean;
  can_add?: boolean;
  handleSelect?: HandlerKey<string>;
  handleChange?: HandlerKey<string>;
  handleInsert?: HandlerKey<string>;
}
