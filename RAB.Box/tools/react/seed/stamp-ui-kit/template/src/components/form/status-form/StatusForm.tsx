import { useRef } from 'react';
import type { ReactNode } from 'react';
import './status-form.css';
import { Form } from '../Form.tsx';
import type { FormProps, FormValues } from '../Form.tsx';

const STATES = ['busy', 'ok', 'error'] as const;
type StatusState = (typeof STATES)[number];

export interface StatusFormProps extends Omit<FormProps, 'onSubmit'> {
  busyLabel?: string;
  okLabel?: string;
  errorLabel?: string;
  onSubmit?: (values: FormValues) => Promise<string | void> | string | void;
  children?: ReactNode;
}

/* THE DOM IS THE FORM STATE (RULES F4). No useState anywhere near a form:
   the status strip is a live element this wrapper writes directly, so a
   re-render can never eat a keystroke or a status. */
export const StatusForm = ({
  busyLabel = 'Saving…',
  okLabel = 'Saved.',
  errorLabel = 'That did not save — try again.',
  onSubmit,
  children,
  ...formProps
}: StatusFormProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);

  const show = (state: StatusState, text: string) => {
    const root = rootRef.current;
    const status = statusRef.current;
    if (!root || !status) return;
    STATES.forEach((name) => status.classList.toggle(`status-form__status--${name}`, name === state));
    status.textContent = text;
    status.hidden = false;
    root.setAttribute('aria-busy', state === 'busy' ? 'true' : 'false');
  };

  const submit = async (values: FormValues) => {
    show('busy', busyLabel);
    try {
      const result = onSubmit ? await onSubmit(values) : undefined;
      show('ok', typeof result === 'string' ? result : okLabel);
    } catch (error) {
      show('error', error instanceof Error && error.message ? error.message : errorLabel);
    }
  };

  return (
    <div ref={rootRef} className="status-form" aria-busy="false">
      <div className="status-form__host">
        <Form {...formProps} onSubmit={submit}>
          {children}
        </Form>
      </div>
      <p ref={statusRef} className="status-form__status" role="status" hidden />
    </div>
  );
};
