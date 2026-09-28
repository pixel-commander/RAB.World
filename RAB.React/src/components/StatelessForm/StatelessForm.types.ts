import type { JSX } from 'react';
import type { FormEvent, ChangeEvent, FocusEvent, ReactNode } from "react";

export interface InputGroupBaseProps {
  tabIndex?: number;
  label?: ReactNode;
  helperText?: string;
  errorMessage?: string;
  id?: string;
  name: string;
  isRequired?: boolean;
  type?: string;
  value?: string | number | boolean;
  defaultValue?: string | number | boolean;
  options?: string[];
  [key: string]: unknown;
  validate?: (x?: string | number | boolean) => ReactNode;
  spacer?: string;
}

export type StatelessInputGroupHandlerProps = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> | FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>, props?: InputGroupBaseProps | Record<string, string>, field?: InputGroupBaseProps) => void;

export interface StatelessInputGroupHanlderProps {
  handleSelect?: (data: Record<string, string>, props?: InputGroupBaseProps) => void;
  handleBlur?: StatelessInputGroupHandlerProps
  handleFocus?: StatelessInputGroupHandlerProps
  handleChange?: StatelessInputGroupHandlerProps
}

export interface StatelessInputGroupProps extends InputGroupBaseProps, StatelessInputGroupHanlderProps {
  Container?: (x?: Record<string, unknown>) => JSX.Element;
  Components?: {
    GroupContainer?: (x?: Record<string, unknown>) => JSX.Element;
    Label?: (x?: Record<string, unknown>) => JSX.Element;
    Input?: (x?: Record<string, unknown>) => JSX.Element;
    Message?: (x?: Record<string, unknown>) => JSX.Element;
  },
  className?: string;
}

export type StatelessFormHandlerProps = (data: { [k: string]: FormDataEntryValue }, e?: FormEvent) => void

export interface StatelessFormBaseProps {
  handleSelect?: StatelessInputGroupHanlderProps['handleSelect'];
  form_fields?: InputGroupBaseProps[];
  formTabs?: Record<string, InputGroupBaseProps[]>;
  name?: string;
  id?: string;
  handleSubmit?: StatelessFormHandlerProps;
  handleChange?: StatelessFormHandlerProps;
  handleBlur?: StatelessFormHandlerProps
  handleCancel?: () => void;
  handleFocus?: StatelessInputGroupHandlerProps
}

export interface StatelessFormProps extends StatelessFormBaseProps {
  handleInputChange?: StatelessInputGroupHandlerProps;
  className?: string;
  viewMode?: boolean;
  FormContainer?: (x?: Record<string, unknown>) => JSX.Element;
  FormMessage?: (x?: Record<string, unknown>) => JSX.Element;
  inputGroupHandlers?: StatelessInputGroupHanlderProps;
  buttonText?: {
    submit?: string;
    cancel?: ReactNode;
  }
}
