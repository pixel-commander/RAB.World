import type { FormEvent, ReactNode } from 'react';
import './form.css';

export type FormValues = Record<string, FormDataEntryValue>;

export interface FormProps {
  submitLabel?: string;
  cancelLabel?: string;
  onSubmit?: (values: FormValues) => void;
  onCancel?: () => void;
  pad?: boolean;
  children?: ReactNode;
}

/* RULES F1-F4: a form is a <form>; controls stay uncontrolled; values read
   once via FormData at submit */
export const Form = ({ submitLabel = 'Save', cancelLabel, onSubmit, onCancel, pad = false, children }: FormProps) => {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (onSubmit) onSubmit(Object.fromEntries(new FormData(event.currentTarget)));
  };
  return (
    <form className={`form${pad ? ' form--pad' : ''}`} noValidate onSubmit={handleSubmit}>
      {children}
      <footer className="form__actions">
        {cancelLabel && (
          <button type="button" className="action-muted form__cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
        )}
        <button type="submit" className="action-main form__submit">
          {submitLabel}
        </button>
      </footer>
    </form>
  );
};
