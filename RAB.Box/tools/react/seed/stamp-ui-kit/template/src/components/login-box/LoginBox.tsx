import { useRef } from 'react';
import './login-box.css';
import { StatusForm } from '../form/status-form/StatusForm.tsx';
import { TextField } from '../form/text-field/TextField.tsx';
import type { FormValues } from '../form/Form.tsx';

export type LoginKind = 'login' | 'create' | 'google';

export interface LoginBoxProps {
  has_create_account?: boolean;
  login?: (values: FormValues) => Promise<unknown> | unknown;
  create?: (values: FormValues) => Promise<unknown> | unknown;
  google?: () => Promise<unknown> | unknown;
  onDone?: (kind: LoginKind, result: unknown) => void;
}

// login(values) / create(values) / google() do the auth work — async is fine,
// a throw shows the error state; onDone(kind, result) fires after success.
// STATELESS: both views stay mounted; switching toggles hidden in the DOM
// (RULES F4), so typed values survive a look at the other view.
export const LoginBox = ({ login, create, google, onDone, has_create_account = false }: LoginBoxProps) => {
  const rootRef = useRef<HTMLElement>(null);

  const done = (kind: LoginKind, result: unknown) => {
    if (onDone) setTimeout(() => onDone(kind, result), 0); // let the ok state paint first
  };

  const show = (name: 'login' | 'create') => {
    const root = rootRef.current;
    if (!root || (name === 'create' && !has_create_account)) return;
    const isLogin = name === 'login';
    root.querySelector('.login-box__title')!.textContent = isLogin ? 'Sign in' : 'Create account';
    root.querySelector('.login-box__note')!.textContent = isLogin
      ? 'Welcome back — log in to continue.'
      : 'A minute of typing and you are in.';
    root.querySelectorAll<HTMLElement>('[data-view]').forEach((el) => {
      el.hidden = el.dataset.view !== name;
    });
    root.querySelectorAll<HTMLElement>('[data-alt]').forEach((el) => {
      el.hidden = el.dataset.alt !== name ||
        (el.dataset.id === 'create-account' && !has_create_account) ||
        (el.dataset.id === 'google-login' && typeof google !== 'function');
    });
  };

  return (
    <section ref={rootRef} className="login-box container-float pad">
      <header className="login-box__head">
        <h2 className="login-box__title">Sign in</h2>
        <p className="login-box__note">Welcome back — log in to continue.</p>
      </header>

      <div className="login-box__view" data-view="login">
        <StatusForm
          submitLabel="Log in"
          busyLabel="Logging in…"
          errorLabel="Login failed — check your email and password."
          onSubmit={async (values) => {
            if (typeof login !== 'function') throw new Error('Sign-in is not connected yet.');
            const result = await login(values);
            done('login', result);
            return 'Welcome back.';
          }}
        >
          <TextField name="email" label="Email" type="email" required />
          <TextField name="password" label="Password" type="password" required />
        </StatusForm>
      </div>

      <div className="login-box__view" data-view="create" hidden>
        <StatusForm
          submitLabel="Create account"
          busyLabel="Creating account…"
          errorLabel="That did not go through — try again."
          onSubmit={async (values) => {
            if (!has_create_account || typeof create !== 'function') throw new Error('Account creation is unavailable.');
            const result = await create(values);
            done('create', result);
            return 'Account created.';
          }}
        >
          <TextField name="name" label="Name" required />
          <TextField name="email" label="Email" type="email" required />
          <TextField name="password" label="Password" type="password" required />
        </StatusForm>
      </div>

      <div className="login-box__alt" hidden={!has_create_account && !google}>
        <button type="button" className="action-muted" data-alt="login" data-id="create-account" hidden={!has_create_account} onClick={() => show('create')}>
          Create account
        </button>
        <button
          type="button"
          className="action-muted"
          data-alt="login"
          data-id="google-login"
          hidden={!google}
          onClick={async () => done('google', google ? await google() : undefined)}
        >
          Log in with Google
        </button>
        <button type="button" className="action-muted" data-alt="create" hidden onClick={() => show('login')}>
          Have an account? Log in
        </button>
      </div>
    </section>
  );
};
